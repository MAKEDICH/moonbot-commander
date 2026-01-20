#!/usr/bin/env python3
"""
MoonBot Status Checker

Проверяет статус всех компонентов high-load системы.
Запуск: python utils/check_status.py
"""
import os
import sys

# Добавляем путь для импортов
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Переименовываем стандартный logging чтобы избежать конфликта
import logging as std_logging
std_logging.basicConfig(level=std_logging.WARNING)

def check_status():
    print("=" * 60)
    print("  MoonBot Commander - System Status Check")
    print("=" * 60)
    print()
    
    # 1. Режим работы
    from utils.config_loader import get_config_value
    mode_env = get_config_value('app', 'mode.moonbot_mode_env', default='MOONBOT_MODE')
    default_mode = get_config_value('app', 'mode.default_mode', default='server')
    moonbot_mode = os.getenv(mode_env, default_mode).lower().strip()
    
    print(f"[MODE] MOONBOT_MODE = {moonbot_mode}")
    if moonbot_mode == 'server':
        print("       ✅ SERVER mode (global UDP socket, no keep-alive)")
    elif moonbot_mode == 'local':
        print("       ⚠️ LOCAL mode (separate sockets, keep-alive)")
    else:
        print(f"       ❓ Unknown mode: {moonbot_mode}")
    print()
    
    # 2. База данных
    db_url = os.getenv('DATABASE_URL', 'sqlite:///./moonbot_commander.db')
    print(f"[DATABASE] URL = {db_url[:50]}...")
    if db_url.startswith('sqlite'):
        print("       ✅ SQLite (optimized: WAL mode, 64MB cache)")
        print("       💡 For 3000+ servers PostgreSQL is recommended")
    elif db_url.startswith('postgresql'):
        print("       ✅ PostgreSQL (high-load optimized)")
    print()
    
    # 3. Worker Pool
    try:
        from services.udp.worker_pool import get_worker_pool
        pool = get_worker_pool()
        if pool and pool.running:
            stats = pool.get_stats()
            print(f"[WORKER POOL] ✅ Running")
            print(f"       Workers: {pool.num_workers}")
            print(f"       Queue size: {pool.queue_size}")
            print(f"       Processed: {stats.get('processed', 0)}")
        else:
            print("[WORKER POOL] ❌ Not running")
    except Exception as e:
        print(f"[WORKER POOL] ❌ Error: {e}")
    print()
    
    # 4. Batch Processor
    try:
        from services.udp.batch_processor import get_batch_processor
        processor = get_batch_processor()
        if processor and processor.running:
            stats = processor.get_stats()
            print(f"[BATCH PROCESSOR] ✅ Running")
            print(f"       Batch size: {processor.batch_size}")
            print(f"       Flush interval: {processor.flush_interval_ms}ms")
            print(f"       Total batches: {stats.get('total_batches', 0)}")
        else:
            print("[BATCH PROCESSOR] ❌ Not running")
    except Exception as e:
        print(f"[BATCH PROCESSOR] ❌ Error: {e}")
    print()
    
    # 5. Global UDP Socket
    try:
        from services.udp.manager import global_udp_socket
        if global_udp_socket and global_udp_socket.running:
            print(f"[GLOBAL UDP SOCKET] ✅ Running on port {global_udp_socket.port}")
            print(f"       Registered listeners: {len(global_udp_socket.listeners)}")
        else:
            if moonbot_mode == 'server':
                print("[GLOBAL UDP SOCKET] ⚠️ Not yet initialized (starts on first server)")
            else:
                print("[GLOBAL UDP SOCKET] ℹ️ Not used in LOCAL mode")
    except Exception as e:
        print(f"[GLOBAL UDP SOCKET] ❌ Error: {e}")
    print()
    
    # 6. Redis
    try:
        redis_url = os.getenv('REDIS_URL', '')
        if redis_url:
            print(f"[REDIS] URL = {redis_url}")
            print("       (Check connection on startup)")
        else:
            print("[REDIS] ℹ️ Not configured (using in-memory cache)")
    except Exception as e:
        print(f"[REDIS] ❌ Error: {e}")
    print()
    
    # 7. Servers count
    try:
        from models.database import SessionLocal
        from models import models
        db = SessionLocal()
        total = db.query(models.Server).count()
        active = db.query(models.Server).filter(models.Server.is_active == True).count()
        db.close()
        print(f"[SERVERS] Total: {total}, Active: {active}")
        if total > 500:
            print("       💡 High server count - ensure all optimizations are enabled")
    except Exception as e:
        print(f"[SERVERS] ❌ Error: {e}")
    print()
    
    print("=" * 60)
    print("  Check complete!")
    print("=" * 60)


if __name__ == '__main__':
    check_status()

