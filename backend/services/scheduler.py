"""
MoonBot Scheduler - Event-driven с проверкой состояния через файл

Планировщик для выполнения отложенных команд на серверах MoonBot.
Поддерживает:
- Одноразовые команды
- Повторяющиеся команды (daily, weekly, monthly, weekly_days)
- Выполнение на серверах и группах
- Интеграция с UDP listener для отправки команд
"""
import os
import sys
import time
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

# Если скрипт запускается напрямую, добавляем корень backend в sys.path
BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT: str = os.path.dirname(BASE_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from utils.logging import log, check_and_manage_all_logs
from utils.datetime_utils import utcnow
from services import encryption
from services.udp_client import UDPClient
from models import models
from models.database import SessionLocal

# Пути к файлам состояния планировщика
SCHEDULER_STATE_FILE: str = os.path.join(BASE_DIR, "scheduler_state.txt")
SCHEDULER_ENABLED_FILE: str = os.path.join(BASE_DIR, "scheduler_enabled.txt")


def is_scheduler_enabled() -> bool:
    """
    Проверка включен ли scheduler.
    
    Returns:
        bool: True если включен, False если выключен
    """
    if not os.path.exists(SCHEDULER_ENABLED_FILE):
        # По умолчанию ВЫКЛЮЧЕН
        with open(SCHEDULER_ENABLED_FILE, 'w', encoding='utf-8') as f:
            f.write('0')
        return False
    
    try:
        with open(SCHEDULER_ENABLED_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip() == '1'
    except OSError:
        return False


def set_scheduler_enabled(enabled: bool) -> None:
    """
    Включить/выключить scheduler.
    
    Args:
        enabled: True для включения, False для выключения
    """
    with open(SCHEDULER_ENABLED_FILE, 'w', encoding='utf-8') as f:
        f.write('1' if enabled else '0')
    log(f"[SCHEDULER] {'Enabled' if enabled else 'Disabled'}")


def get_scheduler_status() -> Dict[str, Any]:
    """
    Получить статус scheduler.
    
    Returns:
        Dict с информацией о статусе scheduler
    """
    return {
        "is_running": is_scheduler_enabled(),
        "enabled_file": SCHEDULER_ENABLED_FILE
    }


def migrate_old_state_files() -> None:
    """Миграция старых файлов состояния из корня backend в services."""
    old_state_file: str = os.path.join(BACKEND_ROOT, "scheduler_state.txt")
    old_enabled_file: str = os.path.join(BACKEND_ROOT, "scheduler_enabled.txt")

    if os.path.exists(old_state_file) and not os.path.exists(SCHEDULER_STATE_FILE):
        try:
            os.rename(old_state_file, SCHEDULER_STATE_FILE)
            log("Migrated scheduler_state.txt to services directory", level="INFO")
        except OSError as e:
            log(f"Error migrating scheduler_state.txt: {e}", level="ERROR")

    if os.path.exists(old_enabled_file) and not os.path.exists(SCHEDULER_ENABLED_FILE):
        try:
            os.rename(old_enabled_file, SCHEDULER_ENABLED_FILE)
            log("Migrated scheduler_enabled.txt to services directory", level="INFO")
        except OSError as e:
            log(f"Error migrating scheduler_enabled.txt: {e}", level="ERROR")


def get_next_pending_command(db: Session) -> Optional[models.ScheduledCommand]:
    """
    Получить ближайшую команду для выполнения.
    
    Args:
        db: Сессия базы данных
        
    Returns:
        ScheduledCommand или None если нет pending команд
    """
    return db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.status == "pending"
    ).order_by(models.ScheduledCommand.scheduled_time.asc()).first()


def calculate_next_execution_time(
    current_time: datetime, 
    recurrence_type: str, 
    weekdays_json: Optional[str] = None
) -> datetime:
    """
    Вычислить следующее время выполнения для повторяющихся команд.
    
    Args:
        current_time: Текущее время выполнения
        recurrence_type: Тип повторения (once, daily, weekly, monthly, weekly_days)
        weekdays_json: JSON строка с днями недели для weekly_days, например "[0,2,4]"
    
    Returns:
        datetime: Следующее время выполнения
    """
    if recurrence_type == 'daily':
        # Ежедневно - добавляем 1 день
        return current_time + timedelta(days=1)
    elif recurrence_type == 'weekly':
        # Еженедельно - добавляем 7 дней
        return current_time + timedelta(days=7)
    elif recurrence_type == 'monthly':
        # Ежемесячно - используем relativedelta для корректного расчета
        try:
            from dateutil.relativedelta import relativedelta
            return current_time + relativedelta(months=1)
        except ImportError:
            # Fallback если dateutil не установлен
            # Приблизительно 30 дней
            return current_time + timedelta(days=30)
    elif recurrence_type == 'weekly_days' and weekdays_json:
        # По дням недели - находим следующий подходящий день
        try:
            weekdays = json.loads(weekdays_json)
            if not weekdays:
                # Если дни не указаны - по умолчанию еженедельно
                return current_time + timedelta(days=7)
            
            # Текущий день недели (0=Понедельник, 6=Воскресенье)
            current_weekday = current_time.weekday()
            
            # Сортируем дни недели
            weekdays_sorted = sorted(weekdays)
            
            # Ищем следующий подходящий день
            days_to_add = None
            
            # Сначала ищем в текущей неделе (дни после текущего)
            for day in weekdays_sorted:
                if day > current_weekday:
                    days_to_add = day - current_weekday
                    break
            
            # Если не нашли - берем первый день из следующей недели
            if days_to_add is None:
                first_weekday = weekdays_sorted[0]
                days_to_add = 7 - current_weekday + first_weekday
            
            return current_time + timedelta(days=days_to_add)
            
        except (json.JSONDecodeError, ValueError) as e:
            log(f"[ERROR] Invalid weekdays JSON: {weekdays_json}, error: {e}", level="ERROR")
            # Fallback - еженедельно
            return current_time + timedelta(days=7)
    else:
        # По умолчанию - не повторяется
        return current_time


def execute_scheduled_command(command: models.ScheduledCommand, db: Session) -> None:
    """
    Выполнить отложенную команду.
    
    Args:
        command: Команда для выполнения
        db: Сессия базы данных
    """
    try:
        log(f"[EXEC] Starting: {command.name} (ID: {command.id})")
        command.status = "executing"
        db.commit()
        
        # Получаем связи с серверами и группами
        server_links: List[models.ScheduledCommandServer] = db.query(
            models.ScheduledCommandServer
        ).filter(
            models.ScheduledCommandServer.scheduled_command_id == command.id
        ).all()
        
        servers: List[models.Server] = []
        
        for link in server_links:
            if link.server_id is not None:
                # Это сервер
                server = db.query(models.Server).filter(
                    models.Server.id == link.server_id
                ).first()
                if server:
                    servers.append(server)
            elif link.group_name is not None:
                # Это группа - получаем все серверы из этой группы
                # Группы хранятся в поле group_name как comma-separated значения
                group_servers = db.query(models.Server).filter(
                    models.Server.group_name.like(f'%{link.group_name}%')
                ).all()
                
                # Дополнительная проверка: название группы должно точно совпадать
                for server in group_servers:
                    if server.group_name:
                        server_groups = [g.strip() for g in server.group_name.split(',')]
                        if link.group_name in server_groups:
                            servers.append(server)
        
        # Убираем дубликаты серверов (если сервер в нескольких выбранных группах)
        unique_servers = {s.id: s for s in servers}.values()
        servers = list(unique_servers)
        
        if not servers:
            raise Exception("No servers found")
        
        commands_list = [cmd.strip() for cmd in command.commands.split('\n') if cmd.strip()]
        
        # Импортируем UDP модуль для проверки активных listeners
        from services import udp
        
        for server in servers:
            password = encryption.decrypt_password(server.password) if server.password else None
            
            # Проверяем, есть ли активный listener для этого сервера
            listener = udp.active_listeners.get(server.id)
            
            for cmd in commands_list:
                if command.use_botname:
                    # Получаем имя бота из баланса если есть
                    balance = db.query(models.ServerBalance).filter(
                        models.ServerBalance.server_id == server.id
                    ).first()
                    bot_name = balance.bot_name if balance and balance.bot_name else server.name
                    full_cmd = f"{bot_name}:{cmd}"
                else:
                    full_cmd = cmd
                
                # Если listener активен - используем его для отправки
                if listener and listener.running:
                    log(f"[SCHEDULER] Sending command to server {server.id} through listener")
                    try:
                        success, response = listener.send_command_with_response(full_cmd, timeout=5.0)
                    except Exception as e:
                        log(f"[SCHEDULER] Error sending through listener: {e}")
                        success = False
                        response = str(e)
                else:
                    # Listener не активен - используем прямое подключение
                    log(f"[SCHEDULER] Sending command to server {server.id} directly (no listener)")
                    udp_client = UDPClient(timeout=5)
                    success, response = udp_client.send_command_sync(
                        command=full_cmd,
                        host=server.host,
                        port=server.port,
                        password=password,
                        bind_port=server.port
                    )
                
                # Сохраняем в историю
                history_entry = models.CommandHistory(
                    command=full_cmd,
                    response=response if success else None,
                    status="success" if success else "error",
                    user_id=command.user_id,
                    server_id=server.id
                )
                db.add(history_entry)
                
                time.sleep(0.5)
            
            if command.delay_between_bots > 0 and server != list(servers)[-1]:
                time.sleep(command.delay_between_bots)
        
        # Проверяем тип повторения команды
        recurrence_type = getattr(command, 'recurrence_type', 'once')
        
        if recurrence_type == 'once':
            # Одноразовая команда - помечаем как выполненную
            command.status = "completed"
            command.executed_at = datetime.now()
        else:
            # Повторяющаяся команда - планируем следующее выполнение
            weekdays_json = getattr(command, 'weekdays', None)
            next_time = calculate_next_execution_time(
                command.scheduled_time, 
                recurrence_type, 
                weekdays_json
            )
            command.scheduled_time = next_time
            command.status = "pending"
            command.executed_at = datetime.now()
            log(f"[RECURRING] Next execution scheduled for: {next_time} (type: {recurrence_type})")
        
        db.commit()
        
        log(f"[OK] Command {command.id} completed")
        
    except Exception as e:
        log(f"[ERROR] Failed: {str(e)}", level="ERROR")
        command.status = "failed"
        command.error_message = str(e)
        command.executed_at = datetime.now()
        db.commit()


def process_task(db: Session, task: models.ScheduledCommand) -> None:
    """
    Выполняет одну запланированную задачу (алиас для execute_scheduled_command).
    
    Args:
        db: Сессия базы данных
        task: Запланированная команда для выполнения
    """
    execute_scheduled_command(task, db)


def main() -> None:
    """Главный цикл - точное выполнение в заданное время."""
    # Инициализация логирования
    check_and_manage_all_logs()

    # Миграция старых файлов состояния
    migrate_old_state_files()

    log("[SCHEDULER] Started - Precise Execution Mode")
    
    # Удаляем старый state file
    if os.path.exists(SCHEDULER_STATE_FILE):
        os.remove(SCHEDULER_STATE_FILE)
    
    last_check = datetime.now()
    last_status_log = datetime.now()
    last_log_cleanup = datetime.now()
    
    while True:
        try:
            # Проверяем включен ли scheduler
            if not is_scheduler_enabled():
                # Логируем статус раз в 60 секунд
                if (datetime.now() - last_status_log).total_seconds() >= 60:
                    log("[SCHEDULER] PAUSED - Scheduler disabled by user")
                    last_status_log = datetime.now()
                # Спим 10 секунд когда выключен
                time.sleep(10)
                continue
            
            # Проверяем логи раз в час
            if (datetime.now() - last_log_cleanup).total_seconds() >= 3600:
                try:
                    check_and_manage_all_logs("logs")
                    last_log_cleanup = datetime.now()
                except Exception as e:
                    log(f"[ERROR] Failed to check logs: {e}", level="ERROR")
            
            db = SessionLocal()
            try:
                next_cmd = get_next_pending_command(db)
                
                if not next_cmd:
                    # Нет команд - логируем раз в 60 секунд
                    if (datetime.now() - last_check).total_seconds() >= 60:
                        log("[IDLE] No pending commands")
                        last_check = datetime.now()
                    time.sleep(5)
                    continue
                
                # Есть команда
                now = datetime.now()
                time_until = (next_cmd.scheduled_time - now).total_seconds()
                
                # КРИТИЧНО: Выполняем ТОЛЬКО если время УЖЕ наступило (time_until <= 0)
                if time_until > 0:
                    # Еще рано - ждем
                    # Логируем только если > 5 сек до выполнения, и не чаще раза в 30 сек
                    if time_until > 5 and (datetime.now() - last_check).total_seconds() >= 30:
                        scheduled_str = next_cmd.scheduled_time.strftime('%H:%M:%S')
                        log(f"[WAITING] '{next_cmd.name}' at {scheduled_str} (in {int(time_until)} sec)")
                        last_check = datetime.now()
                    
                    # Спим меньше времени если до выполнения осталось мало
                    sleep_time = min(1.0, max(0.1, time_until - 0.1))
                    time.sleep(sleep_time)
                    continue
                
                # ВРЕМЯ НАСТУПИЛО - выполняем ТОЧНО СЕЙЧАС
                db.refresh(next_cmd)
                if next_cmd.status == "pending":
                    now_str = datetime.now().strftime('%H:%M:%S')
                    scheduled_str = next_cmd.scheduled_time.strftime('%H:%M:%S')
                    actual_diff = (datetime.now() - next_cmd.scheduled_time).total_seconds()
                    log(f"[EXECUTE] '{next_cmd.name}' | Scheduled: {scheduled_str} | Now: {now_str} | Diff: {actual_diff:.1f}s")
                    execute_scheduled_command(next_cmd, db)
                    last_check = datetime.now()
                
            finally:
                db.close()
            
        except KeyboardInterrupt:
            log("\n[STOP] Stopped by user")
            break
        except Exception as e:
            log(f"[ERROR] {str(e)}", level="ERROR")
            import traceback
            traceback.print_exc()
            time.sleep(5)


if __name__ == "__main__":
    main()
