"""
WebSocket endpoint

Обработчик WebSocket соединений
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Optional
import uuid
from services.websocket_manager import ws_manager
from services import auth
from utils.logging import log


async def websocket_handler(websocket: WebSocket, token: Optional[str] = None):
    """Обработчик WebSocket соединений"""
    user_id = None
    connection_id = str(uuid.uuid4())  # Генерируем уникальный ID соединения
    
    # Аутентификация через токен
    if token:
        payload = auth.decode_access_token(token)
        if payload:
            username = payload.get("sub")
            if username:
                from models.database import SessionLocal
                from models import models
                db = SessionLocal()
                try:
                    user = db.query(models.User).filter(
                        models.User.username == username).first()
                    if user:
                        user_id = user.id
                finally:
                    db.close()
    
    if user_id is None:
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    await ws_manager.connect(websocket, user_id, connection_id)
    log(f"[WEBSOCKET] User {user_id} connected (connection_id: {connection_id})")
    
    try:
        while True:
            # Ждем сообщения от клиента (опционально - для ping/pong)
            data = await websocket.receive_text()
            
            # Можно обрабатывать команды от клиента
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        await ws_manager.disconnect(user_id, connection_id)
        log(f"[WEBSOCKET] User {user_id} disconnected (connection_id: {connection_id})")
    except Exception as e:
        log(f"[WEBSOCKET] Error for user {user_id}: {e}", level="ERROR")
        await ws_manager.disconnect(user_id, connection_id)


def register_websocket_endpoint(app):
    """Зарегистрировать WebSocket endpoint"""
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
        await websocket_handler(websocket, token)


