"""
API для экспорта и импорта данных пользователя.

Эндпоинты:
- POST /api/data/export - экспортировать данные
- POST /api/data/import - импортировать данные
- POST /api/data/validate - валидировать файл импорта
- GET /api/data/preview - превью данных для экспорта
- GET /api/data/backups - список бэкапов
- POST /api/data/restore - восстановить из бэкапа
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import Response
from pydantic import BaseModel

from services.data_export import DataExporter, DataImporter
from services.auth import get_current_user
from models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["Data Export/Import"])


class ExportRequest(BaseModel):
    """Запрос на экспорт данных"""
    password: str
    include_orders: bool = True
    include_charts: bool = False
    include_logs: bool = False


class ImportRequest(BaseModel):
    """Запрос на импорт данных"""
    password: str
    mode: str = "merge"  # merge, replace, skip
    tables: Optional[List[str]] = None


class RestoreRequest(BaseModel):
    """Запрос на восстановление из бэкапа"""
    backup_path: str


@router.get("/preview")
async def get_export_preview(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить превью данных для экспорта.
    
    Возвращает статистику по данным которые будут экспортированы.
    """
    try:
        exporter = DataExporter()
        preview = exporter.get_export_preview()
        
        if "error" in preview:
            raise HTTPException(status_code=500, detail=preview["error"])
        
        return preview
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения превью: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export")
async def export_data(
    request: ExportRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Экспортировать данные пользователя.
    
    Создаёт зашифрованный файл со всеми данными.
    Пароль используется для шифрования - без него файл не расшифровать.
    
    Returns:
        Зашифрованный файл .mbc
    """
    try:
        if not request.password or len(request.password) < 4:
            raise HTTPException(
                status_code=400,
                detail="Пароль должен быть не менее 4 символов"
            )
        
        exporter = DataExporter()
        
        result = exporter.export_data(
            password=request.password,
            include_orders=request.include_orders,
            include_charts=request.include_charts,
            include_logs=request.include_logs
        )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return Response(
            content=result["data"],
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{result["filename"]}"',
                "X-Export-Stats": str(result["stats"])
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка экспорта: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_import_file(
    file: UploadFile = File(...),
    password: str = Form(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Валидировать файл импорта.
    
    Проверяет:
    - Правильность пароля
    - Целостность файла
    - Совместимость версии
    
    Возвращает информацию о содержимом файла.
    """
    try:
        if not password:
            raise HTTPException(status_code=400, detail="Пароль обязателен")
        
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="Файл пустой")
        
        importer = DataImporter()
        result = importer.validate_file(content, password)
        
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "valid": True,
            "version": result["version"],
            "created_at": result["created_at"],
            "app_version": result["app_version"],
            "tables": result["tables"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка валидации: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    password: str = Form(...),
    mode: str = Form("merge"),
    tables: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_user)
):
    """
    Импортировать данные из файла.
    
    Args:
        file: Зашифрованный файл .mbc
        password: Пароль для расшифровки
        mode: Режим импорта (merge/replace/skip)
        tables: Список таблиц через запятую (опционально)
        
    Returns:
        Результат импорта со статистикой
    """
    try:
        if not password:
            raise HTTPException(status_code=400, detail="Пароль обязателен")
        
        if mode not in ["merge", "replace", "skip"]:
            raise HTTPException(
                status_code=400,
                detail="Режим должен быть: merge, replace или skip"
            )
        
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="Файл пустой")
        
        # Парсим список таблиц
        tables_list = None
        if tables:
            tables_list = [t.strip() for t in tables.split(",") if t.strip()]
        
        importer = DataImporter()
        result = importer.import_data(
            encrypted_data=content,
            password=password,
            mode=mode,
            tables_to_import=tables_list
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "backup_path": result["backup_path"],
            "imported": result["imported"],
            "skipped": result["skipped"],
            "errors": result["errors"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка импорта: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backups")
async def list_backups(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить список доступных бэкапов.
    """
    try:
        from pathlib import Path
        
        importer = DataImporter()
        backup_dir = importer.db_path.parent / "backups"
        
        if not backup_dir.exists():
            return {"backups": []}
        
        backups = []
        for f in backup_dir.glob("*.db"):
            stat = f.stat()
            backups.append({
                "path": str(f),
                "name": f.name,
                "size": stat.st_size,
                "created": stat.st_mtime
            })
        
        # Сортируем по дате создания (новые первые)
        backups.sort(key=lambda x: x["created"], reverse=True)
        
        return {"backups": backups}
        
    except Exception as e:
        logger.error(f"Ошибка получения списка бэкапов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
async def restore_backup(
    request: RestoreRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Восстановить БД из бэкапа.
    
    ВНИМАНИЕ: Это заменит текущую БД данными из бэкапа!
    """
    try:
        importer = DataImporter()
        result = importer.restore_backup(request.backup_path)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "База данных восстановлена из бэкапа"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка восстановления: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# ПУБЛИЧНЫЕ ЭНДПОИНТЫ (без авторизации)
# Для восстановления данных на странице логина
# =====================================================

public_router = APIRouter(prefix="/api/public/data", tags=["Public Data Restore"])


@public_router.post("/validate")
async def public_validate_file(
    file: UploadFile = File(...),
    password: str = Form(...)
):
    """
    Публичная валидация файла экспорта.
    
    Доступно без авторизации для использования на странице логина.
    Возвращает информацию о пользователе в файле.
    """
    try:
        if not password:
            raise HTTPException(status_code=400, detail="Пароль обязателен")
        
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="Файл пустой")
        
        importer = DataImporter()
        
        # Валидируем файл
        validation = importer.validate_file(content, password)
        
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=validation["error"])
        
        # Получаем данные пользователя
        user_info = importer.get_user_from_export(content, password)
        
        if not user_info["success"]:
            raise HTTPException(status_code=400, detail=user_info["error"])
        
        return {
            "valid": True,
            "version": validation["version"],
            "created_at": validation["created_at"],
            "app_version": validation["app_version"],
            "tables": validation["tables"],
            "user": user_info["user"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка публичной валидации: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@public_router.post("/full-restore")
async def public_full_restore(
    file: UploadFile = File(...),
    password: str = Form(...)
):
    """
    Полное восстановление из файла экспорта.
    
    Доступно без авторизации для использования на странице логина.
    Полностью заменяет БД данными из файла и возвращает
    данные пользователя для автоматической авторизации.
    
    Returns:
        {
            "success": bool,
            "user": {"id", "username"},
            "stats": dict,
            "token": str (JWT токен для авторизации)
        }
    """
    try:
        if not password:
            raise HTTPException(status_code=400, detail="Пароль обязателен")
        
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="Файл пустой")
        
        importer = DataImporter()
        result = importer.full_restore(content, password)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Генерируем JWT токен для автоматической авторизации
        from services.auth import create_access_token
        from datetime import timedelta
        
        user_data = result["user"]
        
        access_token = create_access_token(
            data={"sub": user_data["username"]},
            expires_delta=timedelta(days=30)
        )
        
        return {
            "success": True,
            "user": {
                "id": user_data["id"],
                "username": user_data["username"],
                "is_2fa_enabled": user_data.get("is_2fa_enabled", False)
            },
            "stats": result["stats"],
            "token": access_token,
            "errors": result.get("errors", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка полного восстановления: {e}")
        raise HTTPException(status_code=500, detail=str(e))

