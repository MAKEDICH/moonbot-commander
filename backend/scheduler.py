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
    print(f"[SCHEDULER] {'Enabled' if enabled else 'Disabled'}")


def execute_scheduled_command(command: models.ScheduledCommand, db: Session):
    """Выполнить отложенную команду"""
    try:
        print(f"[EXEC] Starting: {command.name} (ID: {command.id})")
        
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
        udp_client = UDPClient(timeout=5)
        
        for server in servers:
            password = encryption.decrypt_password(server.password)
            
            for cmd in commands_list:
                if command.use_botname:
                    full_cmd = f"{server.botname}:{cmd}"
                else:
                    full_cmd = cmd
                
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
        
        command.status = "completed"
        command.executed_at = datetime.now()
        db.commit()
        
        print(f"[OK] Command {command.id} completed")
        
    except Exception as e:
        print(f"[ERROR] Failed: {str(e)}")
        command.status = "failed"
        command.error_message = str(e)
        command.executed_at = datetime.now()
        db.commit()


def get_next_pending_command(db: Session):
    """Получить ближайшую команду"""
    return db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.status == "pending"
    ).order_by(models.ScheduledCommand.scheduled_time.asc()).first()


def main():
    """Главный цикл - точное выполнение в заданное время"""
    print("[SCHEDULER] Started - Precise Execution Mode")
    
    # Удаляем старый state file
    if os.path.exists(SCHEDULER_STATE_FILE):
        os.remove(SCHEDULER_STATE_FILE)
    
    last_check = datetime.now()
    last_status_log = datetime.now()
    
    while True:
        try:
            # Проверяем включен ли scheduler
            if not is_scheduler_enabled():
                # Логируем статус раз в 60 секунд (не 30)
                if (datetime.now() - last_status_log).total_seconds() >= 60:
                    print("[SCHEDULER] PAUSED - Scheduler disabled by user")
                    last_status_log = datetime.now()
                # Спим 10 секунд вместо 5 когда выключен
                time.sleep(10)
                continue
            
            db = SessionLocal()
            try:
                next_cmd = get_next_pending_command(db)
                
                if not next_cmd:
                    # Нет команд - логируем раз в 60 секунд
                    if (datetime.now() - last_check).total_seconds() >= 60:
                        print("[IDLE] No pending commands")
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
                        print(f"[WAITING] '{next_cmd.name}' at {scheduled_str} (in {int(time_until)}s)")
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
                    print(f"[EXECUTE] '{next_cmd.name}' | Scheduled: {scheduled_str} | Now: {now_str} | Diff: {actual_diff:.1f}s")
                    execute_scheduled_command(next_cmd, db)
                    last_check = datetime.now()
                
            finally:
                db.close()
            
        except KeyboardInterrupt:
            print("\n[STOP] Stopped by user")
            break
        except Exception as e:
            print(f"[ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            time.sleep(5)


if __name__ == "__main__":
    main()
