@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Safe Update System
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - БЕЗОПАСНОЕ ОБНОВЛЕНИЕ
echo ============================================================
echo.
echo   ✅ Автоматическое определение версии
echo   ✅ Интеллектуальные миграции БД
echo   ✅ Полное резервное копирование
echo   ✅ Возможность отката
echo.
echo ============================================================
echo.

REM ============================================================
REM STEP 0: Проверка расположения
REM ============================================================

if not exist "backend\main.py" (
    if not exist "frontend\package.json" (
        echo [ОШИБКА] Это не похоже на папку MoonBot Commander!
        echo.
        echo Поместите UPDATE-SAFE.bat в папку MoonBot Commander
        echo где находятся директории backend/ и frontend/.
        echo.
        pause
        exit /b 1
    )
)

echo [INFO] Обнаружена установка MoonBot Commander
echo.

REM ============================================================
REM STEP 1: Остановка приложения
REM ============================================================

echo [1/10] Остановка приложения...
echo.

tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Обнаружены запущенные процессы Python
    echo.
    choice /C YN /M "Остановить их для безопасного обновления"
    if errorlevel 2 (
        echo.
        echo [ВНИМАНИЕ] Обновление при запущенном приложении может привести к ошибкам!
        echo.
        choice /C YN /M "Все равно продолжить (НЕ рекомендуется)"
        if errorlevel 2 exit /b 0
    ) else (
        taskkill /F /IM python.exe >nul 2>&1
        taskkill /F /IM node.exe >nul 2>&1
        timeout /t 3 /nobreak >nul
        echo [OK] Процессы остановлены
    )
) else (
    echo [OK] Приложение не запущено
)

echo.

REM ============================================================
REM STEP 2: Проверка текущей версии
REM ============================================================

echo [2/10] Анализ текущей версии...
echo.

set "CURRENT_VERSION=unknown"

if exist "VERSION.txt" (
    set /p CURRENT_VERSION=<VERSION.txt
    echo Версия из файла: !CURRENT_VERSION!
) else (
    echo Файл версии не найден, определяем по БД...
    set "CURRENT_VERSION=1.0.0"
)

REM Запускаем интеллектуальное определение версии
cd backend
python -c "from intelligent_migration import IntelligentMigrationSystem; m = IntelligentMigrationSystem(); v, _ = m.detect_current_version(); print(f'Определена версия БД: {v}')" 2>nul
cd ..

echo.

REM ============================================================
REM STEP 3: Создание полной резервной копии
REM ============================================================

echo [3/10] Создание полной резервной копии...
echo.

set "FULL_BACKUP_DIR=full_backups\backup_%date:~-4,4%-%date:~-7,2%-%date:~-10,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "FULL_BACKUP_DIR=%FULL_BACKUP_DIR: =0%"

if not exist "full_backups" mkdir full_backups
mkdir "%FULL_BACKUP_DIR%" >nul 2>&1

REM Копируем ВСЮ структуру приложения
echo Копирование файлов приложения...
xcopy backend "%FULL_BACKUP_DIR%\backend\" /E /I /Q /Y >nul 2>&1
xcopy frontend\src "%FULL_BACKUP_DIR%\frontend\src\" /E /I /Q /Y >nul 2>&1
xcopy frontend\public "%FULL_BACKUP_DIR%\frontend\public\" /E /I /Q /Y >nul 2>&1

REM Копируем конфигурационные файлы
if exist "frontend\package.json" copy "frontend\package.json" "%FULL_BACKUP_DIR%\frontend\" >nul
if exist "frontend\vite.config.js" copy "frontend\vite.config.js" "%FULL_BACKUP_DIR%\frontend\" >nul
if exist "VERSION.txt" copy "VERSION.txt" "%FULL_BACKUP_DIR%\" >nul

REM Особенно важные файлы
if exist "backend\.env" (
    copy "backend\.env" "%FULL_BACKUP_DIR%\backend\.env" >nul
    echo   ✅ .env сохранен
)

if exist "backend\moonbot_commander.db" (
    copy "backend\moonbot_commander.db" "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" >nul
    echo   ✅ База данных сохранена
)

echo.
echo [OK] Полный бэкап создан: %FULL_BACKUP_DIR%
echo.

REM ============================================================
REM STEP 4: Получение списка версий с GitHub
REM ============================================================

echo [4/10] Получение доступных версий с GitHub...
echo.

