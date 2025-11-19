from fastapi import FastAPI, Depends, HTTPException, status, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import os
import re
import uuid
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import models
import schemas
import auth
import encryption
import recovery
import totp
import ip_validator
from database import engine, get_db, SessionLocal
from udp_client import UDPClient, test_connection
from websocket_manager import ws_manager
from api.routers import cleanup, strategies
from logger_utils import log, get_logger
from update_checker import update_checker, check_update_on_startup
from auto_migrate import run_auto_migrations

# Автоматическое применение миграций
try:
    run_auto_migrations()
except Exception as e:
    print(f"Warning: Auto-migration failed: {e}")

# Создание таблиц
models.Base.metadata.create_all(bind=engine)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="MoonBot UDP Commander",
    description="Профессиональное приложение для удаленного управления торговыми ботами MoonBot через UDP",
    version="1.0.0"
)

# Добавляем rate limiter в app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS настройки - безопасные origins
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(',')]

# Добавляем динамический origin для production
# Если запущено на сервере, добавляем его адрес
import socket
try:
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    cors_origins.append(f"http://{local_ip}:3000")
    cors_origins.append(f"https://{local_ip}:3000")
except:
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# UDP клиент
udp_client = UDPClient()


# Helper function для расшифровки пароля
def get_decrypted_password(server: models.Server) -> Optional[str]:
    """Расшифровать UDP пароль сервера"""
    if not server.password:
        return None
    return encryption.decrypt_password(server.password)


# Dependency для получения текущего пользователя
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = auth.decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    
    return user


# ==================== SYSTEM RESET ENDPOINT (CRITICAL - BEFORE ALL OTHER ENDPOINTS) ====================

@app.post("/api/system/reset")
def api_system_reset(
    reset_data: schemas.SystemResetRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Полный сброс системы - удаление всех данных
    Требует специальный код доступа: aezakmi
    """
    # Проверка кода доступа
    if reset_data.code.lower() != "aezakmi":
        raise HTTPException(status_code=403, detail="Неверный код доступа")
    
    try:
        log("[SYSTEM RESET] WARNING: Starting complete system wipe...", level="WARNING")
        log(f"[SYSTEM RESET] Initiated by user: {current_user.username}")        
        # Удаляем все данные из всех таблиц (в правильном порядке из-за foreign keys)
        db.query(models.CommandHistory).delete()
        db.query(models.ScheduledCommandServer).delete()
        db.query(models.ScheduledCommand).delete()
        db.query(models.CommandPreset).delete()
        db.query(models.QuickCommand).delete()
        db.query(models.MoonBotOrder).delete()
        db.query(models.SQLCommandLog).delete()
        db.query(models.UDPListenerStatus).delete()
        db.query(models.ServerStatus).delete()
        db.query(models.Server).delete()
        db.query(models.TwoFactorAttempt).delete()
        db.query(models.RecoveryCode).delete()
        db.query(models.UserSettings).delete()
        db.query(models.User).delete()
        db.query(models.SchedulerSettings).delete()
        db.query(models.CommandImage).delete()
        
        db.commit()
        
        log("[SYSTEM RESET] OK: All database tables wiped")
        
        # Останавливаем все UDP listeners
        try:
            import udp_listener
            for listener in udp_listener.active_listeners.values():
                if listener.running:
                    listener.stop()
            udp_listener.active_listeners.clear()
            log("[SYSTEM RESET] OK: All UDP listeners stopped")
        except Exception as e:
            log(f"[SYSTEM RESET] WARNING: Could not stop UDP listeners: {e}", level="WARNING")
        
        log("[SYSTEM RESET] OK: System reset completed successfully")        
        return {
            "success": True,
            "message": "Система успешно сброшена. Все данные удалены."
        }
        
    except Exception as e:
        log(f"[SYSTEM RESET] ERROR: {str(e)}", level="ERROR")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при сбросе системы: {str(e)}")


# Подключение роутеров для cleanup и strategies
app.include_router(cleanup.router, prefix="/api/cleanup", tags=["cleanup"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["strategies"])


# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")  # Максимум 5 регистраций в час с одного IP
def register(request: Request, user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверка существующего пользователя
    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # Создание нового пользователя
    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Генерируем recovery коды
    plain_codes = recovery.generate_recovery_codes(10)
    
    # Сохраняем хешированные коды в БД
    for code in plain_codes:
        code_hash = recovery.hash_recovery_code(code)
        recovery_code = models.RecoveryCode(
            user_id=new_user.id,
            code_hash=code_hash
        )
        db.add(recovery_code)
    
    db.commit()
    
    return {
        "user": new_user,
        "recovery_codes": plain_codes
    }


@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")  # Максимум 10 попыток входа в минуту
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Вход в систему (по username или email)"""
    # Ищем пользователя по username или email
    user = db.query(models.User).filter(
        (models.User.username == form_data.username) | (models.User.email == form_data.username)
    ).first()
    
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Пользователь неактивен")
    
    # Если у пользователя включен 2FA - не даем токен сразу
    if user.totp_enabled:
        return {
            "access_token": "2FA_REQUIRED",
            "token_type": "2fa_required",
            "username": user.username
        }
    
    access_token = auth.create_access_token(data={"sub": user.username})
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=schemas.User)
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Получение информации о текущем пользователе"""
    return current_user


@app.put("/api/auth/change-password")
async def change_password(
    password_data: schemas.PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Изменение пароля пользователя"""
    # Проверяем текущий пароль
    if not auth.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Проверяем что новый пароль отличается от текущего
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего"
        )
    
    # Обновляем пароль
    current_user.hashed_password = auth.get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Пароль успешно изменен"}


@app.post("/api/auth/recover-password")
async def recover_password(
    recovery_data: schemas.PasswordRecovery,
    db: Session = Depends(get_db)
):
    """Восстановление пароля через recovery код (принимает username или email)"""
    # Находим пользователя по username или email
    user = db.query(models.User).filter(
        (models.User.username == recovery_data.username) | (models.User.email == recovery_data.username)
    ).first()
    
    if not user:
        # Не сообщаем что пользователь не найден (безопасность)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или recovery код"
        )
    
    # Получаем неиспользованные recovery коды пользователя
    recovery_codes = db.query(models.RecoveryCode).filter(
        models.RecoveryCode.user_id == user.id,
        models.RecoveryCode.used == False
    ).all()
    
    if not recovery_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас не осталось recovery кодов. Обратитесь к администратору."
        )
    
    # Проверяем введенный код против всех неиспользованных кодов
    valid_code = None
    for code_record in recovery_codes:
        if recovery.verify_recovery_code(recovery_data.recovery_code, code_record.code_hash):
            valid_code = code_record
            break
    
    if not valid_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или recovery код"
        )
    
    # Помечаем код как использованный
    valid_code.used = True
    valid_code.used_at = datetime.utcnow()
    
    # Обновляем пароль
    user.hashed_password = auth.get_password_hash(recovery_data.new_password)
    
    db.commit()
    
    # Считаем оставшиеся коды
    remaining_codes = db.query(models.RecoveryCode).filter(
        models.RecoveryCode.user_id == user.id,
        models.RecoveryCode.used == False
    ).count()
    
    return {
        "message": "Пароль успешно восстановлен",
        "remaining_codes": remaining_codes
    }


@app.post("/api/auth/2fa/recover-password")
@limiter.limit("5/hour")  # Строгий rate limiting для восстановления пароля
async def recover_password_2fa(
    request: Request,
    recovery_data: schemas.TwoFactorRecovery,
    db: Session = Depends(get_db)
):
    """
    Восстановление пароля через Google Authenticator код (принимает username или email)
    
    - Максимум 3 неудачных попытки за 15 минут
    - После 3 попыток блокировка на 15 минут
    """
    # Находим пользователя по username или email
    user = db.query(models.User).filter(
        (models.User.username == recovery_data.username) | (models.User.email == recovery_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или код"
        )
    
    # Проверяем что у пользователя включен 2FA
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У этого пользователя не настроен Google Authenticator"
        )
    
    # Проверка количества неудачных попыток (более строго чем для логина)
    fifteen_minutes_ago = datetime.utcnow() - timedelta(minutes=15)
    
    failed_attempts = db.query(models.TwoFactorAttempt)\
        .filter(
            models.TwoFactorAttempt.username == recovery_data.username,
            models.TwoFactorAttempt.success == False,
            models.TwoFactorAttempt.attempt_time >= fifteen_minutes_ago
        )\
        .count()
    
    if failed_attempts >= 3:  # Для восстановления пароля лимит строже: 3 попытки
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток восстановления. Попробуйте через 15 минут."
        )
    
    # Получаем IP адрес клиента
    client_ip = request.client.host if request.client else "unknown"
    
    # Проверяем TOTP код
    is_valid = totp.verify_totp_code(user.totp_secret, recovery_data.totp_code)
    
    # Записываем попытку
    attempt = models.TwoFactorAttempt(
        username=recovery_data.username,
        success=is_valid,
        ip_address=client_ip
    )
    db.add(attempt)
    db.commit()
    
    if not is_valid:
        remaining_attempts = 3 - (failed_attempts + 1)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный код. Осталось попыток: {remaining_attempts}"
        )
    
    # Успешная проверка - очищаем попытки
    db.query(models.TwoFactorAttempt)\
        .filter(models.TwoFactorAttempt.username == recovery_data.username)\
        .delete()
    db.commit()
    
    # Обновляем пароль
    user.hashed_password = auth.get_password_hash(recovery_data.new_password)
    db.commit()
    
    return {
        "message": "Пароль успешно восстановлен через Google Authenticator"
    }


@app.get("/api/auth/2fa/setup")
async def setup_2fa(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Генерация QR-кода для настройки Google Authenticator"""
    # Генерируем новый секрет если его нет
    if not current_user.totp_secret:
        current_user.totp_secret = totp.generate_totp_secret()
        db.commit()
        db.refresh(current_user)
    
    # Создаем provisioning URI
    uri = totp.get_totp_uri(current_user.username, current_user.totp_secret)
    
    # Генерируем QR-код
    qr_code = totp.generate_qr_code(uri)
    
    return {
        "secret": current_user.totp_secret,
        "qr_code": qr_code,
        "enabled": current_user.totp_enabled
    }


@app.post("/api/auth/2fa/enable")
async def enable_2fa(
    verify_data: schemas.TwoFactorVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Включение 2FA после проверки кода"""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала настройте 2FA через /api/auth/2fa/setup"
        )
    
    # Проверяем код
    if not totp.verify_totp_code(current_user.totp_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код. Проверьте время на устройстве."
        )
    
    # Включаем 2FA
    current_user.totp_enabled = True
    db.commit()
    
    return {"message": "2FA успешно включен"}


