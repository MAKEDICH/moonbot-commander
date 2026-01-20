@echo off
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
    echo.
    echo Этот скрипт должен запускаться автоматически из приложения.
    echo Для ручного обновления используйте UPDATE-SAFE.bat
    echo.
    pause
    exit /b 1
)

echo [INFO] Файл сигнала найден
echo [INFO] Ожидание завершения приложения...

REM Ждём пока приложение завершится (максимум 60 секунд)
set /a WAIT_COUNT=0
:wait_loop
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I "python.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    set /a WAIT_COUNT+=1
    if !WAIT_COUNT! gtr 30 (
        echo [WARNING] Приложение не завершилось за 60 секунд
        echo [INFO] Принудительное завершение...
        taskkill /F /IM python.exe >nul 2>&1
        timeout /t 2 /nobreak >nul
    ) else (
        timeout /t 2 /nobreak >nul
        goto wait_loop
    )
)

echo [OK] Приложение завершено
echo.

REM Парсим JSON сигнала (упрощённо через PowerShell)
echo [INFO] Чтение параметров обновления...

for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).source_dir"`) do set "SOURCE_DIR=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).target_version"`) do set "TARGET_VERSION=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).backup_path"`) do set "BACKUP_PATH=%%a"
for /f "usebackq delims=" %%a in (`powershell -Command "(Get-Content '%SIGNAL_FILE%' | ConvertFrom-Json).project_root"`) do set "PROJECT_ROOT=%%a"

echo.
echo [INFO] Целевая версия: %TARGET_VERSION%
echo [INFO] Источник: %SOURCE_DIR%
echo [INFO] Бэкап: %BACKUP_PATH%
echo.

REM Проверяем что источник существует
if not exist "%SOURCE_DIR%\backend\main.py" (
    echo [ERROR] Исходные файлы не найдены!
    echo [ERROR] Путь: %SOURCE_DIR%
    echo.
    echo Попробуйте запустить обновление заново через интерфейс.
    pause
    exit /b 1
)

REM ============================================================
REM STEP 1: Копирование backend
REM ============================================================

echo [STEP 1/8] Копирование backend...

REM Копируем Python файлы
for %%f in ("%SOURCE_DIR%\backend\*.py") do (
    copy "%%f" "%~dp0backend\%%~nxf" /Y >nul 2>&1
)
echo   [OK] Python файлы

REM Копируем поддиректории
if exist "%SOURCE_DIR%\backend\api" (
    xcopy "%SOURCE_DIR%\backend\api" "%~dp0backend\api\" /E /Y /Q >nul 2>&1
    echo   [OK] api/
)
if exist "%SOURCE_DIR%\backend\core" (
    xcopy "%SOURCE_DIR%\backend\core" "%~dp0backend\core\" /E /Y /Q >nul 2>&1
    echo   [OK] core/
)
if exist "%SOURCE_DIR%\backend\models" (
    xcopy "%SOURCE_DIR%\backend\models" "%~dp0backend\models\" /E /Y /Q >nul 2>&1
    echo   [OK] models/
)
if exist "%SOURCE_DIR%\backend\services" (
    xcopy "%SOURCE_DIR%\backend\services" "%~dp0backend\services\" /E /Y /Q >nul 2>&1
    echo   [OK] services/
)
if exist "%SOURCE_DIR%\backend\utils" (
    xcopy "%SOURCE_DIR%\backend\utils" "%~dp0backend\utils\" /E /Y /Q >nul 2>&1
    echo   [OK] utils/
)
if exist "%SOURCE_DIR%\backend\updates" (
    xcopy "%SOURCE_DIR%\backend\updates" "%~dp0backend\updates\" /E /Y /Q >nul 2>&1
    echo   [OK] updates/
)
if exist "%SOURCE_DIR%\backend\alembic" (
    xcopy "%SOURCE_DIR%\backend\alembic" "%~dp0backend\alembic\" /E /Y /Q >nul 2>&1
    echo   [OK] alembic/
)
if exist "%SOURCE_DIR%\backend\config" (
    xcopy "%SOURCE_DIR%\backend\config" "%~dp0backend\config\" /E /Y /Q >nul 2>&1
    echo   [OK] config/
)
if exist "%SOURCE_DIR%\backend\tests" (
    xcopy "%SOURCE_DIR%\backend\tests" "%~dp0backend\tests\" /E /Y /Q >nul 2>&1
    echo   [OK] tests/
)

