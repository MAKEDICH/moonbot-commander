"""
Health Metrics API для мониторинга производительности

Предоставляет эндпоинты для мониторинга:
- Статус системы
- Метрики производительности
- Статистика соединений
- Состояние очередей
"""
import os
import time
import psutil
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from main import app
from models.database import get_db, get_pool_status, DATABASE_URL
from models import models
from services.websocket_manager import ws_manager
from services.auth import get_current_user
from utils.logging import log
from utils.datetime_utils import utcnow, format_iso


# Время запуска приложения
_start_time = time.time()


@app.get("/api/metrics/system", tags=["metrics"])
async def get_system_metrics(
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Получить системные метрики.
    
    Returns:
        Dict с метриками CPU, памяти, диска
    """
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()
        
        # Память
        memory = psutil.virtual_memory()
        
        # Диск
        disk = psutil.disk_usage('/')
        
        # Процесс
        process = psutil.Process()
        process_memory = process.memory_info()
        
        return {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
            },
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "percent": memory.percent,
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "percent": disk.percent,
            },
            "process": {
                "memory_mb": round(process_memory.rss / (1024**2), 2),
                "threads": process.num_threads(),
                "open_files": len(process.open_files()) if hasattr(process, 'open_files') else 0,
            },
            "uptime_seconds": round(time.time() - _start_time, 1),
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting system metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/database", tags=["metrics"])
async def get_database_metrics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить метрики базы данных.
    
    Returns:
        Dict с метриками БД
    """
    try:
        # Статус пула соединений
        pool_status = get_pool_status()
        
        # Статистика по таблицам
        tables_stats = {}
        
        # Количество записей в основных таблицах
        table_counts = [
            ("servers", models.Server),
            ("moonbot_orders", models.MoonBotOrder),
            ("sql_command_log", models.SQLCommandLog),
            ("server_balance", models.ServerBalance),
            ("moonbot_api_errors", models.MoonBotAPIError),
            ("strategy_cache", models.StrategyCache),
        ]
        
        for table_name, model_class in table_counts:
            try:
                count = db.query(model_class).count()
                tables_stats[table_name] = count
            except Exception:
                tables_stats[table_name] = -1
        
        # Определяем тип БД
        db_type = "sqlite" if DATABASE_URL.startswith("sqlite") else "postgresql"
        
        return {
            "type": db_type,
            "pool": pool_status,
            "tables": tables_stats,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting database metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/websocket", tags=["metrics"])
async def get_websocket_metrics(
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Получить метрики WebSocket соединений.
    
    Returns:
        Dict с метриками WS
    """
    try:
        stats = ws_manager.get_stats()
        
        return {
            **stats,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting websocket metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/udp", tags=["metrics"])
async def get_udp_metrics(
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Получить метрики UDP обработки.
    
    Включает статистику для мониторинга нагрузки 3000+ серверов:
    - Пакеты в секунду
    - Размер очереди Worker Pool
    - Статистика Batch Processor
    - Алерты при перегрузке
    
    Returns:
        Dict с метриками UDP
    """
    try:
        from services.udp import manager as udp_manager
        
        # Статистика активных listeners
        active_listeners = len(udp_manager.active_listeners)
        
        # Статистика глобального сокета
        global_socket_stats = {}
        packets_per_second = 0
        if udp_manager.global_udp_socket:
            gs = udp_manager.global_udp_socket
            packets_per_second = getattr(gs, 'packets_per_second', 0)
            global_socket_stats = gs.get_stats() if hasattr(gs, 'get_stats') else {
                "running": gs.running,
                "total_packets": gs.total_packets,
                "packets_per_second": packets_per_second,
                "registered_listeners": len(gs.ip_port_to_listener),
                "last_error": gs.last_error,
            }
        
        # Статистика worker pool (если включён)
        worker_pool_stats = {}
        queue_utilization = 0
        try:
            from services.udp.worker_pool import get_worker_pool
            pool = get_worker_pool()
            worker_pool_stats = pool.get_stats()
            # Вычисляем утилизацию очереди
            if pool.queue_size > 0:
                queue_utilization = round(
                    worker_pool_stats.get("queue_size", 0) / pool.queue_size * 100, 1
                )
        except Exception:
            worker_pool_stats = {"enabled": False}
        
        # Статистика batch processor (если включён)
        batch_stats = {}
        try:
            from services.udp.batch_processor import get_batch_processor
            processor = get_batch_processor()
            batch_stats = processor.get_stats()
        except Exception:
            batch_stats = {"enabled": False}
        
        # Определяем уровень нагрузки и алерты
        alerts = []
        load_level = "normal"
        
        # Проверяем пакеты в секунду
        if packets_per_second > 5000:
            load_level = "critical"
            alerts.append(f"Very high packet rate: {packets_per_second}/sec")
        elif packets_per_second > 2000:
            load_level = "high"
            alerts.append(f"High packet rate: {packets_per_second}/sec")
        
        # Проверяем очередь Worker Pool
        if queue_utilization > 80:
            load_level = "critical"
            alerts.append(f"Worker pool queue at {queue_utilization}%")
        elif queue_utilization > 50:
            if load_level != "critical":
                load_level = "high"
            alerts.append(f"Worker pool queue at {queue_utilization}%")
        
        # Проверяем dropped messages
        dropped = worker_pool_stats.get("messages_dropped", 0)
        if dropped > 0:
            alerts.append(f"Messages dropped: {dropped}")
        
        # Проверяем ошибки обработки
        errors = worker_pool_stats.get("processing_errors", 0)
        if errors > 100:
            alerts.append(f"Processing errors: {errors}")
        
        return {
            "active_listeners": active_listeners,
            "global_socket": global_socket_stats,
            "worker_pool": worker_pool_stats,
            "batch_processor": batch_stats,
            "load_level": load_level,  # normal, high, critical
            "queue_utilization_percent": queue_utilization,
            "packets_per_second": packets_per_second,
            "alerts": alerts,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting UDP metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/redis", tags=["metrics"])
async def get_redis_metrics(
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Получить метрики Redis кэша.
    
    Returns:
        Dict с метриками Redis
    """
    try:
        from services.redis_cache import get_redis_cache
        
        cache = await get_redis_cache()
        stats = await cache.get_stats()
        
        return {
            **stats,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting Redis metrics: {e}", level="ERROR")
        return {
            "connected": False,
            "error": str(e),
            "timestamp": format_iso(utcnow()),
        }


@app.get("/api/metrics/all", tags=["metrics"])
async def get_all_metrics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить все метрики системы.
    
    Returns:
        Dict со всеми метриками
    """
    try:
        # Собираем все метрики
        system = await get_system_metrics(current_user)
        database = await get_database_metrics(current_user, db)
        websocket = await get_websocket_metrics(current_user)
        udp = await get_udp_metrics(current_user)
        redis = await get_redis_metrics(current_user)
        
        return {
            "system": system,
            "database": database,
            "websocket": websocket,
            "udp": udp,
            "redis": redis,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting all metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/capacity", tags=["metrics"])
async def get_capacity_metrics(
    current_user: models.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Получить метрики пропускной способности системы.
    
    Оценивает, сколько серверов система может обработать.
    
    Returns:
        Dict с оценкой capacity
    """
    try:
        # Получаем текущие метрики
        from services.udp import manager as udp_manager
        from services.udp.worker_pool import get_worker_pool
        from services.udp.batch_processor import get_batch_processor
        
        # Текущая нагрузка
        active_listeners = len(udp_manager.active_listeners)
        
        # Worker Pool stats
        try:
            pool = get_worker_pool()
            pool_stats = pool.get_stats()
            avg_processing_time_ms = pool_stats.get("avg_processing_time_ms", 10)
            queue_size = pool_stats.get("queue_size", 0)
            max_queue = pool.queue_size
            workers = pool.num_workers
        except Exception:
            avg_processing_time_ms = 10
            queue_size = 0
            max_queue = 10000
            workers = 16
        
        # Batch Processor stats
        try:
            batch = get_batch_processor()
            batch_stats = batch.get_stats()
            avg_flush_time_ms = batch_stats.get("avg_flush_time_ms", 50)
            pending_items = batch_stats.get("pending", 0)
        except Exception:
            avg_flush_time_ms = 50
            pending_items = 0
        
        # Расчёт пропускной способности
        # Балансы приходят каждые 5 секунд от каждого сервера
        # Ордера - в среднем 1-10 в минуту на сервер
        
        # Сообщений на сервер в секунду (баланс каждые 5 сек + ордера)
        messages_per_server_per_sec = 0.2 + 0.1  # ~0.3 msg/sec
        
        # Максимальная пропускная способность воркеров
        if avg_processing_time_ms > 0:
            messages_per_worker_per_sec = 1000 / avg_processing_time_ms
        else:
            messages_per_worker_per_sec = 100
        
        total_capacity_per_sec = workers * messages_per_worker_per_sec
        
        # Максимальное количество серверов
        max_servers = int(total_capacity_per_sec / messages_per_server_per_sec)
        
        # Текущая утилизация
        current_utilization = round(
            (active_listeners * messages_per_server_per_sec) / total_capacity_per_sec * 100, 1
        ) if total_capacity_per_sec > 0 else 0
        
        # Headroom (запас)
        headroom_servers = max_servers - active_listeners
        headroom_percent = round(100 - current_utilization, 1)
        
        # Рекомендации
        recommendations = []
        if current_utilization > 80:
            recommendations.append("Consider adding more workers or scaling horizontally")
        if queue_size > max_queue * 0.5:
            recommendations.append("Increase queue size or add workers")
        if avg_processing_time_ms > 50:
            recommendations.append("Optimize message processing or use faster storage")
        if pending_items > 1000:
            recommendations.append("Increase batch flush frequency")
        
        return {
            "current_servers": active_listeners,
            "max_servers_estimate": max_servers,
            "headroom_servers": headroom_servers,
            "headroom_percent": headroom_percent,
            "current_utilization_percent": current_utilization,
            "workers": workers,
            "messages_per_worker_per_sec": round(messages_per_worker_per_sec, 1),
            "total_capacity_per_sec": round(total_capacity_per_sec, 1),
            "avg_processing_time_ms": round(avg_processing_time_ms, 2),
            "queue_utilization_percent": round(queue_size / max_queue * 100, 1) if max_queue > 0 else 0,
            "batch_pending": pending_items,
            "recommendations": recommendations,
            "can_handle_3000_servers": max_servers >= 3000,
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting capacity metrics: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/servers-load", tags=["metrics"])
async def get_servers_load(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить статистику нагрузки по серверам.
    
    Returns:
        Dict со статистикой серверов
    """
    try:
        # Общее количество серверов
        total_servers = db.query(models.Server).filter(
            models.Server.user_id == current_user.id
        ).count()
        
        # Активные серверы
        active_servers = db.query(models.Server).filter(
            models.Server.user_id == current_user.id,
            models.Server.is_active == True
        ).count()
        
        # Серверы с активными listeners
        from services.udp import manager as udp_manager
        listening_servers = len(udp_manager.active_listeners)
        
        # Серверы онлайн (по статусу)
        online_servers = db.query(models.ServerStatus).join(
            models.Server
        ).filter(
            models.Server.user_id == current_user.id,
            models.ServerStatus.is_online == True
        ).count()
        
        # Ордера за последний час
        from datetime import timedelta
        hour_ago = utcnow() - timedelta(hours=1)
        recent_orders = db.query(models.MoonBotOrder).join(
            models.Server
        ).filter(
            models.Server.user_id == current_user.id,
            models.MoonBotOrder.created_at >= hour_ago
        ).count()
        
        # SQL логи за последний час
        recent_sql_logs = db.query(models.SQLCommandLog).join(
            models.Server
        ).filter(
            models.Server.user_id == current_user.id,
            models.SQLCommandLog.received_at >= hour_ago
        ).count()
        
        return {
            "total_servers": total_servers,
            "active_servers": active_servers,
            "listening_servers": listening_servers,
            "online_servers": online_servers,
            "recent_orders_1h": recent_orders,
            "recent_sql_logs_1h": recent_sql_logs,
            "load_factor": round(listening_servers / max(active_servers, 1) * 100, 1),
            "timestamp": format_iso(utcnow()),
        }
    except Exception as e:
        log(f"[METRICS] Error getting servers load: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=str(e))

