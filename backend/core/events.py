"""
События запуска и остановки приложения

Startup и shutdown handlers для FastAPI.
Отвечает за инициализацию UDP listeners, scheduler и graceful shutdown.

Оптимизировано для высоких нагрузок (3000+ серверов):
- Автоматическая инициализация Redis кэша
- Автоматическое применение индексов БД
- Batch processor для UDP сообщений
"""
import asyncio
import traceback
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional, Dict, Any

from models.database import SessionLocal
from models import models
from services import udp, encryption
from services import scheduler as scheduler_module
from services.websocket_manager import ws_manager
from services.update_checker import check_update_on_startup
from utils.logging import log, check_and_manage_all_logs
from utils.config_loader import get_config_value

if TYPE_CHECKING:
    from fastapi import FastAPI


async def _init_high_load_components() -> None:
    """
    Инициализация компонентов для высоких нагрузок.
    
    Выполняется автоматически при старте ВО ВСЕХ РЕЖИМАХ
    (local, server, dev, production).
    
    Инициализирует:
    - Worker Pool для параллельной обработки UDP
    - Batch Processor для группировки записей в БД
    - Redis кэш (с fallback на in-memory)
    - Индексы БД для высокой производительности
    """
    import os
    
    # Логируем режим работы
    moonbot_mode = os.getenv('MOONBOT_MODE', 'auto').lower()
    log(f"[STARTUP] ============================================================")
    log(f"[STARTUP] 🚀 HIGH-LOAD MODE: Enabled for ALL modes (local/server/dev/prod)")
    log(f"[STARTUP] 📋 MOONBOT_MODE: {moonbot_mode}")
    log(f"[STARTUP] ============================================================")
    
    # Инициализация Worker Pool для параллельной обработки UDP
    try:
        from services.udp.worker_pool import start_worker_pool, get_worker_pool
        start_worker_pool()
        pool = get_worker_pool()
        log(f"[STARTUP] ✅ UDP Worker Pool started ({pool.num_workers} workers, "
            f"queue_size={pool.queue_size})")
    except Exception as e:
        log(f"[STARTUP] Worker Pool init failed: {e}", level="WARNING")
    
    # Инициализация Batch Processor для UDP сообщений
    try:
        from services.udp.batch_processor import start_batch_processor, get_batch_processor
        start_batch_processor()
        processor = get_batch_processor()
        log(f"[STARTUP] ✅ Batch Processor started (batch_size={processor.batch_size}, "
            f"flush_interval={processor.flush_interval_ms}ms)")
    except Exception as e:
        log(f"[STARTUP] Batch Processor init failed: {e}", level="WARNING")
    
    # Инициализация Redis кэша (с fallback на in-memory)
    try:
        from services.redis_cache import get_redis_cache
        cache = await get_redis_cache()
        stats = await cache.get_stats()
        if stats.get("using_fallback"):
            log("[STARTUP] ⚠️ Redis not available, using in-memory cache (OK for dev)")
        else:
            log("[STARTUP] ✅ Redis cache connected")
    except Exception as e:
        log(f"[STARTUP] Redis init skipped: {e}", level="DEBUG")
    
    # Применение индексов для высоких нагрузок (если ещё не применены)
    try:
        from updates.versions.add_high_load_indexes import check_migration_needed, run_migration
        if check_migration_needed():
            log("[STARTUP] Applying high-load database indexes...")
            run_migration()
            log("[STARTUP] ✅ High-load indexes applied")
        else:
            log("[STARTUP] ✅ High-load indexes already applied")
    except Exception as e:
        log(f"[STARTUP] High-load indexes skipped: {e}", level="DEBUG")
    
    # Применение миграции для cleanup_settings (новые поля для 3000+ серверов)
    try:
        from updates.versions.add_cleanup_settings_columns import (
            check_migration_needed as check_cleanup_migration,
            run_migration as run_cleanup_migration
        )
        if check_cleanup_migration():
            log("[STARTUP] Applying cleanup settings migration...")
            run_cleanup_migration()
            log("[STARTUP] ✅ Cleanup settings migration applied")
        else:
            log("[STARTUP] ✅ Cleanup settings already up to date")
    except Exception as e:
        log(f"[STARTUP] Cleanup settings migration skipped: {e}", level="DEBUG")
    
    # Применение недостающих индексов для ForeignKey полей
    try:
        from updates.versions.add_missing_indexes import (
            check_migration_needed as check_indexes_migration,
            run_migration as run_indexes_migration
        )
        if check_indexes_migration():
            log("[STARTUP] Applying missing indexes migration...")
            run_indexes_migration()
            log("[STARTUP] ✅ Missing indexes applied")
        else:
            log("[STARTUP] ✅ All indexes already exist")
    except Exception as e:
        log(f"[STARTUP] Missing indexes migration skipped: {e}", level="DEBUG")
    
    # Применение миграции для scheduled_command_servers (group_name)
    try:
        from updates.versions.add_scheduled_command_servers_group_name import (
            check_migration_needed as check_scs_migration,
            run_migration as run_scs_migration
        )
        if check_scs_migration():
            log("[STARTUP] Applying scheduled_command_servers migration...")
            run_scs_migration()
            log("[STARTUP] ✅ scheduled_command_servers migration applied")
        else:
            log("[STARTUP] ✅ scheduled_command_servers already up to date")
    except Exception as e:
        log(f"[STARTUP] scheduled_command_servers migration skipped: {e}", level="DEBUG")
    
    # Применение миграции для исправления nullable server_id
    try:
        from updates.versions.fix_scheduled_command_servers_nullable import (
            check_migration_needed as check_nullable_migration,
            run_migration as run_nullable_migration
        )
        if check_nullable_migration():
            log("[STARTUP] Applying fix_scheduled_command_servers_nullable migration...")
            run_nullable_migration()
            log("[STARTUP] ✅ fix_scheduled_command_servers_nullable migration applied")
        else:
            log("[STARTUP] ✅ scheduled_command_servers.server_id already nullable")
    except Exception as e:
        log(f"[STARTUP] fix_scheduled_command_servers_nullable migration skipped: {e}", level="DEBUG")
    
    # Заполнение кэша user_id для быстрого доступа
    try:
        from services.user_id_cache import populate_cache_from_db
        count = populate_cache_from_db()
        log(f"[STARTUP] ✅ User ID cache populated ({count} servers)")
    except Exception as e:
        log(f"[STARTUP] User ID cache init failed: {e}", level="WARNING")