REM Копируем requirements.txt
if exist "%SOURCE_DIR%\backend\requirements.txt" (
    copy "%SOURCE_DIR%\backend\requirements.txt" "%~dp0backend\requirements.txt" /Y >nul
    echo   [OK] requirements.txt
)

REM Копируем alembic.ini
if exist "%SOURCE_DIR%\backend\alembic.ini" (
    copy "%SOURCE_DIR%\backend\alembic.ini" "%~dp0backend\alembic.ini" /Y >nul
    echo   [OK] alembic.ini
)

echo.

REM ============================================================
REM STEP 2: Копирование frontend
REM ============================================================

echo [STEP 2/8] Копирование frontend...

if exist "%SOURCE_DIR%\frontend\src" (
    xcopy "%SOURCE_DIR%\frontend\src" "%~dp0frontend\src\" /E /Y /Q >nul 2>&1
    echo   [OK] src/
)
if exist "%SOURCE_DIR%\frontend\public" (
    xcopy "%SOURCE_DIR%\frontend\public" "%~dp0frontend\public\" /E /Y /Q >nul 2>&1
    echo   [OK] public/
)

if exist "%SOURCE_DIR%\frontend\package.json" (
    copy "%SOURCE_DIR%\frontend\package.json" "%~dp0frontend\package.json" /Y >nul
    echo   [OK] package.json
)
if exist "%SOURCE_DIR%\frontend\vite.config.js" (
    copy "%SOURCE_DIR%\frontend\vite.config.js" "%~dp0frontend\vite.config.js" /Y >nul
    echo   [OK] vite.config.js
)
if exist "%SOURCE_DIR%\frontend\index.html" (
    copy "%SOURCE_DIR%\frontend\index.html" "%~dp0frontend\index.html" /Y >nul
    echo   [OK] index.html
)

echo.

REM ============================================================
REM STEP 3: Копирование скриптов
REM ============================================================

echo [STEP 3/8] Копирование скриптов...

REM Копируем батники (кроме auto-updater)
for %%f in ("%SOURCE_DIR%\*.bat") do (
    set "fname=%%~nxf"
    if not "!fname!"=="auto-updater.bat" (
        copy "%%f" "%~dp0%%~nxf" /Y >nul 2>&1
    )
)
echo   [OK] Batch файлы

REM Копируем shell скрипты
for %%f in ("%SOURCE_DIR%\*.sh") do (
    copy "%%f" "%~dp0%%~nxf" /Y >nul 2>&1
)

REM Копируем Linux директорию
if exist "%SOURCE_DIR%\linux" (
    xcopy "%SOURCE_DIR%\linux" "%~dp0linux\" /E /Y /Q >nul 2>&1
    echo   [OK] linux/
)

REM Копируем scripts директорию
if exist "%SOURCE_DIR%\scripts" (
    xcopy "%SOURCE_DIR%\scripts" "%~dp0scripts\" /E /Y /Q >nul 2>&1
    echo   [OK] scripts/
)

REM Копируем docs
if exist "%SOURCE_DIR%\docs" (
    xcopy "%SOURCE_DIR%\docs" "%~dp0docs\" /E /Y /Q >nul 2>&1
    echo   [OK] docs/
)

REM Копируем README и CHANGELOG
if exist "%SOURCE_DIR%\README.md" (
    copy "%SOURCE_DIR%\README.md" "%~dp0README.md" /Y >nul
)
if exist "%SOURCE_DIR%\CHANGELOG.md" (
    copy "%SOURCE_DIR%\CHANGELOG.md" "%~dp0CHANGELOG.md" /Y >nul
)

echo.

REM ============================================================
REM STEP 4: Обновление VERSION.txt
REM ============================================================

echo [STEP 4/8] Обновление VERSION.txt...

