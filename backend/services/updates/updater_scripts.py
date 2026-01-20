"""
Шаблоны скриптов для auto-updater
"""

WINDOWS_UPDATER_SCRIPT = '''@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander Auto-Updater

REM ============================================================
REM Auto-Updater для MoonBot Commander
REM Этот скрипт запускается приложением для выполнения обновления
REM ============================================================

echo.
echo ============================================================
echo       MoonBot Commander Auto-Updater
echo ============================================================
echo.

REM Читаем файл сигнала
set "SIGNAL_FILE=%~dp0.update_signal"

if not exist "%SIGNAL_FILE%" (
    echo [ERROR] Файл сигнала не найден: %SIGNAL_FILE%
    pause
    exit /b 1
)

echo [INFO] Файл сигнала найден
echo [INFO] Ожидание завершения приложения...

REM Ждём пока приложение завершится
:wait_loop
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I "python.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 2 /nobreak >nul
    goto wait_loop
)

echo [OK] Приложение завершено
echo.

REM Парсим JSON сигнала (упрощённо через PowerShell)
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).source_dir"`) do set "SOURCE_DIR=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).target_version"`) do set "TARGET_VERSION=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).backup_path"`) do set "BACKUP_PATH=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).restart_command"`) do set "RESTART_CMD=%%a"

echo [INFO] Целевая версия: %TARGET_VERSION%
echo [INFO] Источник: %SOURCE_DIR%
echo [INFO] Бэкап: %BACKUP_PATH%
echo.

REM ============================================================
REM Копирование файлов
REM ============================================================

echo [STEP 1] Копирование backend...

REM Копируем backend (кроме защищённых файлов)
xcopy "%SOURCE_DIR%\\backend\\*.py" "%~dp0backend\\" /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\api" "%~dp0backend\\api\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\core" "%~dp0backend\\core\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\models" "%~dp0backend\\models\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\services" "%~dp0backend\\services\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\utils" "%~dp0backend\\utils\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\updates" "%~dp0backend\\updates\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\alembic" "%~dp0backend\\alembic\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\backend\\config" "%~dp0backend\\config\\" /E /Y /Q >nul 2>&1

if exist "%SOURCE_DIR%\\backend\\requirements.txt" (
    copy "%SOURCE_DIR%\\backend\\requirements.txt" "%~dp0backend\\requirements.txt" /Y >nul
)

echo [OK] Backend скопирован

echo [STEP 2] Копирование frontend...

xcopy "%SOURCE_DIR%\\frontend\\src" "%~dp0frontend\\src\\" /E /Y /Q >nul 2>&1
xcopy "%SOURCE_DIR%\\frontend\\public" "%~dp0frontend\\public\\" /E /Y /Q >nul 2>&1

if exist "%SOURCE_DIR%\\frontend\\package.json" (
    copy "%SOURCE_DIR%\\frontend\\package.json" "%~dp0frontend\\package.json" /Y >nul
)
if exist "%SOURCE_DIR%\\frontend\\vite.config.js" (
    copy "%SOURCE_DIR%\\frontend\\vite.config.js" "%~dp0frontend\\vite.config.js" /Y >nul
)
if exist "%SOURCE_DIR%\\frontend\\index.html" (
    copy "%SOURCE_DIR%\\frontend\\index.html" "%~dp0frontend\\index.html" /Y >nul
)

echo [OK] Frontend скопирован

echo [STEP 3] Копирование скриптов...

REM Копируем скрипты (кроме auto-updater)
for %%f in ("%SOURCE_DIR%\\*.bat") do (
    set "fname=%%~nxf"
    if not "!fname!"=="auto-updater.bat" (
        copy "%%f" "%~dp0%%~nxf" /Y >nul 2>&1
    )
)

if exist "%SOURCE_DIR%\\linux" (
    xcopy "%SOURCE_DIR%\\linux" "%~dp0linux\\" /E /Y /Q >nul 2>&1
)

echo [OK] Скрипты скопированы

echo [STEP 4] Обновление VERSION.txt...

echo %TARGET_VERSION%> "%~dp0VERSION.txt"

echo [OK] Версия обновлена

REM ============================================================
REM Установка зависимостей
REM ============================================================

echo [STEP 5] Установка зависимостей backend...

cd /d "%~dp0backend"
python -m pip install --upgrade pip --quiet >nul 2>&1
pip install -r requirements.txt --quiet >nul 2>&1

echo [OK] Зависимости установлены

REM ============================================================
REM Миграции БД
REM ============================================================

echo [STEP 6] Применение миграций...

if exist "updates\\core\\intelligent_migration.py" (
    python updates/core/intelligent_migration.py
) else (
    for %%f in (updates\\migrate_*.py) do (
        python "%%f" >nul 2>&1
    )
)

echo [OK] Миграции применены

REM ============================================================
REM Frontend dependencies
REM ============================================================

echo [STEP 7] Установка зависимостей frontend...

cd /d "%~dp0frontend"
call npm install --silent >nul 2>&1

REM Проверяем серверный режим
set "IS_SERVER=0"
if exist "%~dp0SERVER-START-PRODUCTION.bat" set "IS_SERVER=1"

if "!IS_SERVER!"=="1" (
    echo [INFO] Сборка frontend для production...
    set NODE_ENV=production
    call npm run build >nul 2>&1
)

echo [OK] Frontend готов

REM ============================================================
REM Очистка
REM ============================================================

echo [STEP 8] Очистка временных файлов...

cd /d "%~dp0"
del "%SIGNAL_FILE%" >nul 2>&1
if exist "backend\\.update_temp" rmdir /s /q "backend\\.update_temp" >nul 2>&1
if exist "backend\\.update_status.json" del "backend\\.update_status.json" >nul 2>&1

echo [OK] Очистка завершена

REM ============================================================
REM Перезапуск
REM ============================================================

echo.
echo ============================================================
echo       ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!
echo ============================================================
echo.
echo Версия: %TARGET_VERSION%
echo Бэкап: %BACKUP_PATH%
echo.
echo [INFO] Запуск приложения...

cd /d "%~dp0"
if exist "LOCAL-START.bat" (
    start "" "LOCAL-START.bat"
) else if exist "SERVER-START.bat" (
    start "" "SERVER-START.bat"
) else (
    cd backend
    start "" python main.py
)

exit /b 0
'''


