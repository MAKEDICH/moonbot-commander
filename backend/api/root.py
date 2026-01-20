"""
Эндпоинт: GET /
Функция: root
"""

from main import app
from utils.config_loader import get_config_value


@app.get("/")
async def root():
    """Root endpoint"""
    app_name = get_config_value('app', 'app.name', default='MoonBot Commander')
    app_version = get_config_value('app', 'app.version', default='2.0.0')
    
    return {
        "message": app_name + " API",
        "version": app_version,
        "docs": "/docs"
    }