async def startup_handler() -> None:
    """
    Выполняется при старте приложения.
    
    Автоматически:
    - Инициализирует компоненты для высоких нагрузок
    - Запускает UDP listeners для всех активных серверов
    - Запускает scheduler
    """
    log("[STARTUP] Initializing...")
    
    # Устанавливаем event loop для WebSocket manager
    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
    ws_manager.set_event_loop(loop)
    log("[STARTUP] WebSocket manager event loop configured")
    
    # Инициализация компонентов для высоких нагрузок
    await _init_high_load_components()

    # Проверяем обновления
    log("[STARTUP] Checking for updates...")
    try:
        update_notification: Optional[Dict[str, Any]] = await check_update_on_startup()
        if update_notification:
            log(
                f"[STARTUP] 🆕 Update available: "
                f"v{update_notification['current_version']} → v{update_notification['new_version']}"
            )
            ws_manager.update_notification = update_notification
    except Exception as e:
        log(f"[STARTUP] Update check failed: {e}", level="WARNING")
    
    # Инициализация UDP Listeners
    log("[STARTUP] Initializing UDP Listeners...")
    db = SessionLocal()
    try:
        # Диагностика: показываем количество серверов (не все, чтобы не спамить при 3000+)
        all_servers: List[models.Server] = db.query(models.Server).all()
        log(f"[STARTUP] Total servers in DB: {len(all_servers)}")
        
        # Показываем только первые 10 для диагностики
        if len(all_servers) <= 10:
            for s in all_servers:
                log(f"  - Server ID={s.id}, Name={s.name}, Active={s.is_active}, User={s.user_id}")
        else:
            log(f"[STARTUP] (showing first 10 of {len(all_servers)})")
            for s in all_servers[:10]:
                log(f"  - Server ID={s.id}, Name={s.name}, Active={s.is_active}, User={s.user_id}")
        
        servers: List[models.Server] = db.query(models.Server).filter(
            models.Server.is_active == True
        ).all()

        log(f"[STARTUP] Found {len(servers)} active servers")
        
        # Оптимизация для 3000+ серверов: запускаем listeners пакетами
        # чтобы не перегружать систему
        BATCH_SIZE = 100
        started_count = 0
        failed_count = 0
        
        for i in range(0, len(servers), BATCH_SIZE):
            batch = servers[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(servers) + BATCH_SIZE - 1) // BATCH_SIZE
            
            log(f"[STARTUP] Starting listeners batch {batch_num}/{total_batches} ({len(batch)} servers)...")
            
            for server in batch:
                try:
                    password: Optional[str] = None
                    if server.password:
                        password = encryption.decrypt_password(server.password)

                    success: bool = udp.start_listener(
                        server_id=server.id,
                        host=server.host,
                        port=server.port,
                        password=password,
                        keepalive_enabled=server.keepalive_enabled
                    )

                    if success:
                        started_count += 1
                    else:
                        failed_count += 1
                        log(
                            f"[STARTUP] ❌ Failed to start listener for server {server.id}: {server.name}",
                            level="ERROR"
                        )

                except Exception as e:
                    failed_count += 1
                    log(f"[STARTUP] ❌ Error starting listener for server {server.id}: {e}", level="ERROR")
            
            # Небольшая пауза между пакетами для стабильности
            if i + BATCH_SIZE < len(servers):
                await asyncio.sleep(0.1)
        
        log(f"[STARTUP] ✅ Listeners started: {started_count} OK, {failed_count} failed")

    except Exception as e:
        log(f"[STARTUP] Error during startup: {e}", level="ERROR")
        log(f"[STARTUP] Traceback: {traceback.format_exc()}", level="DEBUG")
    finally:
        db.close()

    log("[STARTUP] UDP Listeners initialization complete")
    
    # Запускаем фоновую задачу для мониторинга listeners
    asyncio.create_task(monitor_listeners())
    
    # Запускаем scheduler как фоновую задачу
    log("[STARTUP] Starting Command Scheduler...")
    asyncio.create_task(run_scheduler())
    log("[STARTUP] Command Scheduler started")


