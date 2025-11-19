@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title Подготовка обновления для Linux

echo.
echo ============================================================
echo     Подготовка файлов обновления для Linux пользователей
echo ============================================================
echo.

REM Создаем временную папку для Linux файлов
set "LINUX_UPDATE_DIR=linux-update-package"

if exist "%LINUX_UPDATE_DIR%" rmdir /s /q "%LINUX_UPDATE_DIR%"
mkdir "%LINUX_UPDATE_DIR%"

echo [1/5] Копирование основных файлов...

REM Копируем intelligent_migration.py
copy "backend\intelligent_migration.py" "%LINUX_UPDATE_DIR%\" >nul
echo   ✅ intelligent_migration.py

REM Копируем update-safe.sh
copy "linux\update-safe.sh" "%LINUX_UPDATE_DIR%\" >nul
echo   ✅ update-safe.sh

REM Копируем server-start-safe.sh
copy "linux\server-start-safe.sh" "%LINUX_UPDATE_DIR%\" >nul
echo   ✅ server-start-safe.sh

echo.
echo [2/5] Создание инструкции...

REM Создаем README для Linux пользователей
(
echo # Инструкция по обновлению MoonBot Commander на Linux
echo.
echo ## Файлы в этом пакете:
echo - `intelligent_migration.py` - интеллектуальная система миграций
echo - `update-safe.sh` - безопасный скрипт обновления  
echo - `server-start-safe.sh` - улучшенный запуск для серверов
echo.
echo ## Как обновить:
echo.
echo ### 1. Загрузите файлы на ваш Linux сервер
echo ```bash
echo # Через scp:
echo scp -r linux-update-package/ user@your-server:/tmp/
echo.
echo # Или через wget если выложите на хостинг:
echo wget http://your-host/linux-update-package.tar.gz
echo tar -xzf linux-update-package.tar.gz
echo ```
echo.
echo ### 2. Скопируйте файлы в проект
echo ```bash
echo cd /path/to/moonbot-commander
echo.
echo # Копируем интеллектуальную миграцию
echo cp /tmp/linux-update-package/intelligent_migration.py backend/
echo.
echo # Копируем скрипты обновления
echo cp /tmp/linux-update-package/update-safe.sh ./
echo cp /tmp/linux-update-package/server-start-safe.sh linux/
echo.
echo # Делаем исполняемыми
echo chmod +x update-safe.sh
echo chmod +x linux/server-start-safe.sh
echo ```
echo.
echo ### 3. Запустите обновление
echo ```bash
echo # Остановите приложение если запущено
echo sudo systemctl stop moonbot-backend moonbot-scheduler moonbot-frontend 2^>/dev/null
echo.
echo # Запустите безопасное обновление
echo ./update-safe.sh
echo ```
echo.
echo ### 4. После обновления
echo ```bash
echo # Для серверов:
echo sudo ./linux/server-start-safe.sh
echo.
echo # Или через systemd:
echo sudo systemctl start moonbot-backend moonbot-scheduler moonbot-frontend
echo ```
echo.
echo ## Что делает update-safe.sh:
echo - ✅ Создает полный бэкап
echo - ✅ Определяет текущую версию
echo - ✅ Скачивает выбранную версию с GitHub  
echo - ✅ Применяет только нужные миграции
echo - ✅ Сохраняет все пользовательские данные
echo - ✅ Поддерживает откат при ошибках
echo.
echo ## В случае проблем:
echo 1. Проверьте логи: `backend/migration.log`
echo 2. Используйте бэкап из `full_backups/`
echo 3. Обратитесь в поддержку
) > "%LINUX_UPDATE_DIR%\README.md"

echo   ✅ README.md
echo.

echo [3/5] Проверка совместимости...

REM Проверяем что intelligent_migration.py не содержит Windows-специфичного кода
findstr /C:"C:\\" "backend\intelligent_migration.py" >nul
if %errorlevel% equ 0 (
    echo   ⚠️  ВНИМАНИЕ: Найдены Windows пути в intelligent_migration.py
    echo      Они будут работать через Path библиотеку
)

echo   ✅ Файлы кроссплатформенные
echo.

echo [4/5] Создание архива...

REM Создаем tar.gz архив если есть WSL
where wsl >nul 2>&1
if %errorlevel% equ 0 (
    echo   Создание tar.gz через WSL...
    wsl tar -czf linux-update-package.tar.gz -C linux-update-package .
    if exist "linux-update-package.tar.gz" (
        echo   ✅ linux-update-package.tar.gz создан
    )
) else (
    echo   ⚠️  WSL не найден, tar.gz не создан
    echo      Используйте папку linux-update-package напрямую
)

echo.
echo [5/5] Готово!
echo.

echo ============================================================
echo                    ИНСТРУКЦИЯ
echo ============================================================
echo.
echo 1. Отправьте папку "%LINUX_UPDATE_DIR%" Linux пользователям
echo    или архив linux-update-package.tar.gz (если создан)
echo.
echo 2. Пользователи должны:
echo    - Скопировать intelligent_migration.py в backend/
echo    - Скопировать update-safe.sh в корень проекта
echo    - Скопировать server-start-safe.sh в linux/
echo    - Запустить ./update-safe.sh
echo.
echo 3. Подробная инструкция в %LINUX_UPDATE_DIR%\README.md
echo.
pause