echo %TARGET_VERSION%> "%~dp0VERSION.txt"
echo   [OK] Версия: %TARGET_VERSION%

echo.

REM ============================================================
REM STEP 5: Установка зависимостей backend
REM ============================================================

echo [STEP 5/8] Установка зависимостей backend...

cd /d "%~dp0backend"

python -m pip install --upgrade pip --quiet >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] Не удалось обновить pip
)

pip install -r requirements.txt --quiet
if !errorlevel! neq 0 (
    echo   [WARNING] Некоторые зависимости не установились
) else (
    echo   [OK] Зависимости установлены
)

echo.

REM ============================================================
REM STEP 6: Применение миграций
REM ============================================================

echo [STEP 6/8] Применение миграций БД...

REM Используем intelligent_migration если доступен
if exist "updates\core\intelligent_migration.py" (
    echo   [INFO] Использую intelligent_migration.py...
    python updates/core/intelligent_migration.py
    if !errorlevel! equ 0 (
        echo   [OK] Миграции применены
    ) else (
        echo   [WARNING] Некоторые миграции не применились
    )
) else (
    REM Fallback: запускаем все migrate_*.py
    echo   [INFO] Запуск миграций вручную...
    for %%f in (updates\migrate_*.py) do (
        python "%%f" >nul 2>&1
    )
    echo   [OK] Миграции обработаны
)

echo.

REM ============================================================
REM STEP 7: Установка зависимостей frontend
REM ============================================================

echo [STEP 7/8] Установка зависимостей frontend...

cd /d "%~dp0frontend"

call npm install --silent >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] Не все зависимости установились
) else (
    echo   [OK] npm install завершён
)

REM Проверяем серверный режим
set "IS_SERVER=0"
if exist "%~dp0SERVER-START-PRODUCTION.bat" set "IS_SERVER=1"
if exist "%~dp0nssm.exe" set "IS_SERVER=1"

if "!IS_SERVER!"=="1" (
    echo   [INFO] Обнаружен серверный режим
    echo   [INFO] Сборка frontend для production...
    set NODE_ENV=production
    call npm run build >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [OK] Frontend собран
    ) else (
        echo   [WARNING] Сборка frontend не удалась
    )
)

echo.

REM ============================================================
REM STEP 8: Очистка
REM ============================================================

echo [STEP 8/8] Очистка временных файлов...

cd /d "%~dp0"

REM Удаляем файл сигнала
del "%SIGNAL_FILE%" >nul 2>&1

REM Удаляем временную директорию
if exist "backend\.update_temp" (
    rmdir /s /q "backend\.update_temp" >nul 2>&1
)

REM Удаляем файл статуса
if exist "backend\.update_status.json" (
    del "backend\.update_status.json" >nul 2>&1
)

REM Очищаем кэш frontend
if exist "frontend\dist" (
    rmdir /s /q "frontend\dist" >nul 2>&1
)
if exist "frontend\.vite" (
    rmdir /s /q "frontend\.vite" >nul 2>&1
)

echo   [OK] Очистка завершена

echo.

REM ============================================================
REM ЗАВЕРШЕНИЕ
REM ============================================================

echo.
echo ============================================================
echo       ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!
echo ============================================================
echo.
echo Версия: %TARGET_VERSION%
echo Бэкап:  %BACKUP_PATH%
echo.
echo [INFO] Запуск приложения...
echo.

cd /d "%~dp0"

REM Определяем какой скрипт запуска использовать
if exist "LOCAL-START.bat" (
    echo [INFO] Запуск через LOCAL-START.bat
    start "" "LOCAL-START.bat"
) else if exist "scripts\LOCAL-START.bat" (
    echo [INFO] Запуск через scripts\LOCAL-START.bat
    start "" "scripts\LOCAL-START.bat"
) else if exist "SERVER-START.bat" (
    echo [INFO] Запуск через SERVER-START.bat
    start "" "SERVER-START.bat"
) else (
    echo [INFO] Запуск backend напрямую
    cd backend
    start "" python main.py
)

echo.
echo Приложение запущено! Это окно закроется через 5 секунд.
timeout /t 5 /nobreak >nul

exit /b 0