set "TEMP_RELEASES=%TEMP%\moonbot_releases.json"
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://api.github.com/repos/MAKEDICH/moonbot-commander/releases' -OutFile '%TEMP_RELEASES%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ОШИБКА] Не удалось получить список версий с GitHub!
    echo.
    echo Проверьте подключение к интернету.
    pause
    exit /b 1
)

REM Показываем версии
echo Доступные версии (текущая: %CURRENT_VERSION%):
echo.
powershell -Command "$releases = Get-Content '%TEMP_RELEASES%' | ConvertFrom-Json; for ($i=0; $i -lt [Math]::Min($releases.Count, 10); $i++) { $tag = $releases[$i].tag_name; $marker = if ($tag -eq 'v%CURRENT_VERSION%' -or $tag -eq '%CURRENT_VERSION%') { ' [УСТАНОВЛЕНА]' } else { '' }; $prerelease = if ($releases[$i].prerelease) { ' (pre-release)' } else { '' }; Write-Host \"  [$($i+1)] $tag - $($releases[$i].name)$marker$prerelease\" }"
echo.
echo   [0] Ввести версию вручную
echo.

REM Выбор версии
set /p "VERSION_CHOICE=Выберите номер версии: "

set "TEMP_JSON=%TEMP%\moonbot_release.json"

if "%VERSION_CHOICE%"=="0" (
    echo.
    set /p "SPECIFIC_VERSION=Введите тег версии (например v2.1.3): "
    echo.
    echo Получение версии !SPECIFIC_VERSION!...
    set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/!SPECIFIC_VERSION!"
) else (
    echo.
    echo Получение выбранной версии...
    for /f "delims=" %%i in ('powershell -Command "$releases = Get-Content '%TEMP_RELEASES%' | ConvertFrom-Json; $selected = $releases[%VERSION_CHOICE%-1]; Write-Host $selected.tag_name"') do set "SELECTED_TAG=%%i"
    set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/!SELECTED_TAG!"
)

REM Скачиваем информацию о релизе
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '!GITHUB_API!' -OutFile '%TEMP_JSON%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ОШИБКА] Не удалось получить информацию о версии!
    pause
    exit /b 1
)

REM Парсим версию и URL
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content '%TEMP_JSON%' | ConvertFrom-Json).tag_name"') do set "NEW_VERSION=%%a"
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content '%TEMP_JSON%' | ConvertFrom-Json).zipball_url"') do set "DOWNLOAD_URL=%%a"

set "NEW_VERSION=!NEW_VERSION:v=!"

echo Выбранная версия: v!NEW_VERSION!
echo.

REM ============================================================
REM STEP 5: Скачивание новой версии
REM ============================================================

echo [5/10] Скачивание новой версии...
echo.

set "TEMP_ZIP=%TEMP%\moonbot_update.zip"
set "TEMP_EXTRACT=%TEMP%\moonbot_extract"

echo Загрузка с GitHub...
echo Это может занять 1-2 минуты...
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing"

