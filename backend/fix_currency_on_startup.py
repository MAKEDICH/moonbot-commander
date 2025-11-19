"""
Автоматическое исправление валют при запуске
"""
import os
from database import SessionLocal, engine
import models
import logging

logger = logging.getLogger(__name__)

def fix_server_currencies():
    """
    Устанавливает валюты серверов на основе имени или USDT по умолчанию
    Запускается при старте приложения
    """
    try:
        db = SessionLocal()
        
        # Получаем все серверы без валюты
        servers_without_currency = db.query(models.Server).filter(
            (models.Server.default_currency == None) | 
            (models.Server.default_currency == '')
        ).all()
        
        if servers_without_currency:
            logger.info(f"Found {len(servers_without_currency)} servers without currency, fixing...")
            
            for server in servers_without_currency:
                # Пытаемся определить валюту по имени сервера
                name_lower = server.name.lower()
                
                # Проверяем популярные валюты в имени
                if 'try' in name_lower or 'tr' in name_lower:
                    currency = 'TRY'
                elif 'usdc' in name_lower:
                    currency = 'USDC'
                elif 'bnb' in name_lower:
                    currency = 'BNB'
                elif 'btc' in name_lower:
                    currency = 'BTC'
                elif 'eth' in name_lower:
                    currency = 'ETH'
                else:
                    # По умолчанию USDT
                    currency = 'USDT'
                
                server.default_currency = currency
                logger.info(f"Server '{server.name}' currency set to {currency}")
            
            db.commit()
            logger.info("All server currencies fixed")
        
        db.close()
        
    except Exception as e:
        logger.error(f"Error fixing server currencies: {e}")
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    fix_server_currencies()


