"""
Trading Stats Module

Модульная система для статистики торговли
"""
from .endpoint import register_endpoint

def setup(app):
    """Настроить модуль trading stats"""
    register_endpoint(app)

__all__ = ['setup', 'register_endpoint']

