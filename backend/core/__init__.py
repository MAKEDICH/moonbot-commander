"""
Core module

Основные компоненты приложения
"""
from .config import create_app, setup_cors, limiter
from .events import register_startup_events, register_shutdown_events
from .websocket import register_websocket_endpoint
from .commands_reference import BOT_COMMANDS_REFERENCE

__all__ = [
    'create_app',
    'setup_cors',
    'limiter',
    'register_startup_events',
    'register_shutdown_events',
    'register_websocket_endpoint',
    'BOT_COMMANDS_REFERENCE'
]