LINUX_UPDATER_SCRIPT = '''#!/bin/bash
set -e

# ============================================================
# Auto-Updater для MoonBot Commander (Linux)
# ============================================================

echo ""
echo "============================================================"
echo "       MoonBot Commander Auto-Updater"
echo "============================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIGNAL_FILE="$SCRIPT_DIR/.update_signal"

if [ ! -f "$SIGNAL_FILE" ]; then
    echo "[ERROR] Файл сигнала не найден: $SIGNAL_FILE"
    exit 1
fi

echo "[INFO] Файл сигнала найден"
echo "[INFO] Ожидание завершения приложения..."

# Ждём завершения Python процессов
while pgrep -f "python.*main.py" > /dev/null 2>&1; do
    sleep 2
done

echo "[OK] Приложение завершено"
echo ""

# Парсим JSON
SOURCE_DIR=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['source_dir'])")
TARGET_VERSION=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['target_version'])")
BACKUP_PATH=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['backup_path'])")

echo "[INFO] Целевая версия: $TARGET_VERSION"
echo "[INFO] Источник: $SOURCE_DIR"
echo "[INFO] Бэкап: $BACKUP_PATH"
echo ""

# ============================================================
# Копирование файлов
# ============================================================

echo "[STEP 1] Копирование backend..."

cp -r "$SOURCE_DIR/backend/"*.py "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/api" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/core" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/models" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/services" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/utils" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/updates" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/alembic" "$SCRIPT_DIR/backend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/backend/config" "$SCRIPT_DIR/backend/" 2>/dev/null || true

[ -f "$SOURCE_DIR/backend/requirements.txt" ] && cp "$SOURCE_DIR/backend/requirements.txt" "$SCRIPT_DIR/backend/"

echo "[OK] Backend скопирован"

echo "[STEP 2] Копирование frontend..."

cp -r "$SOURCE_DIR/frontend/src" "$SCRIPT_DIR/frontend/" 2>/dev/null || true
cp -r "$SOURCE_DIR/frontend/public" "$SCRIPT_DIR/frontend/" 2>/dev/null || true

[ -f "$SOURCE_DIR/frontend/package.json" ] && cp "$SOURCE_DIR/frontend/package.json" "$SCRIPT_DIR/frontend/"
[ -f "$SOURCE_DIR/frontend/vite.config.js" ] && cp "$SOURCE_DIR/frontend/vite.config.js" "$SCRIPT_DIR/frontend/"
[ -f "$SOURCE_DIR/frontend/index.html" ] && cp "$SOURCE_DIR/frontend/index.html" "$SCRIPT_DIR/frontend/"

echo "[OK] Frontend скопирован"

echo "[STEP 3] Копирование скриптов..."

for f in "$SOURCE_DIR"/*.sh; do
    [ -f "$f" ] && [ "$(basename "$f")" != "auto-updater.sh" ] && cp "$f" "$SCRIPT_DIR/"
done

[ -d "$SOURCE_DIR/linux" ] && cp -r "$SOURCE_DIR/linux" "$SCRIPT_DIR/"

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
chmod +x "$SCRIPT_DIR/linux"/*.sh 2>/dev/null || true

echo "[OK] Скрипты скопированы"

echo "[STEP 4] Обновление VERSION.txt..."

echo "$TARGET_VERSION" > "$SCRIPT_DIR/VERSION.txt"

echo "[OK] Версия обновлена"

# ============================================================
# Установка зависимостей
# ============================================================

echo "[STEP 5] Установка зависимостей backend..."

cd "$SCRIPT_DIR/backend"
pip3 install -r requirements.txt --quiet 2>/dev/null || pip install -r requirements.txt --quiet

echo "[OK] Зависимости установлены"

# ============================================================
# Миграции БД
# ============================================================

echo "[STEP 6] Применение миграций..."

if [ -f "updates/core/intelligent_migration.py" ]; then
    python3 updates/core/intelligent_migration.py || python updates/core/intelligent_migration.py
else
    for f in updates/migrate_*.py; do
        [ -f "$f" ] && python3 "$f" 2>/dev/null || true
    done
fi

echo "[OK] Миграции применены"

# ============================================================
# Frontend
# ============================================================

echo "[STEP 7] Установка зависимостей frontend..."

cd "$SCRIPT_DIR/frontend"
npm install --silent 2>/dev/null || true

# Проверяем серверный режим
if [ -f "$SCRIPT_DIR/linux/server-start.sh" ]; then
    echo "[INFO] Сборка frontend для production..."
    NODE_ENV=production npm run build 2>/dev/null || true
fi

echo "[OK] Frontend готов"

# ============================================================
# Очистка
# ============================================================

echo "[STEP 8] Очистка временных файлов..."

cd "$SCRIPT_DIR"
rm -f "$SIGNAL_FILE"
rm -rf "backend/.update_temp"
rm -f "backend/.update_status.json"

echo "[OK] Очистка завершена"

# ============================================================
# Перезапуск
# ============================================================

echo ""
echo "============================================================"
echo "       ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!"
echo "============================================================"
echo ""
echo "Версия: $TARGET_VERSION"
echo "Бэкап: $BACKUP_PATH"
echo ""
echo "[INFO] Запуск приложения..."

cd "$SCRIPT_DIR"
if [ -f "linux/local-start.sh" ]; then
    nohup ./linux/local-start.sh > /dev/null 2>&1 &
elif [ -f "linux/server-start.sh" ]; then
    nohup ./linux/server-start.sh > /dev/null 2>&1 &
else
    cd backend
    nohup python3 main.py > /dev/null 2>&1 &
fi

exit 0
'''

