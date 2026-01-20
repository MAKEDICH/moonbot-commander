"""Добавление таблицы cleanup_settings"""
from sqlalchemy import create_engine
from models.database import Base, SessionLocal, engine
from models.models import CleanupSettings


def migrate():
    Base.metadata.create_all(bind=engine, tables=[CleanupSettings.__table__])
    print("OK: Tablica cleanup_settings sozdana")


if __name__ == "__main__":
    migrate()

