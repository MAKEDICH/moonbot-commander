"""
MoonBot Scheduler - Event-driven с проверкой состояния через файл
"""
import time
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from udp_client import UDPClient
import encryption
from logger_utils import log, check_and_manage_all_logs


SCHEDULER_STATE_FILE = "scheduler_state.txt"
SCHEDULER_ENABLED_FILE = "scheduler_enabled.txt"


def is_scheduler_enabled():
    """Проверка включен ли scheduler"""
    if not os.path.exists(SCHEDULER_ENABLED_FILE):
        # По умолчанию ВЫКЛЮЧЕН
        with open(SCHEDULER_ENABLED_FILE, 'w') as f:
            f.write('0')
        return False
    
    try:
        with open(SCHEDULER_ENABLED_FILE, 'r') as f:
            return f.read().strip() == '1'
    except:
        return False


def set_scheduler_enabled(enabled: bool):
    """Включить/выключить scheduler"""
    with open(SCHEDULER_ENABLED_FILE, 'w') as f:
        f.write('1' if enabled else '0')
    log(f"[SCHEDULER] {'Enabled' if enabled else 'Disabled'}")

def execute_scheduled_command(command: models.ScheduledCommand, db: Session):
    """Выполнить отложенную команду"""
    try:
        log(f"[EXEC] Starting: {command.name} (ID: {command.id})")
        command.status = "executing"
        db.commit()
        
        # Получаем серверы
        server_links = db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command.id
        ).all()
        
        servers = []
        
        for link in server_links:
            if link.server_id > 0:
                server = db.query(models.Server).filter(models.Server.id == link.server_id).first()
                if server:
                    servers.append(server)
            else:
                group_id = -link.server_id
                group = db.query(models.Group).filter(models.Group.id == group_id).first()
                if group:
                    group_servers = db.query(models.Server).filter(
                        models.Server.id.in_(group.server_ids)
                    ).all()
                    servers.extend(group_servers)
        
        unique_servers = {s.id: s for s in servers}.values()
        servers = list(unique_servers)
        
        if not servers:
            raise Exception("No servers found")
        
        commands_list = [cmd.strip() for cmd in command.commands.split('\n') if cmd.strip()]
        
        for server in servers:
            password = encryption.decrypt_password(server.password)
            
            # ВАЖНО: Проверяем, есть ли активный listener для этого сервера
            import udp_listener
            listener = udp_listener.active_listeners.get(server.id)
            
            for cmd in commands_list:
                if command.use_botname:
                    full_cmd = f"{server.botname}:{cmd}"
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
            next_time = calculate_next_execution_time(command.scheduled_time, recurrence_type, weekdays_json)
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


def calculate_next_execution_time(current_time: datetime, recurrence_type: str, weekdays_json: str = None) -> datetime:
    """Вычислить следующее время выполнения для повторяющихся команд
    
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
        from dateutil.relativedelta import relativedelta
        return current_time + relativedelta(months=1)
    elif recurrence_type == 'weekly_days' and weekdays_json:
        # По дням недели - находим следующий подходящий день
        import json
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
            log(f"[ERROR] Invalid weekdays JSON: {weekdays_json}, error: {e}", level="ERROR")            # Fallback - еженедельно
            return current_time + timedelta(days=7)
    else:
        # По умолчанию - не повторяется
        return current_time


def get_next_pending_command(db: Session):
    """Получить ближайшую команду"""
    return db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.status == "pending"
    ).order_by(models.ScheduledCommand.scheduled_time.asc()).first()


def main():
    """Главный цикл - точное выполнение в заданное время"""
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
                # Логируем статус раз в 60 секунд (не 30)
                if (datetime.now() - last_status_log).total_seconds() >= 60:
                    log("[SCHEDULER] PAUSED - Scheduler disabled by user")
                    last_status_log = datetime.now()
                # Спим 10 секунд вместо 5 когда выключен
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
