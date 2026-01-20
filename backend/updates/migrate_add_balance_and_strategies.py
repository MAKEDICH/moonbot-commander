"""Добавление таблиц server_balance и strategy_cache"""
from sqlalchemy import create_engine
from models.database import Base, engine
from models.models import ServerBalance, StrategyCache


def migrate():
    Base.metadata.create_all(bind=engine, tables=[
        ServerBalance.__table__,
        StrategyCache.__table__
    ])
    print("OK: Tablicy server_balance i strategy_cache sozdany")


if __name__ == "__main__":
    migrate()