@app.post("/api/auth/2fa/disable")
async def disable_2fa(
    verify_data: schemas.TwoFactorVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отключение 2FA"""
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA не включен"
        )
    
    # Проверяем код перед отключением
    if not totp.verify_totp_code(current_user.totp_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код"
        )
    
    # Отключаем 2FA
    current_user.totp_enabled = False
    db.commit()
    
    return {"message": "2FA отключен"}


@app.post("/api/auth/2fa/verify")
@limiter.limit("10/minute")  # Rate limiting для 2FA
async def verify_2fa(
    request: Request,
    verify_data: schemas.TwoFactorVerify,
    username: str,
    db: Session = Depends(get_db)
):
    """
    Проверка 2FA кода при логине с защитой от brute-force
    
    - Максимум 5 неудачных попыток за 15 минут
    - После 5 попыток блокировка на 15 минут
    """
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if not user or not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA не настроен"
        )
    
    # Проверка количества неудачных попыток за последние 15 минут
    fifteen_minutes_ago = datetime.utcnow() - timedelta(minutes=15)
    
    failed_attempts = db.query(models.TwoFactorAttempt)\
        .filter(
            models.TwoFactorAttempt.username == username,
            models.TwoFactorAttempt.success == False,
            models.TwoFactorAttempt.attempt_time >= fifteen_minutes_ago
        )\
        .count()
    
    if failed_attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток. Попробуйте через 15 минут."
        )
    
    # Получаем IP адрес клиента
    client_ip = request.client.host if request.client else "unknown"
    
    # Проверяем 2FA код
    is_valid = totp.verify_totp_code(user.totp_secret, verify_data.code)
    
    # Записываем попытку в БД
    attempt = models.TwoFactorAttempt(
        username=username,
        success=is_valid,
        ip_address=client_ip
    )
    db.add(attempt)
    db.commit()
    
    if not is_valid:
        remaining_attempts = 5 - (failed_attempts + 1)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Неверный код. Осталось попыток: {remaining_attempts}"
        )
    
    # Успешная авторизация - очищаем старые попытки (опционально)
    db.query(models.TwoFactorAttempt)\
        .filter(models.TwoFactorAttempt.username == username)\
        .delete()
    db.commit()
    
    # Создаем токен
    access_token = auth.create_access_token(data={"sub": user.username})
    
    return {"access_token": access_token, "token_type": "bearer"}


# ==================== SERVER ENDPOINTS ====================

@app.get("/api/servers", response_model=List[schemas.Server])
def get_servers(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка серверов пользователя"""
    servers = db.query(models.Server)\
        .filter(models.Server.user_id == current_user.id)\
        .offset(skip).limit(limit).all()
    return servers


@app.get("/api/trading/currencies")
def get_trading_currencies(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка валют, по которым есть любые сделки"""
    # Получаем все серверы пользователя
    servers = db.query(models.Server).filter(models.Server.user_id == current_user.id).all()
    
    # Собираем валюты, по которым есть сделки
    currencies_with_trades = set()
    
    for server in servers:
        # Проверяем есть ли вообще сделки для этого сервера
        has_trades = db.query(models.MoonBotOrder)\
            .filter(models.MoonBotOrder.server_id == server.id)\
            .first() is not None
        
        # Если есть сделки и задана валюта, добавляем её
        if has_trades and server.default_currency:
            currencies_with_trades.add(server.default_currency)
    
    # Если нет валют с сделками, возвращаем USDT по умолчанию
    if not currencies_with_trades:
        currencies_with_trades = {'USDT'}
    
    return {
        "currencies": sorted(list(currencies_with_trades)),
        "count": len(currencies_with_trades)
    }


@app.get("/api/servers/balances")
def get_server_balances(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить балансы всех серверов пользователя"""
    servers = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()
    
    result = []
    for server in servers:
        # Получаем последний баланс для сервера
        balance = db.query(models.ServerBalance).filter(
            models.ServerBalance.server_id == server.id
        ).first()
        
        result.append({
            "server_id": server.id,
            "server_name": server.name,
            "host": server.host,
            "port": server.port,
            "is_active": server.is_active,
            "bot_name": balance.bot_name if balance else None,
            "available": float(balance.available) if balance and balance.available else 0.0,
            "total": float(balance.total) if balance and balance.total else 0.0,
            "default_currency": server.default_currency or "USDT",  # 💱 Валюта сервера
            "updated_at": balance.updated_at.isoformat() if balance and balance.updated_at else None,
        })
    
    return result


@app.get("/api/servers/{server_id}", response_model=schemas.Server)
def get_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение информации о конкретном сервере"""
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    return server


@app.post("/api/servers", response_model=schemas.Server, status_code=status.HTTP_201_CREATED)
def create_server(
    server_data: schemas.ServerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание нового сервера"""
    # ВАЛИДАЦИЯ: Проверка host (защита от SSRF)
    # Передаем allow_localhost=True если пользователь установил флаг is_localhost
    is_valid_host, host_error = ip_validator.validate_host(
        server_data.host,
        allow_localhost=server_data.is_localhost
    )
    if not is_valid_host:
        raise HTTPException(status_code=400, detail=f"Недопустимый хост: {host_error}")
    
    # ВАЛИДАЦИЯ: Проверка порта
    is_valid_port, port_error = ip_validator.validate_port(server_data.port)
    if not is_valid_port:
        raise HTTPException(status_code=400, detail=f"Недопустимый порт: {port_error}")
    
    data = server_data.model_dump()
    
    # Шифруем пароль перед сохранением
    if data.get('password'):
        data['password'] = encryption.encrypt_password(data['password'])
    
    new_server = models.Server(
        **data,
        user_id=current_user.id
    )
    
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    
    # Автоматически запускаем UDP Listener для нового сервера если он активен
    if new_server.is_active:
        try:
            password = None
            if new_server.password:
                password = encryption.decrypt_password(new_server.password)
            
            success = udp_listener.start_listener(
                server_id=new_server.id,
                host=new_server.host,
                port=new_server.port,
                password=password,
                keepalive_enabled=new_server.keepalive_enabled
            )
            
            if success:
                log(f"[CREATE-SERVER] OK: Listener started for server {new_server.id}: {new_server.name}")
            else:
                log(f"[CREATE-SERVER] FAIL: Failed to start listener for server {new_server.id}", level="ERROR")
        except Exception as e:
            log(f"[CREATE-SERVER] Error starting listener: {e}")    
    return new_server


@app.put("/api/servers/{server_id}", response_model=schemas.Server)
def update_server(
    server_id: int,
    server_data: schemas.ServerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление сервера"""
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # ВАЛИДАЦИЯ: Если меняется host, проверяем его
    if server_data.host is not None and server_data.host != server.host:
        # Берем is_localhost из запроса если указано, иначе из существующего сервера
        allow_localhost = server_data.is_localhost if server_data.is_localhost is not None else server.is_localhost
        is_valid_host, host_error = ip_validator.validate_host(
            server_data.host,
            allow_localhost=allow_localhost
        )
        if not is_valid_host:
            raise HTTPException(status_code=400, detail=f"Недопустимый хост: {host_error}")
    
    update_data = server_data.model_dump(exclude_unset=True)
    
    # Запоминаем старое состояние is_active
    old_is_active = server.is_active
    
    # Шифруем пароль если он обновляется И он НЕ зашифрован
    if 'password' in update_data and update_data['password']:
        # Проверяем, не зашифрован ли уже пароль (Fernet signature начинается с gAAAAA)
        if not update_data['password'].startswith('gAAAAA'):
            update_data['password'] = encryption.encrypt_password(update_data['password'])
        # Если пароль уже зашифрован, оставляем как есть
    for field, value in update_data.items():
        setattr(server, field, value)
    
    server.updated_at = datetime.now()
    db.commit()
    db.refresh(server)
    
    # Управление UDP Listener при изменении is_active
    if 'is_active' in update_data:
        if server.is_active and not old_is_active:
            # Сервер был выключен, теперь включен - запускаем listener
            try:
                password = None
                if server.password:
                    password = encryption.decrypt_password(server.password)
                
                success = udp_listener.start_listener(
                    server_id=server.id,
                    host=server.host,
                    port=server.port,
                    password=password,
                    keepalive_enabled=server.keepalive_enabled
                )
                
                if success:
                    log(f"[UPDATE-SERVER] OK: Listener started for server {server.id}: {server.name}")
                else:
                    log(f"[UPDATE-SERVER] FAIL: Failed to start listener for server {server.id}", level="ERROR")
            except Exception as e:
                log(f"[UPDATE-SERVER] Error starting listener: {e}")                
        elif not server.is_active and old_is_active:
            # Сервер был включен, теперь выключен - останавливаем listener
            try:
                udp_listener.stop_listener(server.id)
                log(f"[UPDATE-SERVER] OK: Listener stopped for server {server.id}: {server.name}")
            except Exception as e:
                log(f"[UPDATE-SERVER] Error stopping listener: {e}")    
    return server


@app.delete("/api/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление сервера"""
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    db.delete(server)
    db.commit()
    
    return None


@app.post("/api/servers/{server_id}/test")
async def test_server_connection(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Тестирование соединения с сервером"""
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # ВАЖНО: Используем listener если он активен, чтобы не прерывать поток данных
    listener = udp_listener.active_listeners.get(server.id)
    
    if listener and listener.running:
        log(f"[API] Testing server {server.id} through listener")
        try:
            success, response = listener.send_command_with_response("lst", timeout=3.0)
            is_online = success and not response.startswith('ERR')
            log(f"[API] Test result via listener: {is_online}")
            return {"server_id": server_id, "is_online": is_online}
        except Exception as e:
            log(f"[API] Error testing via listener: {e}")
            return {"server_id": server_id, "is_online": False}
    else:
        # Если listener не активен - используем прямое подключение
        log(f"[API] Testing server {server.id} directly (no listener)")
        is_online = await test_connection(server.host, server.port, get_decrypted_password(server), bind_port=server.port)
        return {"server_id": server_id, "is_online": is_online}


# ==================== COMMAND ENDPOINTS ====================

@app.post("/api/commands/send", response_model=schemas.CommandResponse)
async def send_command(
    command_data: schemas.CommandRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отправка команды на сервер"""
    # Проверка существования сервера
    server = db.query(models.Server)\
        .filter(models.Server.id == command_data.server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Сервер неактивен")
    
    # Отправка команды через UDP
    # Если listener запущен - используем его, чтобы MoonBot продолжал слать данные на listener port
    listener = udp_listener.active_listeners.get(server.id)
    
    # Проверка: для команд GetStrategies* не ждем синхронный ответ, т.к. данные приходят пакетами асинхронно
    is_strategy_command = command_data.command.startswith('GetStrategies')
    
    if listener and listener.running:
        log(f"[API] Sending command through listener for server {server.id}")
        try:
            if is_strategy_command:
                # Для GetStrategies* просто отправляем команду без ожидания ответа
                # Ответ придет пакетами через listener и сохранится в кэш автоматически
                listener.send_command(command_data.command)
                success = True
                response = f"Команда {command_data.command} отправлена. Данные будут поступать через listener."
                log(f"[API] Strategy command sent without waiting for response")
            else:
                # Для остальных команд ждем ответ
                success, response = listener.send_command_with_response(
                    command_data.command,
                    timeout=float(command_data.timeout or 5)
                )
                log(f"[API] Listener response: success={success}, response={response[:100] if response else 'None'}...")
        except Exception as e:
            log(f"[API] Error sending through listener: {e}")
            # Fallback to direct UDP
            client = UDPClient()
            success, response = await client.send_command(
                server.host,
                server.port,
                command_data.command,
                command_data.timeout or 5,
                get_decrypted_password(server)
            )
    else:
        # Listener не запущен - отправляем напрямую
        log(f"[API] Listener not active for server {server.id}, sending directly")
        client = UDPClient()
        success, response = await client.send_command(
            server.host,
            server.port,
            command_data.command,
            command_data.timeout or 5,
            get_decrypted_password(server)
        )
    
    # Сохранение в историю
    history_entry = models.CommandHistory(
        command=command_data.command,
        response=response if success else None,
        status="success" if success else "error",
        user_id=current_user.id,
        server_id=server.id
    )
    
    db.add(history_entry)
    db.commit()
    
    return schemas.CommandResponse(
        command=command_data.command,
        response=response,
        status="success" if success else "error",
        execution_time=history_entry.execution_time,
        server_name=server.name
    )


@app.get("/api/commands/history", response_model=List[schemas.CommandHistory])
def get_command_history(
    server_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получение истории команд с пагинацией
    
    Args:
        server_id: ID сервера для фильтрации (опционально)
        skip: Количество записей для пропуска (пагинация)
        limit: Максимальное количество записей (по умолчанию 50, макс 200)
    """
    # Ограничение на limit для защиты от DoS
    if limit > 200:
        limit = 200
    
    # Оптимизация: используем joinedload для загрузки server в одном запросе (N+1 fix)
    query = db.query(models.CommandHistory)\
        .options(joinedload(models.CommandHistory.server))\
        .filter(models.CommandHistory.user_id == current_user.id)
    
    if server_id:
        # Проверка что сервер принадлежит пользователю
        server = db.query(models.Server)\
            .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
            .first()
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
        query = query.filter(models.CommandHistory.server_id == server_id)
    
    # Применяем пагинацию
    history = query.order_by(models.CommandHistory.execution_time.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return history


@app.get("/api/commands/history/count")
def get_command_history_count(
    server_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение общего количества команд в истории (для пагинации)"""
    query = db.query(models.CommandHistory)\
        .filter(models.CommandHistory.user_id == current_user.id)
    
    if server_id:
        server = db.query(models.Server)\
            .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
            .first()
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
        query = query.filter(models.CommandHistory.server_id == server_id)
    
    total = query.count()
    return {"total": total}


@app.delete("/api/commands/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_command_history(
    server_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистка истории команд"""
    query = db.query(models.CommandHistory)\
        .filter(models.CommandHistory.user_id == current_user.id)
    
    if server_id:
        server = db.query(models.Server)\
            .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
            .first()
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
        query = query.filter(models.CommandHistory.server_id == server_id)
    
    query.delete()
    db.commit()
    
    return None


@app.post("/api/commands/send-bulk")
async def send_bulk_command(
    command_data: schemas.BulkCommandRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Массовая отправка команды на несколько серверов"""
    # Проверка что все серверы принадлежат пользователю
    servers = db.query(models.Server)\
        .filter(
            models.Server.id.in_(command_data.server_ids),
            models.Server.user_id == current_user.id,
            models.Server.is_active == True
        ).all()
    
    if not servers:
        raise HTTPException(status_code=404, detail="Активные серверы не найдены")
    
    results = []
    
    # Отправка команды на каждый сервер
    for server in servers:
        # ВАЖНО: Используем listener если он активен, чтобы не прерывать поток данных
        listener = udp_listener.active_listeners.get(server.id)
        
        if listener and listener.running:
            log(f"[API] Sending bulk command to server {server.id} through listener")
            try:
                success, response = listener.send_command_with_response(
                    command_data.command,
                    timeout=float(command_data.timeout or 5)
                )
            except Exception as e:
                log(f"[API] Error sending bulk command through listener: {e}")
                success = False
                response = str(e)
        else:
            # Listener не активен - отправляем напрямую
            log(f"[API] Sending bulk command to server {server.id} directly (no listener)")
            client = UDPClient()
            success, response = await client.send_command(
                server.host,
                server.port,
                command_data.command,
                command_data.timeout,
                get_decrypted_password(server)
            )
        
        # Сохранение в историю
        history_entry = models.CommandHistory(
            command=command_data.command,
            response=response if success else None,
            status="success" if success else "error",
            user_id=current_user.id,
            server_id=server.id
        )
        db.add(history_entry)
        
        results.append({
            "server_id": server.id,
            "server_name": server.name,
            "status": "success" if success else "error",
            "response": response
        })
    
    db.commit()
    
    return {
        "total": len(command_data.server_ids),
        "sent": len(results),
        "results": results
    }


# ==================== GROUPS ENDPOINTS ====================

@app.get("/api/groups")
def get_groups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка всех групп пользователя"""
    groups = db.query(models.Server.group_name)\
        .filter(
            models.Server.user_id == current_user.id,
            models.Server.group_name.isnot(None)
        )\
        .distinct()\
        .all()
    
    # Разбиваем группы по запятым и убираем дубликаты
    all_groups = set()
    for g in groups:
        if g[0]:
            group_parts = [part.strip() for part in g[0].split(',')]
            all_groups.update(group_parts)
    
    group_names = sorted(list(all_groups))
    
    return {"groups": group_names}


# ==================== STATS ENDPOINTS ====================

@app.get("/api/stats", response_model=schemas.ServerStats)
def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики"""
    total_servers = db.query(models.Server)\
        .filter(models.Server.user_id == current_user.id).count()
    
    active_servers = db.query(models.Server)\
        .filter(models.Server.user_id == current_user.id, models.Server.is_active == True).count()
    
    total_commands = db.query(models.CommandHistory)\
        .filter(models.CommandHistory.user_id == current_user.id).count()
    
    successful_commands = db.query(models.CommandHistory)\
        .filter(models.CommandHistory.user_id == current_user.id, models.CommandHistory.status == "success").count()
    
    failed_commands = total_commands - successful_commands
    
    return schemas.ServerStats(
        total_servers=total_servers,
        active_servers=active_servers,
        total_commands=total_commands,
        successful_commands=successful_commands,
        failed_commands=failed_commands
    )


# ==================== QUICK COMMANDS ENDPOINTS ====================

@app.get("/api/quick-commands", response_model=List[schemas.QuickCommand])
def get_quick_commands(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка быстрых команд пользователя"""
    commands = db.query(models.QuickCommand)\
        .filter(models.QuickCommand.user_id == current_user.id)\
        .order_by(models.QuickCommand.order)\
        .all()
    return commands


@app.post("/api/quick-commands", response_model=schemas.QuickCommand, status_code=status.HTTP_201_CREATED)
def create_quick_command(
    command_data: schemas.QuickCommandCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание новой быстрой команды"""
    new_command = models.QuickCommand(
        **command_data.model_dump(),
        user_id=current_user.id
    )
    
    db.add(new_command)
    db.commit()
    db.refresh(new_command)
    
    return new_command


@app.put("/api/quick-commands/{command_id}", response_model=schemas.QuickCommand)
def update_quick_command(
    command_id: int,
    command_data: schemas.QuickCommandUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление быстрой команды"""
    command = db.query(models.QuickCommand)\
        .filter(models.QuickCommand.id == command_id, models.QuickCommand.user_id == current_user.id)\
        .first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Быстрая команда не найдена")
    
    update_data = command_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(command, field, value)
    
    db.commit()
    db.refresh(command)
    
    return command


@app.delete("/api/quick-commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление быстрой команды"""
    command = db.query(models.QuickCommand)\
        .filter(models.QuickCommand.id == command_id, models.QuickCommand.user_id == current_user.id)\
        .first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Быстрая команда не найдена")
    
    db.delete(command)
    db.commit()
    
    return None


# ==================== COMMAND PRESETS ENDPOINTS ====================

@app.get("/api/presets", response_model=List[schemas.CommandPreset])
def get_presets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка пресетов команд пользователя"""
    presets = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.user_id == current_user.id)\
        .order_by(models.CommandPreset.button_number)\
        .all()
    return presets


@app.post("/api/presets", response_model=schemas.CommandPreset, status_code=status.HTTP_201_CREATED)
def create_preset(
    preset_data: schemas.CommandPresetCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание нового пресета команд"""
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    new_preset = models.CommandPreset(
        **preset_data.model_dump(),
        user_id=current_user.id
    )
    
    db.add(new_preset)
    db.commit()
    db.refresh(new_preset)
    
    return new_preset


@app.put("/api/presets/{preset_id}", response_model=schemas.CommandPreset)
def update_preset(
    preset_id: int,
    preset_data: schemas.CommandPresetUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление пресета команд"""
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    update_data = preset_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preset, field, value)
    
    preset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(preset)
    
    return preset


@app.delete("/api/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(
    preset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление пресета команд"""
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    db.delete(preset)
    db.commit()
    
    return None


@app.post("/api/presets/{preset_id}/execute")
async def execute_preset(
    preset_id: int,
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выполнение пресета команд на сервере"""
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Сервер неактивен")
    
    # Разбиваем команды по переносу строки
    import json
    try:
        # Пробуем парсить как JSON
        commands_list = json.loads(preset.commands)
    except:
        # Если не JSON, то разбиваем по переносу строки
        commands_list = [cmd.strip() for cmd in preset.commands.split('\n') if cmd.strip()]
    
    results = []
    
    # ВАЖНО: Используем listener если он активен, чтобы не прерывать поток данных
    listener = udp_listener.active_listeners.get(server.id)
    
    for command in commands_list:
        if listener and listener.running:
            log(f"[API] Sending preset command to server {server.id} through listener")
            try:
                success, response = listener.send_command_with_response(command, timeout=5.0)
            except Exception as e:
                log(f"[API] Error sending preset command through listener: {e}")
                success = False
                response = str(e)
        else:
            # Listener не активен - отправляем напрямую
            log(f"[API] Sending preset command to server {server.id} directly (no listener)")
            client = UDPClient()
            success, response = await client.send_command(
                server.host,
                server.port,
                command,
                timeout=5,
                password=get_decrypted_password(server)
            )
        
        # Сохранение в историю
        history_entry = models.CommandHistory(
            command=command,
            response=response if success else None,
            status="success" if success else "error",
            user_id=current_user.id,
            server_id=server.id
        )
        db.add(history_entry)
        
        results.append({
            "command": command,
            "status": "success" if success else "error",
            "response": response
        })
    
    db.commit()
    
    return {
        "preset_name": preset.name,
        "total_commands": len(commands_list),
        "results": results
    }


# ==================== BOT COMMANDS REFERENCE ====================

@app.get("/api/bot-commands", response_model=List[schemas.BotCommand])
def get_bot_commands():
    """Получение справочника всех команд MoonBot"""
    commands = [
        {
            "command": "buy ...",
            "description": "Применяются стандартные правила для сигналов на покупку",
            "category": "Управление ордерами",
            "example": "buy BTC"
        },
        {
            "command": "short ...",
            "description": "Применяются стандартные правила для сигналов на шорт (фьючерсы)",
            "category": "Управление ордерами",
            "example": "short ETH"
        },
        {
            "command": "sell token",
            "description": "Включить Паник Селл на монете",
            "category": "Управление ордерами",
            "example": "sell NEO"
        },
        {
            "command": "SellALL",
            "description": "Включить Паник Селл НА ВСЕХ активных ордерах и остановить бота",
            "category": "Управление ордерами",
            "example": None
        },
        {
            "command": "list",
            "description": "Список активных ордеров на продажу",
            "category": "Информация",
            "example": "list"
        },
        {
            "command": "lst",
            "description": "Список активных ордеров (короткий формат)",
            "category": "Информация",
            "example": "lst"
        },
        {
            "command": "silent",
            "description": "Отключить уведомления бота в чат о закрытых сделках",
            "category": "Настройки уведомлений",
            "example": None
        },
        {
            "command": "talk",
            "description": "Включить уведомления бота в чат о закрытых сделках",
            "category": "Настройки уведомлений",
            "example": None
        },
        {
            "command": "STOP",
            "description": "Нажать Стоп в боте (Не покупать новые сигналы)",
            "category": "Управление ботом",
            "example": None
        },
        {
            "command": "START",
            "description": "Нажать Старт в боте, запустить стратегии",
            "category": "Управление ботом",
            "example": None
        },
        {
            "command": "CancelBuy",
            "description": "Отменить все неисполненные BUY ордера",
            "category": "Управление ордерами",
            "example": None
        },
        {
            "command": "BL",
            "description": "Показать черный список монет",
            "category": "Черный/Белый список",
            "example": None
        },
        {
            "command": "BL + coin",
            "description": "Добавить монету в ЧС",
            "category": "Черный/Белый список",
            "example": "BL + BTC"
        },
        {
            "command": "BL - coin",
            "description": "Убрать монету из ЧС",
            "category": "Черный/Белый список",
            "example": "BL - BTC"
        },
        {
            "command": "SetParam Strategy Param Value",
            "description": "Поменять параметр в стратегии ('empty' для пустой строки)",
            "category": "Настройки стратегий",
            "example": "SetParam MyStrategy MaxOrders 5"
        },
        {
            "command": "SetBL+ Strategy coin",
            "description": "Добавить монету в ЧС стратегии или папки",
            "category": "Черный/Белый список",
            "example": "SetBL+ MyStrategy BTC"
        },
        {
            "command": "SetBL- Strategy coin",
            "description": "Убрать монету из ЧС стратегии или папки",
            "category": "Черный/Белый список",
            "example": "SetBL- MyStrategy BTC"
        },
        {
            "command": "SetWL+ Strategy coin",
            "description": "Добавить монету в БС стратегии или папки",
            "category": "Черный/Белый список",
            "example": "SetWL+ MyStrategy ETH"
        },
        {
            "command": "SetWL- Strategy coin",
            "description": "Убрать монету из БС стратегии или папки",
            "category": "Черный/Белый список",
            "example": "SetWL- MyStrategy ETH"
        },
        {
            "command": "sgStart Strategy",
            "description": "Запустить стратегию",
            "category": "Управление стратегиями",
            "example": "sgStart MyStrategy"
        },
        {
            "command": "sgStop Strategy <время>",
            "description": "Остановить стратегию на заданное время (в минутах)",
            "category": "Управление стратегиями",
            "example": "sgStop MyStrategy 30"
        },
        {
            "command": "ResetSession coin | ALL",
            "description": "Сбросить сессии на монете или на всех рынках",
            "category": "Управление сессиями",
            "example": "ResetSession BTC"
        },
        {
            "command": "ResetLoss",
            "description": "Сбросить счетчик профита",
            "category": "Управление сессиями",
            "example": None
        },
        {
            "command": "Leverage X [coin,coin]",
            "description": "Поменять плечо на монетах на X",
            "category": "Фьючерсы",
            "example": "Leverage 10 BTC,ETH"
        },
        {
            "command": "Margin [coin,coin | ALL] ISO|Cross",
            "description": "Поменять маржу на маркетах",
            "category": "Фьючерсы",
            "example": "Margin BTC,ETH ISO"
        },
        {
            "command": "ConvertBNB",
            "description": "Конвертировать пыль в BNB",
            "category": "Утилиты",
            "example": None
        },
        {
            "command": "report [N days | weeks] [coin] [hide]",
            "description": "Выслать отчет. По умолчанию за сегодня",
            "category": "Отчеты",
            "example": "report 7 days"
        },
        {
            "command": "SellPiece [coin|ALL]",
            "description": "Продать по кусочку от каждого ордера (если параметр в стратегии SellPiece не 0)",
            "category": "Управление ордерами",
            "example": "SellPiece BTC"
        },
        {
            "command": "DoUpdate",
            "description": "Обновить версию бота",
            "category": "Утилиты",
            "example": None
        }
    ]
    
    return commands


# ==================== COMMAND PRESETS ENDPOINTS ====================

@app.get("/api/presets", response_model=List[schemas.CommandPreset])
def get_presets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка пресетов пользователя"""
    presets = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.user_id == current_user.id)\
        .order_by(models.CommandPreset.button_number).all()
    return presets


@app.post("/api/presets", response_model=schemas.CommandPreset, status_code=status.HTTP_201_CREATED)
def create_preset(
    preset_data: schemas.CommandPresetCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание нового пресета"""
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    new_preset = models.CommandPreset(
        **preset_data.model_dump(),
        user_id=current_user.id
    )
    
    db.add(new_preset)
    db.commit()
    db.refresh(new_preset)
    
    return new_preset


@app.put("/api/presets/{preset_id}", response_model=schemas.CommandPreset)
def update_preset(
    preset_id: int,
    preset_data: schemas.CommandPresetUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление пресета"""
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    update_data = preset_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preset, field, value)
    
    preset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(preset)
    
    return preset


@app.delete("/api/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(
    preset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление пресета"""
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    db.delete(preset)
    db.commit()
    
    return None


@app.post("/api/presets/{preset_id}/execute")
async def execute_preset(
    preset_id: int,
    server_id: int,
    timeout: Optional[int] = 5,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выполнение всех команд из пресета последовательно"""
    # Получение пресета
    preset = db.query(models.CommandPreset)\
        .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)\
        .first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    # Получение сервера
    server = db.query(models.Server)\
        .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)\
        .first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Сервер неактивен")
    
    # Разбиваем команды на строки
    commands_list = [cmd.strip() for cmd in preset.commands.split('\n') if cmd.strip()]
    
    results = []
    
    # ВАЖНО: Используем listener если он активен, чтобы не прерывать поток данных
    listener = udp_listener.active_listeners.get(server.id)
    
    # Выполняем команды последовательно
    for command in commands_list:
        if listener and listener.running:
            log(f"[API] Sending preset-v2 command to server {server.id} through listener")
            try:
                success, response = listener.send_command_with_response(command, timeout=float(timeout or 5))
            except Exception as e:
                log(f"[API] Error sending preset-v2 command through listener: {e}")
                success = False
                response = str(e)
        else:
            # Listener не активен - отправляем напрямую
            log(f"[API] Sending preset-v2 command to server {server.id} directly (no listener)")
            client = UDPClient()
            success, response = await client.send_command(
                server.host,
                server.port,
                command,
                timeout,
                get_decrypted_password(server)
            )
        
        # Сохранение в историю
        history_entry = models.CommandHistory(
            command=command,
            response=response if success else None,
            status="success" if success else "error",
            user_id=current_user.id,
            server_id=server.id
        )
        db.add(history_entry)
        
        results.append({
            "command": command,
            "status": "success" if success else "error",
            "response": response
        })
    
    db.commit()
    
    return {
        "preset_name": preset.name,
        "server_name": server.name,
        "total_commands": len(commands_list),
        "results": results
    }


# ==================== BOT COMMANDS REFERENCE ====================

# Справочник всех команд MoonBot
BOT_COMMANDS_REFERENCE = [
    {
        "command": "buy ...",
        "description": "Применяются стандартные правила для сигналов на покупку",
        "category": "Торговля",
        "example": "buy BTC"
    },
    {
        "command": "short ...",
        "description": "Применяются стандартные правила для сигналов на шорт (фьючерсы)",
        "category": "Торговля",
        "example": "short ETH"
    },
    {
        "command": "sell token",
        "description": "Включить Паник Селл на монете",
        "category": "Торговля",
        "example": "sell NEO"
    },
    {
        "command": "SellALL",
        "description": "Включить Паник Селл НА ВСЕХ активных ордерах и остановить бота",
        "category": "Торговля",
        "example": "SellALL"
    },
    {
        "command": "list",
        "description": "Список активных ордеров на продажу",
        "category": "Информация",
        "example": "list"
    },
    {
        "command": "lst",
        "description": "Список активных ордеров (короткий формат)",
        "category": "Информация",
        "example": "lst"
    },
    {
        "command": "silent",
        "description": "Отключить уведомления бота в чат о закрытых сделках",
        "category": "Настройки",
        "example": "silent"
    },
    {
        "command": "talk",
        "description": "Включить уведомления бота в чат о закрытых сделках",
        "category": "Настройки",
        "example": "talk"
    },
    {
        "command": "STOP",
        "description": "Нажать Стоп в боте (Не покупать новые сигналы)",
        "category": "Управление",
        "example": "STOP"
    },
    {
        "command": "START",
        "description": "Нажать Старт в боте, запустить стратегии",
        "category": "Управление",
        "example": "START"
    },
    {
        "command": "CancelBuy",
        "description": "Отменить все неисполненные BUY ордера",
        "category": "Торговля",
        "example": "CancelBuy"
    },
    {
        "command": "BL",
        "description": "Показать черный список монет",
        "category": "Списки",
        "example": "BL"
    },
    {
        "command": "BL + coin",
        "description": "Добавить монету в ЧС",
        "category": "Списки",
        "example": "BL + BTC"
    },
    {
        "command": "BL - coin",
        "description": "Убрать монету из ЧС",
        "category": "Списки",
        "example": "BL - BTC"
    },
    {
        "command": "SetParam Strategy Param Value",
        "description": "Поменять параметр в стратегии (\"empty\" для пустой строки)",
        "category": "Настройки",
        "example": "SetParam MyStrategy MaxOrders 5"
    },
    {
        "command": "SetBL+ Strategy coin",
        "description": "Добавить монету в ЧС стратегии или папки",
        "category": "Списки",
        "example": "SetBL+ MyStrategy BTC"
    },
    {
        "command": "SetBL- Strategy coin",
        "description": "Убрать монету из ЧС стратегии или папки",
        "category": "Списки",
        "example": "SetBL- MyStrategy BTC"
    },
    {
        "command": "SetWL+ Strategy coin",
        "description": "Добавить монету в БС стратегии или папки",
        "category": "Списки",
        "example": "SetWL+ MyStrategy ETH"
    },
    {
        "command": "SetWL- Strategy coin",
        "description": "Убрать монету из БС стратегии или папки",
        "category": "Списки",
        "example": "SetWL- MyStrategy ETH"
    },
    {
        "command": "sgStart Strategy",
        "description": "Запустить стратегию",
        "category": "Управление",
        "example": "sgStart MyStrategy"
    },
    {
        "command": "sgStop Strategy [время]",
        "description": "Остановить стратегию на заданное время (в минутах)",
        "category": "Управление",
        "example": "sgStop MyStrategy 60"
    },
    {
        "command": "ResetSession coin | ALL",
        "description": "Сбросить сессии на монете (coin) или на всех рынках (ALL)",
        "category": "Управление",
        "example": "ResetSession BTC"
    },
    {
        "command": "ResetLoss",
        "description": "Сбросить счетчик профита",
        "category": "Управление",
        "example": "ResetLoss"
    },
    {
        "command": "Leverage X [coin,coin]",
        "description": "Поменять плечо на монетах на X",
        "category": "Фьючерсы",
        "example": "Leverage 10 BTC,ETH"
    },
    {
        "command": "Margin [coin,coin | ALL] ISO|Cross",
        "description": "Поменять маржу на маркетах",
        "category": "Фьючерсы",
        "example": "Margin BTC,ETH ISO"
    },
    {
        "command": "ConvertBNB",
        "description": "Конвертировать пыль в BNB",
        "category": "Утилиты",
        "example": "ConvertBNB"
    },
    {
        "command": "report [N days | weeks] [coin] [hide]",
        "description": "Выслать отчет. По умолчанию за сегодня",
        "category": "Отчеты",
        "example": "report 7 days"
    },
    {
        "command": "SellPiece [coin|ALL]",
        "description": "Продать по кусочку от каждого ордера (если параметр в стратегии SellPiece не 0)",
        "category": "Торговля",
        "example": "SellPiece BTC"
    },
    {
        "command": "DoUpdate",
        "description": "Обновить версию бота",
        "category": "Утилиты",
        "example": "DoUpdate"
    },
    {
        "command": "InstallTestVersion Release",
        "description": "Обновить бота на последнюю релизную версию. ВАЖНО: Для работы этой команды должна быть включена галочка 'Accept beta version' в Настройках -> Специальные -> System",
        "category": "Утилиты",
        "example": "InstallTestVersion Release"
    },
    {
        "command": "AutoLevConfig [def_sum] def [sum] coin1 coin2 [sum] coin3",
        "description": "Автоматический подбор плеча на основе требуемой суммы ордеров. Бот подбирает плечо на котором разрешена указанная сумма. 'def' - для всех остальных монет не указанных явно",
        "category": "Фьючерсы",
        "example": "AutoLevConfig 1000 def 50k alice glm 100k btc eth"
    }
]


@app.get("/api/bot-commands", response_model=List[schemas.BotCommand])
def get_bot_commands():
    """Получение справочника всех команд MoonBot"""
    return BOT_COMMANDS_REFERENCE


@app.get("/api/bot-commands/categories")
def get_bot_command_categories():
    """Получение списка категорий команд"""
    categories = list(set([cmd["category"] for cmd in BOT_COMMANDS_REFERENCE]))
    return {"categories": sorted(categories)}


# ==================== USER SETTINGS ====================

@app.get("/api/user/settings", response_model=schemas.UserSettings)
def get_user_settings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение настроек пользователя"""
    settings = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id
    ).first()
    
    # Если настроек нет - создаем с дефолтными значениями
    if not settings:
        settings = models.UserSettings(
            user_id=current_user.id,
            ping_interval=30,
            enable_notifications=True,
            notification_sound=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@app.put("/api/user/settings", response_model=schemas.UserSettings)
def update_user_settings(
    settings_update: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление настроек пользователя"""
    settings = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id
    ).first()
    
    if not settings:
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
    
    # Обновляем только переданные поля
    if settings_update.ping_interval is not None:
        # ИСПРАВЛЕНО: Валидация ping_interval!
        # РАЗМЫШЛЕНИЕ: Frontend валидирует, но атакующий может обойти через API!
        if settings_update.ping_interval < 5 or settings_update.ping_interval > 3600:
            raise HTTPException(
                status_code=400,
                detail="ping_interval must be between 5 and 3600 seconds"
            )
        settings.ping_interval = settings_update.ping_interval
    if settings_update.enable_notifications is not None:
        settings.enable_notifications = settings_update.enable_notifications
    if settings_update.notification_sound is not None:
        settings.notification_sound = settings_update.notification_sound
    
    # ИСПРАВЛЕНО: Убрал ручное обновление updated_at
    # РАЗМЫШЛЕНИЕ: В модели уже есть onupdate=datetime.now
    # Ручное присваивание может конфликтовать с SQLAlchemy
    db.commit()
    db.refresh(settings)
    
    return settings


# ==================== UPDATE CHECKER ====================

@app.get("/api/check-updates")
async def check_for_updates(
    force: bool = Query(False, description="Force check ignoring cache"),
    current_user: models.User = Depends(get_current_user)
):
    """
    Проверить наличие обновлений
    
    Returns:
        Информация об обновлении или {"update_available": false}
    """
    update_info = await update_checker.check_for_updates(force=force)
    
    if update_info:
        notification = update_checker.get_update_notification()
        return {
            "update_available": True,
            "current_version": update_checker.current_version,
            "latest_version": update_info["version"],
            "notification": notification
        }
    
    return {
        "update_available": False,
        "current_version": update_checker.current_version
    }


# ==================== SERVER STATUS ====================

@app.get("/api/servers-with-status")
def get_servers_with_status(
    limit: int = 1000,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение всех серверов со статусами"""
    from sqlalchemy.orm import joinedload
    
    # ИСПРАВЛЕНО: Добавлена пагинация!
    # РАЗМЫШЛЕНИЕ: .all() без limit → DoS при 10,000+ серверах!
    if limit > 1000:
        raise HTTPException(status_code=400, detail="Limit cannot exceed 1000")
    if limit < 1:
        raise HTTPException(status_code=400, detail="Limit must be positive")
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset cannot be negative")
    
    # ИСПРАВЛЕНО: joinedload для предотвращения N+1 query!
    # РАЗМЫШЛЕНИЕ: server.server_status делал отдельный SQL для каждого сервера!
    # 100 серверов = 101 SQL запрос → медленно!
    servers = db.query(models.Server).options(
        joinedload(models.Server.server_status)
    ).filter(
        models.Server.user_id == current_user.id
    ).limit(limit).offset(offset).all()
    
    result = []
    for server in servers:
        status = server.server_status
        server_dict = {
            "id": server.id,
            "name": server.name,
            "host": server.host,
            "port": server.port,
            "description": server.description,
            "group_name": server.group_name,
            "is_active": server.is_active,
            "created_at": server.created_at.isoformat() if server.created_at else None,
            "updated_at": server.updated_at.isoformat() if server.updated_at else None,
            "user_id": server.user_id,
            "status": {
                "id": status.id,
                "server_id": status.server_id,
                "is_online": status.is_online,
                "last_ping": status.last_ping.isoformat() if status.last_ping else None,
                "response_time": status.response_time,
                "last_error": status.last_error,
                "uptime_percentage": status.uptime_percentage,
                "consecutive_failures": status.consecutive_failures
            } if status else None
        }
        result.append(server_dict)
    
    return result


@app.post("/api/servers/{server_id}/ping")
async def ping_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пинг конкретного сервера"""
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Получаем или создаем статус
    status = server.server_status
    if not status:
        status = models.ServerStatus(server_id=server.id)
        db.add(status)
    
    # Пингуем сервер
    import time
    start_time = time.time()
    
    try:
        # ВАЖНО: Используем listener если он активен, чтобы не прерывать поток данных
        listener = udp_listener.active_listeners.get(server.id)
        
        if listener and listener.running:
            log(f"[API] Pinging server {server.id} through listener")
            success, response = listener.send_command_with_response("lst", timeout=3.0)
            is_success = success and not response.startswith('ERR')
        else:
            # Если listener не активен - используем прямое подключение
            log(f"[API] Pinging server {server.id} directly (no listener)")
            client = UDPClient(timeout=3)
            is_success, response = await client.send_command(server.host, server.port, "lst", timeout=3, password=get_decrypted_password(server))
        
        response_time = (time.time() - start_time) * 1000  # В миллисекундах
        
        if is_success:
            status.is_online = True
            # ИСПРАВЛЕНО: Используем локальное время вместо UTC!
            # РАЗМЫШЛЕНИЕ: Dashboard использует datetime.now() → должна быть консистентность!
            status.last_ping = datetime.now()
            status.response_time = response_time
            status.last_error = None
            status.consecutive_failures = 0
            
            # ИСПРАВЛЕНО: Правильный расчет uptime!
            # РАЗМЫШЛЕНИЕ: uptime += 1% это НЕ uptime, это счетчик!
            # Настоящий uptime = (successful / total) * 100
            # Для простоты используем приближение с weighted average
            current_uptime = status.uptime_percentage if status.uptime_percentage is not None else 100.0
            # Плавное увеличение: текущий uptime * 0.99 + 100 * 0.01
            status.uptime_percentage = min(100.0, current_uptime * 0.99 + 100.0 * 0.01)
        else:
            raise Exception(response or "No response")
        
    except Exception as e:
        status.is_online = False
        # ИСПРАВЛЕНО: Локальное время
        status.last_ping = datetime.now()
        status.last_error = str(e)[:500]  # ДОБАВЛЕНО: Обрезаем длинные ошибки
        status.consecutive_failures = (status.consecutive_failures or 0) + 1
        
        # ИСПРАВЛЕНО: Правильный расчет downtime
        # Уменьшаем uptime пропорционально
        current_uptime = status.uptime_percentage if status.uptime_percentage is not None else 100.0
        # Плавное уменьшение: текущий uptime * 0.99 + 0 * 0.01
        status.uptime_percentage = max(0.0, current_uptime * 0.99)
    
    db.commit()
    db.refresh(status)
    
    return {
        "server_id": server.id,
        "is_online": status.is_online,
        "response_time": status.response_time,
        "last_error": status.last_error
    }


# ==================== DASHBOARD STATISTICS ====================

@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики для дашборда"""
    from sqlalchemy import func, and_
    
    # Общее количество серверов
    total_servers = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).count()
    
    # Онлайн/оффлайн серверы
    online_servers = db.query(models.ServerStatus).join(models.Server).filter(
        models.Server.user_id == current_user.id,
        models.ServerStatus.is_online == True
    ).count()
    
    offline_servers = total_servers - online_servers
    
    # ИСПРАВЛЕНО: Используем локальное время вместо UTC
    # РАЗМЫШЛЕНИЕ: utcnow() не учитывает timezone пользователя!
    # Пользователь в Москве (UTC+3) видит неправильный "сегодня"
    # Команды за сегодня
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    commands_today = db.query(models.CommandHistory).filter(
        models.CommandHistory.user_id == current_user.id,
        models.CommandHistory.execution_time >= today_start
    ).all()
    
    total_commands_today = len(commands_today)
    successful_commands_today = len([c for c in commands_today if c.status == "success"])
    failed_commands_today = total_commands_today - successful_commands_today
    
    # Общее количество команд
    total_commands_all_time = db.query(models.CommandHistory).filter(
        models.CommandHistory.user_id == current_user.id
    ).count()
    
    # Среднее время отклика
    avg_response = db.query(func.avg(models.ServerStatus.response_time)).join(models.Server).filter(
        models.Server.user_id == current_user.id,
        models.ServerStatus.response_time.isnot(None)
    ).scalar()
    
    return {
        "total_servers": total_servers,
        "online_servers": online_servers,
        "offline_servers": offline_servers,
        "total_commands_today": total_commands_today,
        "successful_commands_today": successful_commands_today,
        "failed_commands_today": failed_commands_today,
        "avg_response_time": float(avg_response) if avg_response else None,
        "total_commands_all_time": total_commands_all_time
    }


@app.get("/api/dashboard/commands-daily", response_model=List[schemas.CommandStatsDaily])
def get_commands_daily_stats(
    days: int = 7,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики команд по дням"""
    from datetime import timedelta, date
    from sqlalchemy import func, case
    
    # ИСПРАВЛЕНО: Валидация days!
    # РАЗМЫШЛЕНИЕ: Без валидации days=99999 загрузит ВСЕ команды в память!
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=400,
            detail="Days parameter must be between 1 and 365"
        )
    
    start_date = datetime.now() - timedelta(days=days)
    
    # ИСПРАВЛЕНО: Группировка в SQL, а не в Python!
    # РАЗМЫШЛЕНИЕ: .all() + группировка в Python = OOM при 100k+ командах
    # Делаем group by date прямо в SQL!
    
    results = db.query(
        func.date(models.CommandHistory.execution_time).label('date'),
        func.count(models.CommandHistory.id).label('total'),
        func.sum(
            case(
                (models.CommandHistory.status == 'success', 1),
                else_=0
            )
        ).label('successful'),
        func.sum(
            case(
                (models.CommandHistory.status != 'success', 1),
                else_=0
            )
        ).label('failed')
    ).filter(
        models.CommandHistory.user_id == current_user.id,
        models.CommandHistory.execution_time >= start_date
    ).group_by(
        func.date(models.CommandHistory.execution_time)
    ).order_by(
        func.date(models.CommandHistory.execution_time)
    ).all()
    
    # Преобразуем в список
    result = []
    for row in results:
        result.append({
            "date": str(row.date),
            "total": row.total,
            "successful": row.successful or 0,
            "failed": row.failed or 0
        })
    
    return result


@app.get("/api/dashboard/server-uptime", response_model=List[schemas.ServerUptime])
def get_server_uptime(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение uptime всех серверов"""
    servers = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()
    
    result = []
    for server in servers:
        status = server.server_status
        result.append({
            "server_id": server.id,
            "server_name": server.name,
            "uptime_percentage": status.uptime_percentage if status else 100.0,
            "is_online": status.is_online if status else False,
            "last_ping": status.last_ping if status else None
        })
    
    return result


# ==================== ROOT ====================

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "MoonBot UDP Commander API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# ==================== SCHEDULED COMMANDS ENDPOINTS ====================

@app.post("/api/scheduled-commands", response_model=schemas.ScheduledCommandWithServers, status_code=status.HTTP_201_CREATED)
def create_scheduled_command(
    command_data: schemas.ScheduledCommandCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание новой отложенной команды"""
    # Валидация: должны быть либо серверы, либо группы
    if not command_data.server_ids and not command_data.group_ids:
        raise HTTPException(status_code=400, detail="Необходимо выбрать серверы или группы")
    
    # Проверка серверов (если указаны)
    if command_data.server_ids:
        servers = db.query(models.Server).filter(
            models.Server.id.in_(command_data.server_ids),
            models.Server.user_id == current_user.id
        ).all()
        
        if len(servers) != len(command_data.server_ids):
            raise HTTPException(status_code=404, detail="Один или несколько серверов не найдены")
    
    # Проверка групп (если указаны)
    if command_data.group_ids:
        groups = db.query(models.Group).filter(
            models.Group.id.in_(command_data.group_ids),
            models.Group.user_id == current_user.id
        ).all()
        
        if len(groups) != len(command_data.group_ids):
            raise HTTPException(status_code=404, detail="Одна или несколько групп не найдены")
    
    # Конвертируем UTC время из запроса в локальное время сервера
    # Frontend отправляет ISO строку в UTC, нам нужно локальное время
    from datetime import timezone
    
    # Парсим UTC время из запроса
    if isinstance(command_data.scheduled_time, str):
        # Если строка - парсим как UTC
        scheduled_utc = datetime.fromisoformat(command_data.scheduled_time.replace('Z', '+00:00'))
    else:
        # Если уже datetime - предполагаем что это UTC
        scheduled_utc = command_data.scheduled_time
    
    # Если у нас naive datetime (без timezone), считаем что это UTC
    if scheduled_utc.tzinfo is None:
        scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)
    
    # Конвертируем в локальное время сервера
    scheduled_local = scheduled_utc.astimezone().replace(tzinfo=None)
    
    # Конвертируем weekdays из списка в JSON строку для БД
    import json
    weekdays_json = None
    if command_data.weekdays:
        weekdays_json = json.dumps(command_data.weekdays)
    
    # Создаем отложенную команду
    new_command = models.ScheduledCommand(
        name=command_data.name,
        commands=command_data.commands,
        scheduled_time=scheduled_local,  # Используем локальное время
        display_time=command_data.display_time,
        timezone=command_data.timezone,
        target_type=command_data.target_type,
        use_botname=command_data.use_botname,
        delay_between_bots=command_data.delay_between_bots,
        recurrence_type=command_data.recurrence_type,  # ВАЖНО: Сохраняем тип повторения
        weekdays=weekdays_json,  # ВАЖНО: Сохраняем дни недели (JSON)
        user_id=current_user.id
    )
    
    # Логируем для отладки
    log(f"[SCHEDULED] Creating command '{command_data.name}'")
    log(f"[SCHEDULED]   - UTC from request: {command_data.scheduled_time}")
    log(f"[SCHEDULED]   - Converted to local: {scheduled_local}")
    log(f"[SCHEDULED]   - Current server time: {datetime.now()}")
    log(f"[SCHEDULED]   - Time until execution: {(scheduled_local - datetime.now()).total_seconds()} seconds")
    
    db.add(new_command)
    db.flush()  # Чтобы получить ID
    
    # Создаем связи с серверами
    for server_id in command_data.server_ids:
        link = models.ScheduledCommandServer(
            scheduled_command_id=new_command.id,
            server_id=server_id
        )
        db.add(link)
    
    # Создаем связи с группами (сохраняем ID групп как серверы с отрицательными ID)
    # Или создаем отдельную таблицу scheduled_command_groups
    for group_id in command_data.group_ids:
        # Используем отрицательные ID для групп в той же таблице
        link = models.ScheduledCommandServer(
            scheduled_command_id=new_command.id,
            server_id=-group_id  # Отрицательный ID = группа
        )
        db.add(link)
    
    db.commit()
    db.refresh(new_command)
    
    log(f"[SCHEDULER] New command created: ID={new_command.id}, Time={new_command.scheduled_time}")    
    # Формируем ответ
    result = schemas.ScheduledCommandWithServers.model_validate(new_command)
    result.server_ids = command_data.server_ids
    result.group_ids = command_data.group_ids
    
    return result


@app.get("/api/scheduled-commands", response_model=List[schemas.ScheduledCommandWithServers])
def get_scheduled_commands(
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка отложенных команд пользователя"""
    query = db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.user_id == current_user.id
    )
    
    if status_filter:
        query = query.filter(models.ScheduledCommand.status == status_filter)
    
    commands = query.order_by(models.ScheduledCommand.scheduled_time.asc()).all()
    
    # Для каждой команды получаем ID серверов и групп
    result = []
    for cmd in commands:
        server_links = db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == cmd.id
        ).all()
        
        cmd_dict = schemas.ScheduledCommandWithServers.model_validate(cmd)
        cmd_dict.server_ids = [link.server_id for link in server_links if link.server_id > 0]
        cmd_dict.group_ids = [-link.server_id for link in server_links if link.server_id < 0]
        result.append(cmd_dict)
    
    return result


@app.get("/api/scheduled-commands/{command_id}", response_model=schemas.ScheduledCommandWithServers)
def get_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение конкретной отложенной команды"""
    command = db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.id == command_id,
        models.ScheduledCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    # Получаем ID серверов
    server_links = db.query(models.ScheduledCommandServer).filter(
        models.ScheduledCommandServer.scheduled_command_id == command_id
    ).all()
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links]
    
    return result


@app.put("/api/scheduled-commands/{command_id}", response_model=schemas.ScheduledCommandWithServers)
def update_scheduled_command(
    command_id: int,
    command_data: schemas.ScheduledCommandUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление отложенной команды (только если статус = pending)"""
    command = db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.id == command_id,
        models.ScheduledCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    if command.status != "pending":
        raise HTTPException(status_code=400, detail="Можно редактировать только ожидающие команды")
    
    # Обновляем поля
    if command_data.name is not None:
        command.name = command_data.name
    if command_data.commands is not None:
        command.commands = command_data.commands
    if command_data.scheduled_time is not None:
        command.scheduled_time = command_data.scheduled_time
    if command_data.use_botname is not None:
        command.use_botname = command_data.use_botname
    if command_data.delay_between_bots is not None:
        command.delay_between_bots = command_data.delay_between_bots
    if command_data.recurrence_type is not None:
        command.recurrence_type = command_data.recurrence_type  # ВАЖНО: Обновляем тип повторения
    if command_data.weekdays is not None:
        # Конвертируем weekdays из списка в JSON строку
        import json
        command.weekdays = json.dumps(command_data.weekdays) if command_data.weekdays else None
    
    # Обновляем серверы если указаны
    if command_data.server_ids is not None:
        # Проверяем что все серверы принадлежат пользователю
        servers = db.query(models.Server).filter(
            models.Server.id.in_(command_data.server_ids),
            models.Server.user_id == current_user.id
        ).all()
        
        if len(servers) != len(command_data.server_ids):
            raise HTTPException(status_code=404, detail="Один или несколько серверов не найдены")
        
        # Удаляем старые связи
        db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command_id
        ).delete()
        
        # Создаем новые связи
        for server_id in command_data.server_ids:
            link = models.ScheduledCommandServer(
                scheduled_command_id=command_id,
                server_id=server_id
            )
            db.add(link)
    
    db.commit()
    db.refresh(command)
    
    # Получаем ID серверов
    server_links = db.query(models.ScheduledCommandServer).filter(
        models.ScheduledCommandServer.scheduled_command_id == command_id
    ).all()
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links]
    
    return result


@app.delete("/api/scheduled-commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление отложенной команды"""
    command = db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.id == command_id,
        models.ScheduledCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    # Удаляем связи с серверами
    db.query(models.ScheduledCommandServer).filter(
        models.ScheduledCommandServer.scheduled_command_id == command_id
    ).delete()
    
    # Удаляем команду
    db.delete(command)
    db.commit()
    
    return None


@app.post("/api/scheduled-commands/{command_id}/cancel", response_model=schemas.ScheduledCommandWithServers)
def cancel_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отмена отложенной команды (изменение статуса на cancelled)"""
    command = db.query(models.ScheduledCommand).filter(
        models.ScheduledCommand.id == command_id,
        models.ScheduledCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    if command.status not in ["pending", "executing"]:
        raise HTTPException(status_code=400, detail="Можно отменить только ожидающие или выполняющиеся команды")
    
    command.status = "cancelled"
    db.commit()
    db.refresh(command)
    
    # Получаем ID серверов
    server_links = db.query(models.ScheduledCommandServer).filter(
        models.ScheduledCommandServer.scheduled_command_id == command_id
    ).all()
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links]
    
    return result


# ============================================================================
# SCHEDULER SETTINGS
# ============================================================================

@app.get("/api/scheduler/settings", response_model=schemas.SchedulerSettings)
def get_scheduler_settings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение текущих настроек scheduler"""
    import scheduler as scheduler_module
    
    settings = db.query(models.SchedulerSettings).first()
    
    if not settings:
        # Создаем настройки по умолчанию
        settings = models.SchedulerSettings(check_interval=5)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Добавляем статус enabled из файла
    settings.enabled = scheduler_module.is_scheduler_enabled()
    
    return settings


@app.put("/api/scheduler/settings", response_model=schemas.SchedulerSettings)
def update_scheduler_settings(
    settings_data: schemas.SchedulerSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление настроек scheduler"""
    import scheduler as scheduler_module
    
    settings = db.query(models.SchedulerSettings).first()
    
    if not settings:
        settings = models.SchedulerSettings()
        db.add(settings)
    
    # Обновляем только check_interval в БД
    if settings_data.check_interval is not None:
        settings.check_interval = settings_data.check_interval
        settings.updated_at = datetime.now()
        db.commit()
        db.refresh(settings)
    
    # Обновляем статус enabled в файле (не в БД)
    if settings_data.enabled is not None:
        scheduler_module.set_scheduler_enabled(settings_data.enabled)
        log(f"[API] Scheduler {'enabled' if settings_data.enabled else 'disabled'} by user")    
    # Добавляем статус enabled в ответ (из файла)
    settings.enabled = scheduler_module.is_scheduler_enabled()
    
    return settings


# ==================== UDP LISTENER ENDPOINTS ====================

# Импортируем udp_listener module
import udp_listener


# ==================== STARTUP EVENT ====================

@app.on_event("startup")
async def startup_event():
    """
    Выполняется при старте приложения
    
    Автоматически запускает UDP listeners для всех активных серверов
    """
    log("[STARTUP] Initializing...")    
    # Устанавливаем event loop для WebSocket manager
    import asyncio
    loop = asyncio.get_event_loop()
    ws_manager.set_event_loop(loop)
    log("[STARTUP] WebSocket manager event loop configured")
    
    # Проверяем обновления
    log("[STARTUP] Checking for updates...")
    try:
        update_notification = await check_update_on_startup()
        if update_notification:
            log(f"[STARTUP] 🆕 Update available: v{update_notification['current_version']} → v{update_notification['new_version']}")
            # Сохраняем уведомление для отправки через WebSocket
            ws_manager.update_notification = update_notification
    except Exception as e:
        log(f"[STARTUP] Update check failed: {e}")    
    log("[STARTUP] Initializing UDP Listeners...")    
    db = SessionLocal()
    try:
        # ДИАГНОСТИКА: Показываем ВСЕ серверы
        all_servers = db.query(models.Server).all()
        log(f"[STARTUP] Total servers in DB: {len(all_servers)}")
        for s in all_servers:
            log(f"  - Server ID={s.id}, Name={s.name}, Active={s.is_active}, User={s.user_id}")        
        servers = db.query(models.Server).filter(
            models.Server.is_active == True
        ).all()
        
        log(f"[STARTUP] Found {len(servers)} active servers")
        
        for server in servers:
            try:
                password = None
                if server.password:
                    password = encryption.decrypt_password(server.password)
                
                # ДИАГНОСТИКА: Логируем параметры запуска (пароль замаскирован!)
                password_masked = f"{password[:4]}****{password[-4:]}" if password and len(password) > 8 else "****" if password else "None"
                log(f"[STARTUP] Starting listener for server {server.id}:")
                log(f"  Name: {server.name}")
                log(f"  Host: {server.host}")
                log(f"  Port: {server.port}")
                log(f"  Password: {password_masked}")
                
                success = udp_listener.start_listener(
                    server_id=server.id,
                    host=server.host,
                    port=server.port,
                    password=password,
                    keepalive_enabled=server.keepalive_enabled
                )
                
                if success:
                    log(f"[STARTUP] ✅ OK: Listener started for server {server.id}: {server.name}")
                else:
                    log(f"[STARTUP] ❌ FAIL: Failed to start listener for server {server.id}: {server.name}", level="ERROR")
            
            except Exception as e:
                log(f"[STARTUP] ❌ Error starting listener for server {server.id}: {e}")
                import traceback
                traceback.print_exc()
    
    except Exception as e:
        log(f"[STARTUP] Error during startup: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    
    log("[STARTUP] UDP Listeners initialization complete")    
    # Запускаем фоновую задачу для мониторинга listeners
    import asyncio
    asyncio.create_task(monitor_listeners())


async def monitor_listeners():
    """Фоновая задача для мониторинга и перезапуска упавших listeners"""
    import asyncio
    
    while True:
        await asyncio.sleep(60)  # Проверяем каждую минуту
        
        try:
            db = SessionLocal()
            try:
                servers = db.query(models.Server).filter(
                    models.Server.is_active == True
                ).all()
                
                for server in servers:
                    listener_status = udp_listener.get_listener_status(server.id)
                    
                    # Если listener не работает - перезапускаем
                    if not listener_status["is_running"]:
                        log(f"[MONITOR] Listener for server {server.id} is down, restarting...")                        
                        password = None
                        if server.password:
                            password = encryption.decrypt_password(server.password)
                        
                        success = udp_listener.start_listener(
                            server_id=server.id,
                            host=server.host,
                            port=server.port,
                            password=password
                        )
                        
                        if success:
                            log(f"[MONITOR] OK: Listener restarted for server {server.id}")
                        else:
                            log(f"[MONITOR] FAIL: Failed to restart listener for server {server.id}", level="ERROR")                
            finally:
                db.close()
        except Exception as e:
            log(f"[MONITOR] Error: {e}", level="ERROR")

@app.on_event("shutdown")
async def shutdown_event():
    """Выполняется при остановке приложения"""
    log("[SHUTDOWN] Stopping all UDP Listeners...")
    udp_listener.stop_all_listeners()
    log("[SHUTDOWN] Complete")

@app.post("/api/servers/{server_id}/listener/start")
async def start_udp_listener(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Запустить UDP listener для постоянного прослушивания сервера
    
    Listener будет получать SQL команды от MoonBot в реальном времени
    и сохранять их в БД.
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Расшифровываем пароль
    password = get_decrypted_password(server)
    
    # Запускаем listener
    success = udp_listener.start_listener(
        server_id=server.id,
        host=server.host,
        port=server.port,
        password=password
    )
    
    if success:
        return {
            "message": "UDP listener запущен",
            "server_id": server_id,
            "server_name": server.name
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Не удалось запустить UDP listener (возможно уже запущен)"
        )


@app.post("/api/servers/{server_id}/listener/stop")
async def stop_udp_listener(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Остановить UDP listener для сервера"""
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Останавливаем listener
    success = udp_listener.stop_listener(server_id)
    
    if success:
        return {
            "message": "UDP listener остановлен",
            "server_id": server_id
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Не удалось остановить UDP listener (возможно не был запущен)"
        )


@app.post("/api/servers/{server_id}/listener/refresh")
async def refresh_udp_data(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отправить команду lst для немедленного получения данных от MoonBot
    Используется при открытии вкладок Orders/SQLLogs для моментальной загрузки данных
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Проверяем что listener запущен
    if server_id not in udp_listener.active_listeners:
        raise HTTPException(
            status_code=400,
            detail="UDP listener не запущен для этого сервера"
        )
    
    # Отправляем команду lst через listener
    try:
        listener = udp_listener.active_listeners[server_id]
        if listener and listener.running:
            # Отправляем команду lst для получения списка ордеров
            listener.send_command("lst")
            return {
                "message": "Команда lst отправлена, данные будут обновлены в течение 1-2 секунд",
                "server_id": server_id
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Listener существует но не работает"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка отправки команды: {str(e)}"
        )


@app.get("/api/servers/{server_id}/listener/status")
async def get_udp_listener_status(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус UDP listener"""
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Получаем статус из памяти
    runtime_status = udp_listener.get_listener_status(server_id)
    
    # Получаем статус из БД
    db_status = db.query(models.UDPListenerStatus).filter(
        models.UDPListenerStatus.server_id == server_id
    ).first()
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "is_running": runtime_status["is_running"],
        "messages_received": runtime_status["messages_received"],
        "last_error": runtime_status["last_error"],
        "db_status": {
            "started_at": db_status.started_at if db_status else None,
            "last_message_at": db_status.last_message_at if db_status else None,
            "total_messages": db_status.messages_received if db_status else 0
        } if db_status else None
    }


# ==================== SQL LOG ENDPOINTS ====================

@app.get("/api/servers/{server_id}/sql-log")
async def get_sql_log(
    server_id: int,
    limit: int = 100,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить лог SQL команд от сервера
    
    Args:
        server_id: ID сервера
        limit: Количество записей (max 500)
        offset: Смещение для пагинации
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # АВТОСТАРТ LISTENER: Проверяем что listener запущен, если нет - запускаем
    if server.is_active and server_id not in udp_listener.active_listeners:
        log(f"[AUTO-START] Listener not running for server {server_id}, starting...")
        try:
            password = None
            if server.password:
                password = encryption.decrypt_password(server.password)
            
            success = udp_listener.start_listener(
                server_id=server.id,
                host=server.host,
                port=server.port,
                password=password
            )
            
            if success:
                log(f"[AUTO-START] OK: Listener started for server {server_id}")
            else:
                log(f"[AUTO-START] FAIL: Could not start listener for server {server_id}")
        except Exception as e:
            log(f"[AUTO-START] Error starting listener for server {server_id}: {e}")
    
    # Ограничение на limit
    if limit > 500:
        limit = 500
    
    # Получаем записи
    logs = db.query(models.SQLCommandLog).filter(
        models.SQLCommandLog.server_id == server_id
    ).order_by(
        models.SQLCommandLog.received_at.desc()
    ).offset(offset).limit(limit).all()
    
    # Считаем общее количество
    total = db.query(models.SQLCommandLog).filter(
        models.SQLCommandLog.server_id == server_id
    ).count()
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": log.id,
                "command_id": log.command_id,
                "sql_text": log.sql_text,
                "received_at": log.received_at,
                "processed": log.processed
            }
            for log in logs
        ]
    }


@app.delete("/api/sql-log/clear-all")
async def clear_all_sql_logs(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить все SQL логи для ВСЕХ серверов пользователя"""
    # Получаем все серверы пользователя
    user_server_ids = db.query(models.Server.id).filter(
        models.Server.user_id == current_user.id
    ).all()
    server_ids = [sid[0] for sid in user_server_ids]
    
    # Удаляем все логи для этих серверов
    deleted_count = db.query(models.SQLCommandLog).filter(
        models.SQLCommandLog.server_id.in_(server_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} записей SQL логов со всех серверов",
        "deleted_count": deleted_count,
        "servers_count": len(server_ids)
    }


@app.delete("/api/servers/{server_id}/sql-log/clear")
async def clear_sql_logs(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить все SQL логи для сервера"""
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Удаляем все логи
    deleted_count = db.query(models.SQLCommandLog).filter(
        models.SQLCommandLog.server_id == server_id
    ).delete()
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} записей SQL логов",
        "server_id": server_id,
        "deleted_count": deleted_count
    }


@app.delete("/api/orders/clear-all")
async def clear_all_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить все ордера для ВСЕХ серверов пользователя"""
    # Получаем все серверы пользователя
    user_server_ids = db.query(models.Server.id).filter(
        models.Server.user_id == current_user.id
    ).all()
    server_ids = [sid[0] for sid in user_server_ids]
    
    # Удаляем все ордера для этих серверов
    deleted_count = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} ордеров со всех серверов",
        "deleted_count": deleted_count,
        "servers_count": len(server_ids)
    }


@app.delete("/api/servers/{server_id}/orders/clear")
async def clear_orders(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить все ордера для сервера"""
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Удаляем все ордера
    deleted_count = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    ).delete()
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} ордеров",
        "server_id": server_id,
        "deleted_count": deleted_count
    }


# ==================== MOONBOT ORDERS ENDPOINTS ====================

@app.get("/api/servers/{server_id}/orders")
async def get_moonbot_orders(
    server_id: int,
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    emulator: Optional[str] = None,  # "true", "false", "all" или None (по умолчанию все)
    limit: int = 100,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить ордера MoonBot с сервера
    
    Args:
        server_id: ID сервера
        status: Фильтр по статусу (Open, Closed, Cancelled)
        symbol: Фильтр по тикеру (BTC, ETH...)
        emulator: Фильтр по эмулятору ("true" - только эмуляторные, "false" - только реальные, "all" или None - все)
        limit: Количество записей (max 500)
        offset: Смещение для пагинации
    """
    # ИСПРАВЛЕНО: Валидация limit и offset
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be >= 1")
    if limit > 500:
        limit = 500
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0")
    
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Строим запрос
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    if status:
        query = query.filter(models.MoonBotOrder.status == status)
    
    if symbol:
        query = query.filter(models.MoonBotOrder.symbol == symbol.upper())
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        query = query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    # Получаем ордера
    orders = query.order_by(
        models.MoonBotOrder.updated_at.desc()
    ).offset(offset).limit(limit).all()
    
    # Считаем общее количество
    total = query.count()
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "default_currency": server.default_currency or "USDT",  # 💱 Валюта сервера
        "total": total,
        "offset": offset,
        "limit": limit,
        "orders": [
            {
                "id": order.id,
                "moonbot_order_id": order.moonbot_order_id,
                "symbol": order.symbol,
                "buy_price": order.buy_price,
                "sell_price": order.sell_price,
                "quantity": order.quantity,
                "status": order.status,
                "profit_btc": order.profit_btc,
                "profit_percent": order.profit_percent,
                "sell_reason": order.sell_reason,
                "strategy": order.strategy,
                "opened_at": order.opened_at,
                "closed_at": order.closed_at,
                "created_at": order.created_at,
                "updated_at": order.updated_at,
                # Новые расширенные поля
                "is_emulator": order.is_emulator,
                "signal_type": order.signal_type,
                "base_currency": order.base_currency,
                "safety_orders_used": order.safety_orders_used,
                "latency": order.latency,
                "ping": order.ping,
                "task_id": order.task_id,
                "exchange_1h_delta": order.exchange_1h_delta,
                "exchange_24h_delta": order.exchange_24h_delta,
                "bought_so": order.bought_so,
                "btc_in_delta": order.btc_in_delta,
                "price_blow": order.price_blow,
                "daily_vol": order.daily_vol,
                "ex_order_id": order.ex_order_id,
            }
            for order in orders
        ]
    }


@app.get("/api/servers/{server_id}/orders/stats")
async def get_orders_stats(
    server_id: int,
    emulator: Optional[str] = Query(None, description="Фильтр по типу ордеров: 'real', 'emulator', or null для всех"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по ордерам сервера с учётом фильтра эмулятор/реальные"""
    from sqlalchemy import func, case
    
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Базовый запрос
    base_query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    # Применяем фильтр эмулятор/реальные
    if emulator == 'real':
        base_query = base_query.filter(models.MoonBotOrder.is_emulator == False)
    elif emulator == 'emulator':
        base_query = base_query.filter(models.MoonBotOrder.is_emulator == True)
    # Если emulator == None или 'all' - не фильтруем
    
    # Агрегация статистики одним запросом
    stats_query = base_query.with_entities(
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(case((models.MoonBotOrder.status == "Open", 1), else_=0)).label('open_count'),
        func.sum(case((models.MoonBotOrder.status == "Closed", 1), else_=0)).label('closed_count'),
        func.sum(models.MoonBotOrder.profit_btc).label('total_profit')
    ).first()
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "default_currency": server.default_currency or "USDT",  # 💱 Валюта сервера
        "total_orders": stats_query.total or 0,
        "open_orders": stats_query.open_count or 0,
        "closed_orders": stats_query.closed_count or 0,
        "total_profit_btc": float(stats_query.total_profit or 0.0)
    }


@app.get("/api/servers/{server_id}/orders/profit-chart")
async def get_profit_chart_data(
    server_id: int,
    period: str = "day",  # day, week, month
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные для графика прибыли
    
    period: day (24 часа), week (7 дней), month (30 дней)
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Определяем период
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(hours=24)
        time_format = "%H:00"  # По часам
    elif period == "week":
        start_date = now - timedelta(days=7)
        time_format = "%Y-%m-%d"  # По дням
    elif period == "month":
        start_date = now - timedelta(days=30)
        time_format = "%Y-%m-%d"  # По дням
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use: day, week, month")
    
    # Получаем закрытые ордера за период
    closed_orders = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at >= start_date
    ).order_by(models.MoonBotOrder.closed_at).all()
    
    # Группируем по времени
    data_points = {}
    cumulative_profit = 0.0
    
    for order in closed_orders:
        if order.closed_at:
            time_key = order.closed_at.strftime(time_format)
            profit = float(order.profit_btc or 0.0)
            cumulative_profit += profit
            
            if time_key not in data_points:
                data_points[time_key] = {
                    "time": time_key,
                    "profit": 0.0,
                    "cumulative_profit": 0.0,
                    "orders_count": 0
                }
            
            data_points[time_key]["profit"] += profit
            data_points[time_key]["cumulative_profit"] = cumulative_profit
            data_points[time_key]["orders_count"] += 1
    
    # Преобразуем в список и сортируем
    chart_data = sorted(data_points.values(), key=lambda x: x["time"])
    
    # Если данных нет, возвращаем пустой массив
    if not chart_data:
        return {
            "server_id": server_id,
            "server_name": server.name,
            "period": period,
            "data": []
        }
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "period": period,
        "data": chart_data
    }


@app.get("/api/profit-chart-all")
async def get_profit_chart_all_servers(
    period: str = "day",  # day, week, month
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить агрегированные данные графика прибыли со всех серверов пользователя
    
    period: day (24 часа), week (7 дней), month (30 дней)
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Определяем период
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(hours=24)
        time_format = "%H:00"  # По часам
    elif period == "week":
        start_date = now - timedelta(days=7)
        time_format = "%Y-%m-%d"  # По дням
    elif period == "month":
        start_date = now - timedelta(days=30)
        time_format = "%Y-%m-%d"  # По дням
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use: day, week, month")
    
    # Получаем все сервера пользователя
    user_servers = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()
    
    if not user_servers:
        return {
            "period": period,
            "data": []
        }
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем закрытые ордера за период со всех серверов
    closed_orders = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_ids),
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at >= start_date
    ).order_by(models.MoonBotOrder.closed_at).all()
    
    # Группируем по времени
    data_points = {}
    cumulative_profit = 0.0
    
    for order in closed_orders:
        if order.closed_at:
            time_key = order.closed_at.strftime(time_format)
            profit = float(order.profit_btc or 0.0)
            cumulative_profit += profit
            
            if time_key not in data_points:
                data_points[time_key] = {
                    "time": time_key,
                    "profit": 0.0,
                    "cumulative_profit": 0.0,
                    "orders_count": 0
                }
            
            data_points[time_key]["profit"] += profit
            data_points[time_key]["cumulative_profit"] = cumulative_profit
            data_points[time_key]["orders_count"] += 1
    
    # Преобразуем в список и сортируем
    chart_data = sorted(data_points.values(), key=lambda x: x["time"])
    
    return {
        "period": period,
        "data": chart_data
    }


@app.get("/api/servers/{server_id}/strategies/comparison")
async def get_strategies_comparison(
    server_id: int,
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить сравнительную статистику по стратегиям для конкретного сервера
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    """
    from sqlalchemy import func
    
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Получаем все ордера с группировкой по стратегиям
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        query = query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    orders = query.all()
    
    # Группируем данные по стратегиям
    strategies_data = {}
    
    for order in orders:
        strategy = order.strategy or "Unknown"
        
        if strategy not in strategies_data:
            strategies_data[strategy] = {
                "strategy": strategy,
                "total_orders": 0,
                "open_orders": 0,
                "closed_orders": 0,
                "total_profit": 0.0,
                "winning_orders": 0,
                "losing_orders": 0,
                "total_spent": 0.0,
                "total_gained": 0.0,
                "avg_profit_per_order": 0.0,
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "best_trade": 0.0,
                "worst_trade": 0.0
            }
        
        strategy_stats = strategies_data[strategy]
        strategy_stats["total_orders"] += 1
        
        if order.status == "Open":
            strategy_stats["open_orders"] += 1
        elif order.status == "Closed":
            strategy_stats["closed_orders"] += 1
        
        # Прибыль
        profit = float(order.profit_btc or 0.0)
        strategy_stats["total_profit"] += profit
        
        if profit > 0:
            strategy_stats["winning_orders"] += 1
        elif profit < 0:
            strategy_stats["losing_orders"] += 1
        
        # Потрачено и получено
        spent = float(order.spent_btc or 0.0)
        gained = float(order.gained_btc or 0.0)
        strategy_stats["total_spent"] += spent
        strategy_stats["total_gained"] += gained
        
        # Лучшая и худшая сделка
        if profit > strategy_stats["best_trade"]:
            strategy_stats["best_trade"] = profit
        if profit < strategy_stats["worst_trade"]:
            strategy_stats["worst_trade"] = profit
    
    # Вычисляем производные метрики
    for strategy, stats in strategies_data.items():
        if stats["closed_orders"] > 0:
            stats["avg_profit_per_order"] = stats["total_profit"] / stats["closed_orders"]
            stats["win_rate"] = (stats["winning_orders"] / stats["closed_orders"]) * 100
        
        # Profit Factor = (Суммарная прибыль по прибыльным сделкам) / (Суммарный убыток по убыточным сделкам)
        total_wins = sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) > 0)
        total_losses = abs(sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) < 0))
        
        if total_losses > 0:
            stats["profit_factor"] = total_wins / total_losses
        elif total_wins > 0:
            stats["profit_factor"] = 999.99  # Бесконечность (нет убытков)
        else:
            stats["profit_factor"] = 0.0
    
    # Преобразуем в список и сортируем по общей прибыли
    strategies_list = sorted(strategies_data.values(), key=lambda x: x["total_profit"], reverse=True)
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "strategies": strategies_list
    }


@app.get("/api/strategies/comparison-all")
async def get_strategies_comparison_all(
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    server_ids: Optional[str] = None,  # Список ID серверов через запятую
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить сравнительную статистику по стратегиям со всех серверов пользователя
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    - server_ids: список ID серверов через запятую (опционально)
    """
    from sqlalchemy import func
    
    # Получаем сервера пользователя
    servers_query = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтруем по конкретным ID серверов если указаны
    if server_ids:
        try:
            server_id_list = [int(sid) for sid in server_ids.split(',') if sid.strip()]
            servers_query = servers_query.filter(models.Server.id.in_(server_id_list))
        except ValueError:
            return {"strategies": []}
    
    user_servers = servers_query.all()
    
    if not user_servers:
        return {"strategies": []}
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем все ордера со всех серверов
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_ids)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        query = query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    orders = query.all()
    
    # Группируем данные по стратегиям (аналогично выше)
    strategies_data = {}
    
    for order in orders:
        strategy = order.strategy or "Unknown"
        
        if strategy not in strategies_data:
            strategies_data[strategy] = {
                "strategy": strategy,
                "total_orders": 0,
                "open_orders": 0,
                "closed_orders": 0,
                "total_profit": 0.0,
                "winning_orders": 0,
                "losing_orders": 0,
                "total_spent": 0.0,
                "total_gained": 0.0,
                "avg_profit_per_order": 0.0,
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "best_trade": 0.0,
                "worst_trade": 0.0
            }
        
        strategy_stats = strategies_data[strategy]
        strategy_stats["total_orders"] += 1
        
        if order.status == "Open":
            strategy_stats["open_orders"] += 1
        elif order.status == "Closed":
            strategy_stats["closed_orders"] += 1
        
        profit = float(order.profit_btc or 0.0)
        strategy_stats["total_profit"] += profit
        
        if profit > 0:
            strategy_stats["winning_orders"] += 1
        elif profit < 0:
            strategy_stats["losing_orders"] += 1
        
        spent = float(order.spent_btc or 0.0)
        gained = float(order.gained_btc or 0.0)
        strategy_stats["total_spent"] += spent
        strategy_stats["total_gained"] += gained
        
        if profit > strategy_stats["best_trade"]:
            strategy_stats["best_trade"] = profit
        if profit < strategy_stats["worst_trade"]:
            strategy_stats["worst_trade"] = profit
    
    # Вычисляем производные метрики
    for strategy, stats in strategies_data.items():
        if stats["closed_orders"] > 0:
            stats["avg_profit_per_order"] = stats["total_profit"] / stats["closed_orders"]
            stats["win_rate"] = (stats["winning_orders"] / stats["closed_orders"]) * 100
        
        total_wins = sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) > 0)
        total_losses = abs(sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) < 0))
        
        if total_losses > 0:
            stats["profit_factor"] = total_wins / total_losses
        elif total_wins > 0:
            stats["profit_factor"] = 999.99
        else:
            stats["profit_factor"] = 0.0
    
    strategies_list = sorted(strategies_data.values(), key=lambda x: x["total_profit"], reverse=True)
    
    return {"strategies": strategies_list}


@app.get("/api/servers/{server_id}/heatmap")
async def get_activity_heatmap(
    server_id: int,
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные для heatmap активности бота (час дня x день недели)
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    """
    from datetime import datetime
    
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Получаем все закрытые ордера
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        query = query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    orders = query.all()
    
    # Создаём матрицу: день недели (0-6) x час (0-23)
    # Значение = суммарная прибыль за этот период
    heatmap_data = {}
    for day in range(7):  # 0=Monday, 6=Sunday
        heatmap_data[day] = {}
        for hour in range(24):
            heatmap_data[day][hour] = {
                "profit": 0.0,
                "count": 0
            }
    
    # Заполняем данные
    for order in orders:
        if order.closed_at:
            # Получаем день недели и час
            weekday = order.closed_at.weekday()  # 0=Monday, 6=Sunday
            hour = order.closed_at.hour
            
            profit = float(order.profit_btc or 0.0)
            heatmap_data[weekday][hour]["profit"] += profit
            heatmap_data[weekday][hour]["count"] += 1
    
    # Преобразуем в формат для фронтенда
    heatmap_array = []
    day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    
    for day in range(7):
        for hour in range(24):
            data = heatmap_data[day][hour]
            heatmap_array.append({
                "day": day,
                "day_name": day_names[day],
                "hour": hour,
                "profit": data["profit"],
                "count": data["count"],
                "avg_profit": data["profit"] / data["count"] if data["count"] > 0 else 0.0
            })
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "data": heatmap_array
    }


@app.get("/api/heatmap-all")
async def get_activity_heatmap_all(
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    server_ids: Optional[str] = None,  # Список ID серверов через запятую
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные для heatmap активности со всех серверов пользователя
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    - server_ids: список ID серверов через запятую (опционально)
    """
    from datetime import datetime
    
    # Получаем сервера пользователя
    servers_query = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтруем по конкретным ID серверов если указаны
    if server_ids:
        try:
            server_id_list = [int(sid) for sid in server_ids.split(',') if sid.strip()]
            servers_query = servers_query.filter(models.Server.id.in_(server_id_list))
        except ValueError:
            return {"data": []}
    
    user_servers = servers_query.all()
    
    if not user_servers:
        return {"data": []}
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем все закрытые ордера со всех серверов
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_ids),
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        query = query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    orders = query.all()
    
    # Создаём матрицу
    heatmap_data = {}
    for day in range(7):
        heatmap_data[day] = {}
        for hour in range(24):
            heatmap_data[day][hour] = {
                "profit": 0.0,
                "count": 0
            }
    
    # Заполняем данные
    for order in orders:
        if order.closed_at:
            weekday = order.closed_at.weekday()
            hour = order.closed_at.hour
            
            profit = float(order.profit_btc or 0.0)
            heatmap_data[weekday][hour]["profit"] += profit
            heatmap_data[weekday][hour]["count"] += 1
    
    # Преобразуем в формат для фронтенда
    heatmap_array = []
    day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    
    for day in range(7):
        for hour in range(24):
            data = heatmap_data[day][hour]
            heatmap_array.append({
                "day": day,
                "day_name": day_names[day],
                "hour": hour,
                "profit": data["profit"],
                "count": data["count"],
                "avg_profit": data["profit"] / data["count"] if data["count"] > 0 else 0.0
            })
    
    return {"data": heatmap_array}


@app.post("/api/servers/{server_id}/listener/send-command")
async def send_command_through_listener(
    server_id: int,
    command: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отправить команду через UDP listener
    
    Это важно для команд типа SQLSelect, которые возвращают большое количество данных,
    которые listener должен получить и обработать автоматически.
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Проверяем что listener запущен
    listener_status = udp_listener.get_listener_status(server_id)
    if not listener_status["is_running"]:
        raise HTTPException(status_code=400, detail="UDP Listener не запущен для этого сервера")
    
    # Получаем listener и отправляем команду
    listener = udp_listener.active_listeners.get(server_id)
    if not listener:
        raise HTTPException(status_code=500, detail="Listener не найден в памяти")
    
    try:
        listener.send_command(command)
        return {
            "success": True,
            "message": f"Команда '{command}' отправлена через listener",
            "note": "Данные будут обработаны автоматически. Проверьте SQL Logs и Orders через несколько секунд."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки команды: {str(e)}")


# ==================== SYNC (SQLSelect) ENDPOINT ====================

@app.post("/api/servers/{server_id}/sync-from-datetime")
async def sync_orders_from_datetime(
    server_id: int,
    from_datetime: datetime,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Синхронизация данных с сервера начиная с указанной даты
    
    Отправляет команду SQLSelect datetime на MoonBot,
    который вернет все SQL команды с этого времени.
    
    Args:
        server_id: ID сервера
        from_datetime: Начальная дата/время для синхронизации
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Формируем команду SQLSelect
    # Формат: SQLSelect 2025-11-05T10:00:00
    datetime_str = from_datetime.strftime('%Y-%m-%dT%H:%M:%S')
    command = f"SQLSelect {datetime_str}"
    
    # Отправляем с многопакетным приемом (может быть много данных!)
    client = UDPClient()
    success, responses = await client.send_command_multi_response(
        server.host,
        server.port,
        command,
        timeout=60,  # Большой timeout
        password=get_decrypted_password(server),
        packet_timeout=2.0  # 2 секунды между пакетами
    )
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось выполнить синхронизацию: {responses}"
        )
    
    # Парсим все SQL команды из ответа
    sql_commands = []
    for line in responses.split('\n'):
        if '[SQLCommand' in line:
            sql_commands.append(line)
    
    # Сохраняем каждую команду
    saved_count = 0
    for sql_cmd in sql_commands:
        try:
            # Парсим как в listener
            match = re.search(r'\[SQLCommand (\d+)\]', sql_cmd)
            if not match:
                continue
            
            command_id = int(match.group(1))
            sql_body = sql_cmd[match.end():].strip()
            
            # Проверяем что такой команды еще нет
            existing = db.query(models.SQLCommandLog).filter(
                models.SQLCommandLog.server_id == server_id,
                models.SQLCommandLog.command_id == command_id
            ).first()
            
            if not existing:
                # Сохраняем новую
                sql_log = models.SQLCommandLog(
                    server_id=server_id,
                    command_id=command_id,
                    sql_text=sql_body,
                    received_at=datetime.utcnow(),
                    processed=False
                )
                db.add(sql_log)
                saved_count += 1
        
        except Exception as e:
            log(f"[SYNC] Error parsing command: {e}")
            continue
    
    db.commit()
    
    return {
        "message": "Синхронизация завершена",
        "server_id": server_id,
        "server_name": server.name,
        "from_datetime": datetime_str,
        "commands_received": len(sql_commands),
        "commands_saved": saved_count
    }


@app.post("/api/servers/{server_id}/sync-missing")
async def sync_missing_data(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Автоматическая синхронизация пропущенных данных
    
    Определяет время последней записи в БД и запрашивает
    все данные начиная с этого времени.
    """
    # Проверяем что сервер принадлежит пользователю
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Находим последнюю запись
    last_log = db.query(models.SQLCommandLog).filter(
        models.SQLCommandLog.server_id == server_id
    ).order_by(
        models.SQLCommandLog.received_at.desc()
    ).first()
    
    if last_log:
        # Синхронизируем с момента последней записи
        from_datetime = last_log.received_at
    else:
        # Если записей нет - синхронизируем за последние 24 часа
        from datetime import timedelta
        from_datetime = datetime.utcnow() - timedelta(hours=24)
    
    # Вызываем sync_from_datetime
    return await sync_orders_from_datetime(
        server_id=server_id,
        from_datetime=from_datetime,
        current_user=current_user,
        db=db
    )


@app.get("/api/trading-stats")
async def get_trading_stats(
    server_ids: Optional[str] = None,  # "all" или "1,2,3"
    strategies: Optional[str] = None,  # "all" или "Strategy1,Strategy2"
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    time_period: Optional[str] = None,  # "today", "week", "month", "all", "custom"
    date_from: Optional[str] = None,  # "YYYY-MM-DD" для custom периода
    date_to: Optional[str] = None,  # "YYYY-MM-DD" для custom периода
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить расширенную статистику торговли с фильтрацией по ботам и стратегиям
    
    Параметры:
    - server_ids: "all" для всех серверов, или "1,2,3" для конкретных
    - strategies: "all" для всех стратегий, или "Strategy1,Strategy2" для конкретных
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    - time_period: "today", "week", "month", "all", "custom" для фильтрации по времени
    - date_from: начальная дата для кастомного периода (YYYY-MM-DD)
    - date_to: конечная дата для кастомного периода (YYYY-MM-DD)
    """
    from sqlalchemy import func, and_, or_
    
    # Базовый запрос - только сервера пользователя
    base_query = db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтр по серверам
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            base_query = base_query.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except:
            raise HTTPException(status_code=400, detail="Неверный формат server_ids")
    
    # Фильтр по стратегиям
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        base_query = base_query.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        base_query = base_query.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    # Фильтр по времени
    from datetime import datetime, timedelta
    now = datetime.now()  # Определяем сразу, используется в нескольких местах
    
    if time_period:
        if time_period == "today":
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            base_query = base_query.filter(models.MoonBotOrder.opened_at >= start_of_day)
        elif time_period == "week":
            start_of_week = now - timedelta(days=7)
            base_query = base_query.filter(models.MoonBotOrder.opened_at >= start_of_week)
        elif time_period == "month":
            start_of_month = now - timedelta(days=30)
            base_query = base_query.filter(models.MoonBotOrder.opened_at >= start_of_month)
        elif time_period == "custom":
            # Кастомный период
            if date_from and date_to:
                try:
                    from_date = datetime.strptime(date_from, "%Y-%m-%d")
                    to_date = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                    base_query = base_query.filter(
                        models.MoonBotOrder.opened_at >= from_date,
                        models.MoonBotOrder.opened_at <= to_date
                    )
                except ValueError:
                    raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
    
    # Общая статистика
    total_orders = base_query.count()
    open_orders = base_query.filter(models.MoonBotOrder.status == "Open").count()
    closed_orders = base_query.filter(models.MoonBotOrder.status == "Closed").count()
    
    # Прибыль (используем subquery вместо материализации)
    total_profit = base_query.with_entities(func.sum(models.MoonBotOrder.profit_btc)).scalar() or 0.0
    
    # Средняя прибыль на сделку
    avg_profit = total_profit / total_orders if total_orders > 0 else 0.0
    
    # Прибыльные и убыточные сделки
    profitable_count = base_query.filter(models.MoonBotOrder.profit_btc > 0).count()
    losing_count = base_query.filter(models.MoonBotOrder.profit_btc < 0).count()
    
    # Винрейт
    winrate = (profitable_count / total_orders * 100) if total_orders > 0 else 0.0
    
    # ===== РАСШИРЕННЫЕ МЕТРИКИ =====
    
    # Profit Factor (отношение прибыли к убыткам)
    total_wins = base_query.filter(models.MoonBotOrder.profit_btc > 0).with_entities(
        func.sum(models.MoonBotOrder.profit_btc)
    ).scalar() or 0.0
    total_losses = abs(base_query.filter(models.MoonBotOrder.profit_btc < 0).with_entities(
        func.sum(models.MoonBotOrder.profit_btc)
    ).scalar() or 0.0)
    
    profit_factor = (total_wins / total_losses) if total_losses > 0 else (999.99 if total_wins > 0 else 0.0)
    
    # Max Drawdown (максимальная просадка)
    closed_orders_list = base_query.filter(
        models.MoonBotOrder.status == "Closed"
    ).order_by(models.MoonBotOrder.closed_at.asc()).all()
    
    cumulative_profit = 0.0
    peak_profit = 0.0
    max_drawdown = 0.0
    
    for order in closed_orders_list:
        cumulative_profit += (order.profit_btc or 0.0)
        if cumulative_profit > peak_profit:
            peak_profit = cumulative_profit
        drawdown = peak_profit - cumulative_profit
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    # Средняя длительность сделки (в часах)
    closed_with_times = base_query.filter(
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.opened_at.isnot(None),
        models.MoonBotOrder.closed_at.isnot(None)
    ).all()
    
    if closed_with_times:
        total_duration_seconds = sum([
            (order.closed_at - order.opened_at).total_seconds()
            for order in closed_with_times
        ])
        avg_duration_hours = (total_duration_seconds / len(closed_with_times)) / 3600
    else:
        avg_duration_hours = 0.0
    
    # ROI (Return on Investment) - упрощённая версия
    total_spent = base_query.with_entities(func.sum(models.MoonBotOrder.spent_btc)).scalar() or 0.0
    
    roi = ((total_profit / total_spent) * 100) if total_spent > 0 else 0.0
    
    # Серии побед и поражений
    all_orders_sorted = base_query.filter(
        models.MoonBotOrder.status == "Closed"
    ).order_by(models.MoonBotOrder.closed_at.asc()).all()
    
    current_win_streak = 0
    current_loss_streak = 0
    max_win_streak = 0
    max_loss_streak = 0
    
    for order in all_orders_sorted:
        profit = order.profit_btc or 0.0
        if profit > 0:
            current_win_streak += 1
            current_loss_streak = 0
            if current_win_streak > max_win_streak:
                max_win_streak = current_win_streak
        elif profit < 0:
            current_loss_streak += 1
            current_win_streak = 0
            if current_loss_streak > max_loss_streak:
                max_loss_streak = current_loss_streak
    
    # Статистика по стратегиям
    strategy_stats = db.query(
        models.MoonBotOrder.strategy,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.avg(models.MoonBotOrder.profit_percent).label('avg_profit_percent')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id
    )
    
    # Применяем фильтры к статистике стратегий
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            strategy_stats = strategy_stats.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except:
            pass
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        strategy_stats = strategy_stats.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        strategy_stats = strategy_stats.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    strategy_stats = strategy_stats.group_by(models.MoonBotOrder.strategy).all()
    
    # Статистика по серверам (ботам)
    server_stats = db.query(
        models.Server.id,
        models.Server.name,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit')
    ).join(
        models.MoonBotOrder,
        models.Server.id == models.MoonBotOrder.server_id
    ).filter(
        models.Server.user_id == current_user.id
    )
    
    # Применяем фильтры к статистике серверов
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            server_stats = server_stats.filter(models.Server.id.in_(server_id_list))
        except:
            pass
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        server_stats = server_stats.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    server_stats = server_stats.group_by(models.Server.id, models.Server.name).all()
    
    # Топ прибыльных сделок
    top_profitable = base_query.filter(
        models.MoonBotOrder.profit_btc > 0
    ).order_by(
        models.MoonBotOrder.profit_btc.desc()
    ).limit(10).all()
    
    # Топ убыточных сделок
    top_losing = base_query.filter(
        models.MoonBotOrder.profit_btc < 0
    ).order_by(
        models.MoonBotOrder.profit_btc.asc()
    ).limit(10).all()
    
    # Статистика по символам
    symbol_stats = db.query(
        models.MoonBotOrder.symbol,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.avg(models.MoonBotOrder.profit_percent).label('avg_profit_percent')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id
    )
    
    # Применяем фильтры к статистике символов
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            symbol_stats = symbol_stats.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except:
            pass
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        symbol_stats = symbol_stats.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    symbol_stats = symbol_stats.group_by(models.MoonBotOrder.symbol).order_by(
        func.sum(models.MoonBotOrder.profit_btc).desc()
    ).all()
    
    # Список всех доступных стратегий
    all_strategies = db.query(models.MoonBotOrder.strategy).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.strategy.isnot(None)
    ).distinct().all()
    
    # Список всех доступных серверов пользователя
    all_servers = db.query(models.Server.id, models.Server.name).filter(
        models.Server.user_id == current_user.id,
        models.Server.is_active == True
    ).all()
    
    # ===== ГРАФИК ПРИБЫЛИ ПО ВРЕМЕНИ =====
    # Получаем закрытые ордера с группировкой по дате
    profit_by_date = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Применяем те же фильтры
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            profit_by_date = profit_by_date.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except:
            pass
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    if time_period:
        if time_period == "today":
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            profit_by_date = profit_by_date.filter(models.MoonBotOrder.closed_at >= start_of_day)
        elif time_period == "week":
            start_of_week = now - timedelta(days=7)
            profit_by_date = profit_by_date.filter(models.MoonBotOrder.closed_at >= start_of_week)
        elif time_period == "month":
            start_of_month = now - timedelta(days=30)
            profit_by_date = profit_by_date.filter(models.MoonBotOrder.closed_at >= start_of_month)
    
    profit_by_date = profit_by_date.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').all()
    
    # Вычисляем накопительную прибыль
    cumulative_profit = 0.0
    profit_timeline = []
    for item in profit_by_date:
        cumulative_profit += float(item.profit or 0.0)
        profit_timeline.append({
            "date": str(item.date),
            "daily_profit": round(float(item.profit or 0.0), 2),
            "cumulative_profit": round(cumulative_profit, 2)
        })
    
    # ===== ВИНРЕЙТ ПО ДНЯМ =====
    from sqlalchemy import case  # Добавляем импорт case
    
    winrate_by_date = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(case((models.MoonBotOrder.profit_btc > 0, 1), else_=0)).label('wins')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Применяем фильтры
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except:
            pass
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    if emulator and emulator.lower() in ['true', 'false']:
        is_emulator = emulator.lower() == 'true'
        winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.is_emulator == is_emulator)
    
    if time_period:
        if time_period == "today":
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.closed_at >= start_of_day)
        elif time_period == "week":
            start_of_week = now - timedelta(days=7)
            winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.closed_at >= start_of_week)
        elif time_period == "month":
            start_of_month = now - timedelta(days=30)
            winrate_by_date = winrate_by_date.filter(models.MoonBotOrder.closed_at >= start_of_month)
    
    winrate_by_date = winrate_by_date.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').all()
    
    winrate_timeline = []
    for item in winrate_by_date:
        wins = int(item.wins or 0)
        total = int(item.total or 0)
        winrate_val = (wins / total * 100) if total > 0 else 0.0
        winrate_timeline.append({
            "date": str(item.date),
            "winrate": round(winrate_val, 2),
            "total_orders": total,
            "wins": wins
        })
    
    # ===== СРАВНЕНИЕ С ПРЕДЫДУЩИМ ПЕРИОДОМ =====
    previous_stats = None
    if time_period and time_period != "all":
        # Вычисляем границы предыдущего периода
        if time_period == "today":
            prev_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
            prev_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_period == "week":
            prev_start = now - timedelta(days=14)
            prev_end = now - timedelta(days=7)
        elif time_period == "month":
            prev_start = now - timedelta(days=60)
            prev_end = now - timedelta(days=30)
        
        # Запрос для предыдущего периода
        prev_query = db.query(models.MoonBotOrder).join(
            models.Server,
            models.MoonBotOrder.server_id == models.Server.id
        ).filter(
            models.Server.user_id == current_user.id,
            models.MoonBotOrder.opened_at >= prev_start,
            models.MoonBotOrder.opened_at < prev_end
        )
        
        # Применяем фильтры
        if server_ids and server_ids != "all":
            try:
                server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
                prev_query = prev_query.filter(models.MoonBotOrder.server_id.in_(server_id_list))
            except:
                pass
        
        if strategies and strategies != "all":
            strategy_list = [s.strip() for s in strategies.split(',')]
            prev_query = prev_query.filter(models.MoonBotOrder.strategy.in_(strategy_list))
        
        if emulator and emulator.lower() in ['true', 'false']:
            is_emulator = emulator.lower() == 'true'
            prev_query = prev_query.filter(models.MoonBotOrder.is_emulator == is_emulator)
        
        prev_total_orders = prev_query.count()
        prev_total_profit = db.query(func.sum(models.MoonBotOrder.profit_btc)).filter(
            models.MoonBotOrder.id.in_([o.id for o in prev_query.all()])
        ).scalar() or 0.0
        
        prev_profitable_count = prev_query.filter(models.MoonBotOrder.profit_btc > 0).count()
        prev_winrate = (prev_profitable_count / prev_total_orders * 100) if prev_total_orders > 0 else 0.0
        
        # Вычисляем изменения
        profit_change = total_profit - prev_total_profit
        profit_change_percent = ((total_profit - prev_total_profit) / abs(prev_total_profit) * 100) if prev_total_profit != 0 else 0.0
        
        winrate_change = winrate - prev_winrate
        
        orders_change = total_orders - prev_total_orders
        orders_change_percent = ((total_orders - prev_total_orders) / prev_total_orders * 100) if prev_total_orders > 0 else 0.0
        
        previous_stats = {
            "profit_change": round(profit_change, 2),
            "profit_change_percent": round(profit_change_percent, 2),
            "winrate_change": round(winrate_change, 2),
            "orders_change": orders_change,
            "orders_change_percent": round(orders_change_percent, 2),
            "prev_total_profit": round(prev_total_profit, 2),
            "prev_winrate": round(prev_winrate, 2),
            "prev_total_orders": prev_total_orders
        }
    
    return {
        "overall": {
            "total_orders": total_orders,
            "open_orders": open_orders,
            "closed_orders": closed_orders,
            "total_profit": round(total_profit, 2),
            "avg_profit": round(avg_profit, 2),
            "profitable_count": profitable_count,
            "losing_count": losing_count,
            "winrate": round(winrate, 2),
            # Новые метрики
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": round(max_drawdown, 2),
            "avg_duration_hours": round(avg_duration_hours, 2),
            "roi": round(roi, 2),
            "max_win_streak": max_win_streak,
            "max_loss_streak": max_loss_streak,
            "total_wins": round(total_wins, 2),
            "total_losses": round(total_losses, 2)
        },
        "by_strategy": [
            {
                "strategy": s.strategy or "Unknown",
                "total_orders": s.total or 0,
                "total_profit": round(s.profit or 0, 2),
                "avg_profit_percent": round(s.avg_profit_percent or 0, 2),
                "winrate": round(
                    (base_query.filter(
                        models.MoonBotOrder.strategy == s.strategy,
                        models.MoonBotOrder.profit_btc > 0
                    ).count() / s.total * 100) if s.total > 0 else 0.0, 2
                )
            }
            for s in strategy_stats
        ],
        "by_server": [
            {
                "server_id": s.id,
                "server_name": s.name,
                "total_orders": s.total or 0,
                "total_profit": round(s.profit or 0, 2),
                "open_orders": db.query(func.count(models.MoonBotOrder.id)).filter(
                    models.MoonBotOrder.server_id == s.id,
                    models.MoonBotOrder.status == "Open"
                ).scalar() or 0,
                "winrate": round(
                    (db.query(func.count(models.MoonBotOrder.id)).filter(
                        models.MoonBotOrder.server_id == s.id,
                        models.MoonBotOrder.profit_btc > 0
                    ).scalar() / s.total * 100) if s.total > 0 else 0.0, 2
                )
            }
            for s in server_stats
        ],
        "by_symbol": [
            {
                "symbol": s.symbol or "UNKNOWN",
                "total_orders": s.total or 0,
                "total_profit": round(s.profit or 0, 2),
                "avg_profit_percent": round(s.avg_profit_percent or 0, 2),
                "winrate": round(
                    (base_query.filter(
                        models.MoonBotOrder.symbol == s.symbol,
                        models.MoonBotOrder.profit_btc > 0
                    ).count() / s.total * 100) if s.total > 0 else 0.0, 2
                )
            }
            for s in symbol_stats
        ],
        "top_profitable": [
            {
                "id": o.moonbot_order_id,
                "symbol": o.symbol,
                "strategy": o.strategy,
                "profit": round(o.profit_btc or 0, 2),
                "profit_percent": round(o.profit_percent or 0, 2)
            }
            for o in top_profitable
        ],
        "top_losing": [
            {
                "id": o.moonbot_order_id,
                "symbol": o.symbol,
                "strategy": o.strategy,
                "profit": round(o.profit_btc or 0, 2),
                "profit_percent": round(o.profit_percent or 0, 2)
            }
            for o in top_losing
        ],
        "available_strategies": [s.strategy for s in all_strategies if s.strategy],
        "available_servers": [{"id": s.id, "name": s.name} for s in all_servers],
        "profit_timeline": profit_timeline,
        "winrate_timeline": winrate_timeline,
        "previous_period": previous_stats
    }


@app.get("/api/trading-stats/details/{entity_type}/{entity_value}")
async def get_trading_stats_details(
    entity_type: str,  # "strategy", "server", "symbol"
    entity_value: str,  # название стратегии/сервера/символа
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить детальную информацию о конкретной стратегии/боте/монете
    - График прибыли по времени
    - Список сделок
    - Распределение по символам (для стратегии)
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Базовый запрос
    base_query = db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed"
    )
    
    # Фильтр по типу сущности
    if entity_type == "strategy":
        base_query = base_query.filter(models.MoonBotOrder.strategy == entity_value)
    elif entity_type == "server":
        # entity_value - это server_name
        base_query = base_query.filter(models.Server.name == entity_value)
    elif entity_type == "symbol":
        base_query = base_query.filter(models.MoonBotOrder.symbol == entity_value)
    else:
        raise HTTPException(status_code=400, detail="Неверный entity_type")
    
    # График прибыли по времени
    profit_by_date = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.count(models.MoonBotOrder.id).label('count')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    if entity_type == "strategy":
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.strategy == entity_value)
    elif entity_type == "server":
        profit_by_date = profit_by_date.filter(models.Server.name == entity_value)
    elif entity_type == "symbol":
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.symbol == entity_value)
    
    profit_by_date = profit_by_date.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').limit(30).all()
    
    profit_timeline = []
    cumulative_profit = 0.0
    for item in profit_by_date:
        cumulative_profit += float(item.profit or 0.0)
        profit_timeline.append({
            "date": str(item.date),
            "daily_profit": round(float(item.profit or 0.0), 2),
            "cumulative_profit": round(cumulative_profit, 2),
            "orders_count": item.count
        })
    
    # Список последних сделок (топ-20)
    recent_orders = base_query.order_by(models.MoonBotOrder.closed_at.desc()).limit(20).all()
    orders_list = []
    for order in recent_orders:
        orders_list.append({
            "id": order.moonbot_order_id,
            "symbol": order.symbol,
            "strategy": order.strategy,
            "opened_at": order.opened_at.isoformat() if order.opened_at else None,
            "closed_at": order.closed_at.isoformat() if order.closed_at else None,
            "profit": round(order.profit_btc or 0, 2),
            "profit_percent": round(order.profit_percent or 0, 2),
            "order_type": order.order_type,
            "is_emulator": order.is_emulator
        })
    
    # Распределение по символам (только для стратегии)
    symbol_distribution = []
    if entity_type == "strategy":
        symbol_stats = db.query(
            models.MoonBotOrder.symbol,
            func.count(models.MoonBotOrder.id).label('count'),
            func.sum(models.MoonBotOrder.profit_btc).label('profit')
        ).join(
            models.Server,
            models.MoonBotOrder.server_id == models.Server.id
        ).filter(
            models.Server.user_id == current_user.id,
            models.MoonBotOrder.strategy == entity_value,
            models.MoonBotOrder.status == "Closed"
        ).group_by(models.MoonBotOrder.symbol).all()
        
        for item in symbol_stats:
            symbol_distribution.append({
                "symbol": item.symbol or "UNKNOWN",
                "count": item.count,
                "profit": round(float(item.profit or 0), 2)
            })
    
    return {
        "profit_timeline": profit_timeline,
        "recent_orders": orders_list,
        "symbol_distribution": symbol_distribution
    }


# ==================== WEBSOCKET ENDPOINT ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """
    WebSocket endpoint для real-time уведомлений
    
    Клиент должен передать JWT токен как query параметр:
    ws://localhost:8000/ws?token=YOUR_JWT_TOKEN
    
    Типы сообщений от сервера:
    - sql_log: Новая SQL команда от MoonBot
    - order_update: Обновление ордера
    - server_status: Изменение статуса сервера
    """
    connection_id = str(uuid.uuid4())
    current_user = None
    
    try:
        # Валидация токена
        if not token:
            await websocket.close(code=4001, reason="No token provided")
            return
        
        # Проверяем JWT токен
        try:
            from jose import jwt, JWTError
            SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
            ALGORITHM = "HS256"
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                await websocket.close(code=4002, reason="Invalid token")
                return
            
            # Получаем пользователя из БД
            db = SessionLocal()
            try:
                current_user = db.query(models.User).filter(models.User.username == username).first()
                if not current_user:
                    await websocket.close(code=4003, reason="User not found")
                    return
            finally:
                db.close()
        
        except JWTError as e:
            log(f"[WS] JWT Error: {e}", level="ERROR")
            await websocket.close(code=4004, reason="Token validation failed")
            return
        
        # Подключаем пользователя
        await ws_manager.connect(websocket, current_user.id, connection_id)
        
        # Отправляем приветственное сообщение
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connection established",
            "user_id": current_user.id,
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Слушаем сообщения от клиента (для keep-alive и возможных команд)
        while True:
            try:
                data = await websocket.receive_text()
                
                # Обрабатываем ping
                if data == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
            
            except WebSocketDisconnect:
                log(f"[WS] Client disconnected: user_id={current_user.id}, connection_id={connection_id}")
                break
            except Exception as e:
                log(f"[WS] Error receiving message: {e}")
                break
    
    except Exception as e:
        log(f"[WS] Connection error: {e}", level="ERROR")    
    finally:
        # Отключаем пользователя
        if current_user:
            await ws_manager.disconnect(current_user.id, connection_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