if !errorlevel! neq 0 (
    echo [ОШИБКА] Загрузка не удалась!
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo [OK] Загружено успешно
echo.

REM ============================================================
REM STEP 6: Распаковка файлов
REM ============================================================

echo [6/10] Распаковка файлов...
echo.

if exist "%TEMP_EXTRACT%" rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
mkdir "%TEMP_EXTRACT%" >nul 2>&1

powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_EXTRACT%' -Force" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ОШИБКА] Распаковка не удалась!
    del "%TEMP_ZIP%" >nul 2>&1
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

REM Находим папку внутри архива
for /d %%d in ("%TEMP_EXTRACT%\*") do set "UPDATE_SOURCE=%%d"

if not exist "!UPDATE_SOURCE!\backend\main.py" (
    echo [ОШИБКА] Неверная структура архива!
    rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
    del "%TEMP_ZIP%" >nul 2>&1
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo [OK] Файлы распакованы
echo.

REM ============================================================
REM STEP 7: Обновление файлов приложения
REM ============================================================

echo [7/10] Обновление файлов приложения...
echo.

REM Backend
echo Обновление Backend...
xcopy "!UPDATE_SOURCE!\backend\*.py" "backend\" /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\api" xcopy "!UPDATE_SOURCE!\backend\api" "backend\api\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\alembic" xcopy "!UPDATE_SOURCE!\backend\alembic" "backend\alembic\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\requirements.txt" copy "!UPDATE_SOURCE!\backend\requirements.txt" "backend\requirements.txt" >nul

REM Frontend
echo Обновление Frontend...
if exist "!UPDATE_SOURCE!\frontend\src" xcopy "!UPDATE_SOURCE!\frontend\src" "frontend\src\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\frontend\public" xcopy "!UPDATE_SOURCE!\frontend\public" "frontend\public\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\frontend\package.json" copy "!UPDATE_SOURCE!\frontend\package.json" "frontend\package.json" >nul
if exist "!UPDATE_SOURCE!\frontend\vite.config.js" copy "!UPDATE_SOURCE!\frontend\vite.config.js" "frontend\vite.config.js" >nul
if exist "!UPDATE_SOURCE!\frontend\index.html" copy "!UPDATE_SOURCE!\frontend\index.html" "frontend\index.html" >nul

REM Скрипты и документация
echo Обновление скриптов...
for %%f in ("!UPDATE_SOURCE!\*.bat") do (
    set "filename=%%~nxf"
    if not "!filename!"=="UPDATE.bat" (
        if not "!filename!"=="UPDATE-SAFE.bat" (
            copy "%%f" "%%~nxf" /Y >nul 2>&1
        )
    )
)

REM Обновляем версию
echo !NEW_VERSION!> VERSION.txt

echo [OK] Файлы обновлены
echo.

REM ============================================================
REM STEP 8: Восстановление пользовательских данных
REM ============================================================

echo [8/10] Восстановление пользовательских данных...
echo.

REM Восстанавливаем критические файлы из бэкапа
if exist "%FULL_BACKUP_DIR%\backend\.env" (
    copy "%FULL_BACKUP_DIR%\backend\.env" "backend\.env" >nul
    echo   ✅ .env восстановлен
)

if exist "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" (
    copy "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" "backend\moonbot_commander.db" >nul
    echo   ✅ База данных восстановлена
)

echo.

REM ============================================================
REM STEP 9: Установка зависимостей и ИНТЕЛЛЕКТУАЛЬНАЯ МИГРАЦИЯ
REM ============================================================

echo [9/10] Обновление зависимостей и миграция БД...
echo.

cd backend

REM Обновляем pip
python -m pip install --upgrade pip --quiet >nul 2>&1

REM Устанавливаем зависимости
echo Установка Python зависимостей...
pip install -r requirements.txt --quiet

REM ВАЖНО: Проверяем наличие intelligent_migration.py
if not exist "intelligent_migration.py" (
    echo.
    echo [ВНИМАНИЕ] Система интеллектуальной миграции не найдена!
    echo Используется старый метод миграции...
    echo.
    
    REM Старый метод - запускаем все миграции подряд
    for %%f in (migrate_*.py) do (
        echo   Миграция: %%f
        python %%f >nul 2>&1
    )
) else (
    echo.
    echo ============================================================
    echo     ЗАПУСК ИНТЕЛЛЕКТУАЛЬНОЙ МИГРАЦИИ БД
    echo ============================================================
    echo.
    
    REM Запускаем интеллектуальную миграцию
    python intelligent_migration.py
    
    if !errorlevel! neq 0 (
        echo.
        echo [ОШИБКА] Миграция завершилась с ошибками!
        echo.
        echo Вы можете:
        echo   1. Проверить файл backend\migration.log
        echo   2. Восстановить бэкап из %FULL_BACKUP_DIR%
        echo   3. Обратиться в поддержку
        echo.
        cd ..
        pause
        exit /b 1
    )
)

cd ..

REM Frontend зависимости
echo.
echo Обновление Frontend зависимостей...
cd frontend
call npm install --silent >nul 2>&1
if exist "dist" rmdir /s /q dist >nul 2>&1
if exist ".vite" rmdir /s /q .vite >nul 2>&1
cd ..

echo.

REM ============================================================
REM STEP 10: Финализация
REM ============================================================

echo [10/10] Завершение обновления...
echo.

REM Очистка временных файлов
rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
del "%TEMP_ZIP%" >nul 2>&1
del "%TEMP_JSON%" >nul 2>&1

REM ============================================================
REM ГОТОВО!
REM ============================================================

echo.
echo ============================================================
echo          ✅ ОБНОВЛЕНИЕ УСПЕШНО ЗАВЕРШЕНО!
echo ============================================================
echo.
echo Обновлено: v!CURRENT_VERSION! → v!NEW_VERSION!
echo.
echo 📦 Полный бэкап сохранен в: %FULL_BACKUP_DIR%
echo.
echo Что дальше:
echo   1. Запустите приложение через LOCAL-START.bat или SERVER-START.bat
echo   2. Проверьте что все работает корректно
echo   3. При проблемах используйте бэкап для восстановления
echo.
echo 💡 Совет: Сохраните UPDATE-SAFE.bat для будущих обновлений!
echo.
pause
endlocal