async def monitor_listeners() -> None:
    """
    Фоновая задача для мониторинга и перезапуска упавших listeners.
    
    Проверяет состояние listeners каждую минуту и перезапускает
    упавшие для активных серверов.
    """
    while True:
        await asyncio.sleep(60)  # Проверяем каждую минуту

        try:
            db = SessionLocal()
            try:
                servers: List[models.Server] = db.query(models.Server).filter(
                    models.Server.is_active == True
                ).all()

                for server in servers:
                    listener_status: Dict[str, Any] = udp.get_listener_status(server.id)

                    # Если listener не работает - перезапускаем
                    if not listener_status["is_running"]:
                        log(f"[MONITOR] Listener for server {server.id} is down, restarting...")
                        
                        password: Optional[str] = None
                        if server.password:
                            password = encryption.decrypt_password(server.password)

                        success: bool = udp.start_listener(
                            server_id=server.id,
                            host=server.host,
                            port=server.port,
                            password=password
                        )

                        if success:
                            log(f"[MONITOR] OK: Listener restarted for server {server.id}")
                        else:
                            log(
                                f"[MONITOR] FAIL: Failed to restart listener for server {server.id}",
                                level="ERROR"
                            )
            finally:
                db.close()
        except Exception as e:
            log(f"[MONITOR] Error: {e}", level="ERROR")


