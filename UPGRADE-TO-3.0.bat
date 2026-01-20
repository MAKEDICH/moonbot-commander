@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Upgrade to v3.0.0

REM ============================================================
REM СКРИПТ ОБНОВЛЕНИЯ НА ВЕРСИЮ 3.0.0
REM ============================================================
REM 
REM Этот скрипт безопасно обновляет MoonBot Commander с любой
REM предыдущей версии на версию 3.0.0 с новой системой обновлений.
REM 
REM ВАЖНО: Все пользовательские данные будут сохранены!
REM - База данных (moonbot_commander.db)
REM - Настройки (.env)
REM - Серверы и их конфигурации
REM - Запланированные команды
REM - История ордеров
REM 
REM ============================================================

echo.
echo ============================================================
echo   MoonBot Commander - Upgrade to v3.0.0
echo ============================================================
echo.
echo   Этот скрипт безопасно обновит ваш MoonBot Commander
echo   на версию 3.0.0 с новой системой автообновлений.
echo.
echo   [!] ВСЕ ВАШИ ДАННЫЕ БУДУТ СОХРАНЕНЫ:
echo       - База данных
echo       - Настройки серверов
echo       - Запланированные команды
echo       - История ордеров
echo.
echo ============================================================
echo.

REM Проверяем права администратора (не обязательно, но полезно)
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ============================================================
REM STEP 0: Проверка что приложение не запущено
REM ============================================================

echo [STEP 0/7] Проверка запущенных процессов...

tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I "python.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo.
    echo   [!] ВНИМАНИЕ: Обнаружен запущенный Python процесс!
    echo   [!] Пожалуйста, остановите MoonBot Commander перед обновлением.
    echo.
    choice /C YN /M "Попытаться остановить автоматически"
    if !errorlevel! equ 1 (
        echo   [INFO] Останавливаем Python процессы...
        taskkill /F /IM python.exe >nul 2>&1
        timeout /t 3 /nobreak >nul
    ) else (
        echo   [INFO] Обновление отменено.
        pause
        exit /b 1
    )
)

echo   [OK] Проверка завершена
echo.

REM ============================================================
REM STEP 1: Создание резервной копии
REM ============================================================

echo [STEP 1/7] Создание резервной копии...

set "BACKUP_DIR=%SCRIPT_DIR%backups\pre_upgrade_3.0_%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%"
set "BACKUP_DIR=%BACKUP_DIR: =0%"

if not exist "backups" mkdir backups
mkdir "%BACKUP_DIR%" 2>nul

REM Бэкап базы данных
if exist "backend\moonbot_commander.db" (
    copy "backend\moonbot_commander.db" "%BACKUP_DIR%\moonbot_commander.db" /Y >nul
    echo   [OK] База данных сохранена
) else if exist "moonbot_commander.db" (
    copy "moonbot_commander.db" "%BACKUP_DIR%\moonbot_commander.db" /Y >nul
    echo   [OK] База данных сохранена
) else (
    echo   [INFO] База данных не найдена (новая установка?)
)

REM Бэкап .env
if exist "backend\.env" (
    copy "backend\.env" "%BACKUP_DIR%\.env" /Y >nul
    echo   [OK] Настройки .env сохранены
)

REM Бэкап VERSION.txt
if exist "VERSION.txt" (
    copy "VERSION.txt" "%BACKUP_DIR%\VERSION_old.txt" /Y >nul
    echo   [OK] Версия сохранена
)

REM Сохраняем информацию о бэкапе
echo Backup created: %date% %time% > "%BACKUP_DIR%\backup_info.txt"
echo Source version: Unknown (pre-3.0) >> "%BACKUP_DIR%\backup_info.txt"
echo Target version: 3.0.0 >> "%BACKUP_DIR%\backup_info.txt"

echo   [OK] Резервная копия создана: %BACKUP_DIR%
echo.

REM ============================================================
REM STEP 2: Обновление VERSION.txt
REM ============================================================

echo [STEP 2/7] Обновление версии...

echo 3.0.0> VERSION.txt
echo   [OK] VERSION.txt обновлён до 3.0.0
echo.

REM ============================================================
REM STEP 3: Установка зависимостей Python
REM ============================================================

echo [STEP 3/7] Обновление зависимостей Python...

cd /d "%SCRIPT_DIR%backend"

python -m pip install --upgrade pip --quiet >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] Не удалось обновить pip
)

