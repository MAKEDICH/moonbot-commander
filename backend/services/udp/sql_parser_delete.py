"""
Обработка DELETE команд для SQL парсера
"""
import re
from sqlalchemy.orm import Session
from models import models
from utils.logging import log


class SQLParserDeleteMixin:
    """Методы для обработки DELETE команд"""
    
    def parse_delete_order(self, db: Session, sql: str, moonbot_order_id: int = None):
        """Обработка DELETE Orders команды"""
        try:
            if not moonbot_order_id:
                id_match = re.search(r'\[?ID\]?\s*=\s*(\d+)', sql, re.IGNORECASE)
                if not id_match:
                    log(f"[UDP-LISTENER-{self.server_id}] DELETE без ID: {sql[:80]}")
                    return
                moonbot_order_id = int(id_match.group(1))

            order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()

            if not order:
                log(f"[UDP-LISTENER-{self.server_id}] DELETE: ордер {moonbot_order_id} не найден")
                return

            log(f"[UDP-LISTENER-{self.server_id}] DELETE: удаляем ордер {moonbot_order_id}")
            db.delete(order)

        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] DELETE parse error: {e}")
            import traceback
            traceback.print_exc()