async def run_scheduler() -> None:
    """
    Фоновая задача для выполнения отложенных команд.
    
    Проверяет pending команды и выполняет их в назначенное время.
    Использует локальное время сервера для сравнения.
    """
    log("[SCHEDULER] Background task started")
    
    # Включаем scheduler по умолчанию
    scheduler_module.set_scheduler_enabled(True)
    
    last_check: datetime = datetime.now()
    last_status_log: datetime = datetime.now()
    last_log_cleanup: datetime = datetime.now()
    
    while True:
        try:
            # Проверяем включен ли scheduler
            if not scheduler_module.is_scheduler_enabled():
                # Логируем статус раз в 60 секунд
                if (datetime.now() - last_status_log).total_seconds() >= 60:
                    log("[SCHEDULER] PAUSED - Scheduler disabled by user")
                    last_status_log = datetime.now()
                # Спим 10 секунд когда выключен
                await asyncio.sleep(10)
                continue
            
            # Проверяем логи раз в час
            if (datetime.now() - last_log_cleanup).total_seconds() >= 3600:
                try:
                    check_and_manage_all_logs("logs")
                    last_log_cleanup = datetime.now()
                except Exception as e:
                    log(f"[SCHEDULER] Failed to check logs: {e}", level="ERROR")
            
            db = SessionLocal()
            try:
                next_cmd = scheduler_module.get_next_pending_command(db)
                
                if not next_cmd:
                    # Нет команд - логируем раз в 60 секунд
                    if (datetime.now() - last_check).total_seconds() >= 60:
                        log("[SCHEDULER] No pending commands")
                        last_check = datetime.now()
                    await asyncio.sleep(5)
                    continue
                
                # Есть команда - используем ЛОКАЛЬНОЕ время для сравнения!
                now: datetime = datetime.now()
                time_until: float = (next_cmd.scheduled_time - now).total_seconds()
                
                # Выполняем ТОЛЬКО если время УЖЕ наступило
                if time_until > 0:
                    # Еще рано - ждем
                    if time_until > 5 and (datetime.now() - last_check).total_seconds() >= 30:
                        scheduled_str: str = next_cmd.scheduled_time.strftime('%H:%M:%S')
                        log(f"[SCHEDULER] Waiting for '{next_cmd.name}' at {scheduled_str} (in {int(time_until)} sec)")
                        last_check = datetime.now()
                    
                    # Спим меньше времени если до выполнения осталось мало
                    sleep_time: float = min(1.0, max(0.1, time_until - 0.1))
                    await asyncio.sleep(sleep_time)
                    continue
                
                # ВРЕМЯ НАСТУПИЛО - выполняем
                db.refresh(next_cmd)
                if next_cmd.status == "pending":
                    now_str: str = datetime.now().strftime('%H:%M:%S')
                    scheduled_str = next_cmd.scheduled_time.strftime('%H:%M:%S')
                    actual_diff: float = (datetime.now() - next_cmd.scheduled_time).total_seconds()
                    log(f"[SCHEDULER] Executing '{next_cmd.name}' | Scheduled: {scheduled_str} | Now: {now_str} | Diff: {actual_diff:.1f}s")
                    
                    # Выполняем в отдельном потоке, чтобы не блокировать async loop
                    await asyncio.to_thread(scheduler_module.execute_scheduled_command, next_cmd, db)
                    last_check = datetime.now()
                
            finally:
                db.close()
            
        except Exception as e:
            log(f"[SCHEDULER] Error: {str(e)}", level="ERROR")
            traceback.print_exc()
            await asyncio.sleep(5)


async def shutdown_handler() -> None:
    """
    Выполняется при остановке приложения.
    
    Останавливает все компоненты для graceful shutdown.
    """
    log("[SHUTDOWN] Stopping all components...")
    
    # Останавливаем UDP listeners
    udp.stop_all_listeners()
    log("[SHUTDOWN] UDP listeners stopped")
    
    # Останавливаем Worker Pool (обработка оставшихся сообщений)
    try:
        from services.udp.worker_pool import stop_worker_pool, get_worker_pool
        pool = get_worker_pool()
        stats = pool.get_stats()
        log(f"[SHUTDOWN] Worker Pool stats: processed={stats.get('processed', 0)}, "
            f"dropped={stats.get('dropped', 0)}")
        stop_worker_pool()
        log("[SHUTDOWN] Worker Pool stopped")
    except Exception as e:
        log(f"[SHUTDOWN] Worker Pool stop skipped: {e}", level="DEBUG")
    
    # Останавливаем Batch Processor (flush remaining data)
    try:
        from services.udp.batch_processor import stop_batch_processor, get_batch_processor
        processor = get_batch_processor()
        stats = processor.get_stats()
        log(f"[SHUTDOWN] Batch Processor stats: items={stats.get('total_items', 0)}, "
            f"batches={stats.get('total_batches', 0)}")
        stop_batch_processor()
        log("[SHUTDOWN] Batch Processor stopped")
    except Exception as e:
        log(f"[SHUTDOWN] Batch Processor stop skipped: {e}", level="DEBUG")
    
    # Закрываем Redis соединение
    try:
        from services.redis_cache import close_redis_cache
        await close_redis_cache()
        log("[SHUTDOWN] Redis cache closed")
    except Exception as e:
        log(f"[SHUTDOWN] Redis close skipped: {e}", level="DEBUG")
    
    log("[SHUTDOWN] Complete")


def register_startup_events(app: 'FastAPI') -> None:
    """
    Зарегистрировать события запуска.
    
    Args:
        app: Экземпляр FastAPI приложения
    """
    @app.on_event("startup")
    async def startup_event() -> None:
        await startup_handler()


def register_shutdown_events(app: 'FastAPI') -> None:
    """
    Зарегистрировать события остановки.
    
    Args:
        app: Экземпляр FastAPI приложения
    """
    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        await shutdown_handler()