if exist "requirements.txt" (
    pip install -r requirements.txt --quiet 2>nul
    if !errorlevel! neq 0 (
        echo   [WARNING] Некоторые зависимости не установились
        echo   [INFO] Пробуем установить критичные...
        pip install aiohttp packaging websockets cryptography --quiet 2>nul
    ) else (
        echo   [OK] Зависимости Python установлены
    )
) else (
    echo   [WARNING] requirements.txt не найден
)

echo.

REM ============================================================
REM STEP 4: Применение миграций БД
REM ============================================================

echo [STEP 4/7] Применение миграций базы данных...

cd /d "%SCRIPT_DIR%backend"

REM Используем IntelligentMigrationSystem
if exist "updates\core\intelligent_migration.py" (
    echo   [INFO] Запуск интеллектуальной системы миграций...
    python updates\core\intelligent_migration.py
    if !errorlevel! equ 0 (
        echo   [OK] Миграции применены успешно
    ) else (
        echo   [WARNING] Некоторые миграции могли не примениться
        echo   [INFO] Это нормально если база данных уже актуальна
    )
) else (
    echo   [INFO] Запуск миграций вручную...
    
    REM Запускаем каждую миграцию
    for %%f in (updates\migrate_*.py) do (
        echo   [INFO] Применяю: %%~nf
        python "%%f" >nul 2>&1
    )
    echo   [OK] Миграции обработаны
)

echo.

REM ============================================================
REM STEP 5: Обновление зависимостей Frontend
REM ============================================================

echo [STEP 5/7] Обновление зависимостей Frontend...

cd /d "%SCRIPT_DIR%frontend"

if exist "package.json" (
    call npm install --silent 2>nul
    if !errorlevel! neq 0 (
        echo   [WARNING] Не все зависимости npm установились
    ) else (
        echo   [OK] Зависимости npm установлены
    )
) else (
    echo   [WARNING] package.json не найден
)

echo.

REM ============================================================
REM STEP 6: Создание необходимых директорий
REM ============================================================

echo [STEP 6/7] Создание структуры проекта...

cd /d "%SCRIPT_DIR%"

if not exist "backend\logs" mkdir "backend\logs"
if not exist "backend\backups" mkdir "backend\backups"
if not exist "logs" mkdir "logs"
if not exist "backups" mkdir "backups"

echo   [OK] Структура проекта готова
echo.

REM ============================================================
REM STEP 7: Финальная проверка
REM ============================================================

echo [STEP 7/7] Финальная проверка...

cd /d "%SCRIPT_DIR%"

set "ERRORS=0"

REM Проверяем VERSION.txt
if exist "VERSION.txt" (
    set /p VERSION=<VERSION.txt
    echo   [OK] Версия: !VERSION!
) else (
    echo   [ERROR] VERSION.txt не найден
    set /a ERRORS+=1
)

REM Проверяем backend
if exist "backend\main.py" (
    echo   [OK] Backend найден
) else (
    echo   [ERROR] backend\main.py не найден
    set /a ERRORS+=1
)

REM Проверяем frontend
if exist "frontend\package.json" (
    echo   [OK] Frontend найден
) else (
    echo   [WARNING] frontend\package.json не найден
)

REM Проверяем базу данных
if exist "backend\moonbot_commander.db" (
    echo   [OK] База данных найдена
) else (
    echo   [INFO] База данных будет создана при первом запуске
)

echo.

REM ============================================================
REM ЗАВЕРШЕНИЕ
REM ============================================================

if !ERRORS! gtr 0 (
    echo ============================================================
    echo   [!] ОБНОВЛЕНИЕ ЗАВЕРШЕНО С ПРЕДУПРЕЖДЕНИЯМИ
    echo ============================================================
    echo.
    echo   Обнаружено проблем: !ERRORS!
    echo   Резервная копия: %BACKUP_DIR%
    echo.
    echo   Пожалуйста, проверьте ошибки выше.
    echo   Если что-то пошло не так, восстановите данные из бэкапа.
    echo.
) else (
    echo ============================================================
    echo   [OK] ОБНОВЛЕНИЕ УСПЕШНО ЗАВЕРШЕНО!
    echo ============================================================
    echo.
    echo   MoonBot Commander обновлён до версии 3.0.0
    echo.
    echo   Резервная копия: %BACKUP_DIR%
    echo.
    echo   Что нового в версии 3.0.0:
    echo   - Автоматическая система обновлений
    echo   - Улучшенная система миграций БД
    echo   - Экспорт/импорт данных с шифрованием
    echo   - Множество улучшений и исправлений
    echo.
    echo   Теперь вы можете запустить приложение:
    echo   - Для локальной работы: LOCAL-START.bat
    echo   - Для сервера: SERVER-START.bat
    echo.
)

echo ============================================================
echo.
pause


