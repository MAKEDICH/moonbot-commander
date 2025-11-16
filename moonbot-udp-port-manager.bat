@echo off
chcp 65001 >nul
title MoonBot - Управление UDP портами
color 0B

:MENU
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          MoonBot - Управление UDP портами                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo  Этот сервер: %COMPUTERNAME%
echo  IP адрес: 
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    echo   %%a
)
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo  Выберите действие:
echo.
echo  [1] Показать открытые UDP порты (только номера)
echo  [2] Проверить порты с расшифровкой (подробно)
echo  [3] Открыть UDP порт
echo  [4] Закрыть UDP порт
echo  [5] Удалить все правила MoonBot
echo.
echo  [6] ⚠️  Проверка безопасности: найти опасные открытые порты
echo.
echo  [0] Выход
echo.
echo ════════════════════════════════════════════════════════════
echo.
set /p choice="Ваш выбор: "

if "%choice%"=="1" goto CHECK_PORTS_SHORT
if "%choice%"=="2" goto CHECK_PORTS_DETAILED
if "%choice%"=="3" goto OPEN_PORT
if "%choice%"=="4" goto CLOSE_PORT
if "%choice%"=="5" goto DELETE_ALL
if "%choice%"=="6" goto SECURITY_CHECK
if "%choice%"=="0" goto EXIT
goto MENU

:CHECK_PORTS_SHORT
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║            Открытые UDP порты (только номера)             ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Открытые UDP порты:
echo.

REM Собираем все UDP порты в один список
setlocal enabledelayedexpansion
set "ports="
for /f "tokens=*" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /C:"LocalPort"') do (
    for /f "tokens=2 delims=:" %%b in ("%%a") do (
        set port=%%b
        set port=!port: =!
        if not "!port!"=="" (
            if "!ports!"=="" (
                set "ports=!port!"
            ) else (
                set "ports=!ports!, !port!"
            )
        )
    )
)

if "!ports!"=="" (
    echo   Нет открытых UDP портов
) else (
    echo   !ports!
)

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Порты для MoonBot:
echo.

REM Собираем порты MoonBot
set "moonbot_ports="
for /f "tokens=*" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /i "MoonBot"') do (
    set line=%%a
    echo !line! | findstr /C:"LocalPort" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims=:" %%b in ("%%a") do (
            set port=%%b
            set port=!port: =!
            if not "!port!"=="" (
                if "!moonbot_ports!"=="" (
                    set "moonbot_ports=!port!"
                ) else (
                    set "moonbot_ports=!moonbot_ports!, !port!"
                )
            )
        )
    )
)

if "!moonbot_ports!"=="" (
    echo   Нет портов MoonBot
) else (
    echo   !moonbot_ports!
)

endlocal
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Для подробной информации выберите пункт [2]
echo.
pause
goto MENU

:CHECK_PORTS_DETAILED
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         Открытые UDP порты (с расшифровкой)               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Все UDP правила Firewall:
echo.
netsh advfirewall firewall show rule name=all | findstr /C:"Rule Name" /C:"LocalPort" /C:"Protocol" /C:"Direction"
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Правила для MoonBot (подробно):
echo.
netsh advfirewall firewall show rule name=all | findstr /i /C:"MoonBot" /C:"Rule Name:" /C:"LocalPort:" /C:"Protocol:" /C:"Direction:" /C:"Action:"

if %errorlevel% neq 0 (
    echo   Правил MoonBot не найдено
)

echo.
echo ════════════════════════════════════════════════════════════
pause
goto MENU

:OPEN_PORT
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                   Открыть UDP порт                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Требуются права администратора!
    echo.
    echo Запустите этот .bat файл от имени администратора:
    echo   Правый клик → "Запуск от имени администратора"
    echo.
    pause
    goto MENU
)

echo Введите номер UDP порта для открытия.
echo Стандартные порты MoonBot: 5005, 5006, 5007 и т.д.
echo.
set /p port="UDP Порт: "

REM Проверка что порт - это число
echo %port%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo.
    echo ❌ Ошибка: Порт должен быть числом!
    pause
    goto MENU
)

REM Проверка диапазона
if %port% LSS 1 (
    echo ❌ Ошибка: Порт должен быть больше 0!
    pause
    goto MENU
)
if %port% GTR 65535 (
    echo ❌ Ошибка: Порт должен быть меньше 65536!
    pause
    goto MENU
)

echo.
set /p name="Название (например: Bot1): "
if "%name%"=="" set name=Bot

set rulename=MoonBot-%name%-UDP-%port%

echo.
echo Открываем UDP порт %port% (правило: %rulename%)...
echo.

REM Удаляем старое правило если есть
netsh advfirewall firewall delete rule name="%rulename%-IN" >nul 2>&1
netsh advfirewall firewall delete rule name="%rulename%-OUT" >nul 2>&1

REM Создаём новые правила (входящий и исходящий)
echo Создаём правило IN...
netsh advfirewall firewall add rule name="%rulename%-IN" dir=in action=allow protocol=UDP localport=%port%

if %errorlevel% neq 0 (
    echo ❌ Ошибка при создании правила IN!
    pause
    goto MENU
)

echo Создаём правило OUT...
netsh advfirewall firewall add rule name="%rulename%-OUT" dir=out action=allow protocol=UDP localport=%port%

if %errorlevel% neq 0 (
    echo ❌ Ошибка при создании правила OUT!
    pause
    goto MENU
)

if %errorlevel% equ 0 (
    echo ✓ Порт UDP %port% успешно открыт!
    echo ✓ Правила созданы:
    echo   - %rulename%-IN (входящий)
    echo   - %rulename%-OUT (исходящий)
    echo.
    echo Теперь вы можете:
    echo   1. В MoonBot: Настройки → Специальные → Remote → UDP Commands Port = %port%
    echo   2. В приложении добавить сервер с портом %port%
) else (
    echo ❌ Ошибка при открытии порта!
)

echo.
pause
goto MENU

:CLOSE_PORT
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                   Закрыть UDP порт                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Требуются права администратора!
    echo.
    echo Запустите этот .bat файл от имени администратора:
    echo   Правый клик → "Запуск от имени администратора"
    echo.
    pause
    goto MENU
)

echo Текущие порты MoonBot (для справки):
echo.

REM Показываем только порты
setlocal enabledelayedexpansion
set "moonbot_ports="
for /f "tokens=*" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /i "MoonBot"') do (
    set line=%%a
    echo !line! | findstr /C:"LocalPort" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims=:" %%b in ("%%a") do (
            set port=%%b
            set port=!port: =!
            if not "!port!"=="" (
                if "!moonbot_ports!"=="" (
                    set "moonbot_ports=!port!"
                ) else (
                    set "moonbot_ports=!moonbot_ports!, !port!"
                )
            )
        )
    )
)

if "!moonbot_ports!"=="" (
    echo   Нет портов MoonBot
) else (
    echo   !moonbot_ports!
)
endlocal

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Введите порт для закрытия (удалит все правила с этим портом).
echo.
set /p port="Порт: "

if "%port%"=="" (
    echo ❌ Не указан порт!
    pause
    goto MENU
)

REM Проверяем - это число
echo %port%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo ❌ Порт должен быть числом!
    pause
    goto MENU
)

echo.
echo Удаляем все правила для порта %port%...
netsh advfirewall firewall delete rule name=all protocol=UDP localport=%port%

if %errorlevel% equ 0 (
    echo ✓ Все правила для порта %port% удалены!
) else (
    echo ⚠️  Правила не найдены или ошибка!
)

echo.
pause
goto MENU

:DELETE_ALL
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          Удалить ВСЕ правила MoonBot                      ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Требуются права администратора!
    echo.
    pause
    goto MENU
)

echo ⚠️  ВНИМАНИЕ! Это удалит ВСЕ правила с названием содержащим "MoonBot"!
echo.

REM Показываем какие порты будут удалены
echo Будут удалены порты:
echo.
setlocal enabledelayedexpansion
set "moonbot_ports="
for /f "tokens=*" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /i "MoonBot"') do (
    set line=%%a
    echo !line! | findstr /C:"LocalPort" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims=:" %%b in ("%%a") do (
            set port=%%b
            set port=!port: =!
            if not "!port!"=="" (
                if "!moonbot_ports!"=="" (
                    set "moonbot_ports=!port!"
                ) else (
                    set "moonbot_ports=!moonbot_ports!, !port!"
                )
            )
        )
    )
)

if "!moonbot_ports!"=="" (
    echo   Нет правил MoonBot
    endlocal
    echo.
    pause
    goto MENU
) else (
    echo   !moonbot_ports!
)
endlocal

echo.
set /p confirm="Вы уверены? (yes/no): "

if /i "%confirm%" neq "yes" (
    echo.
    echo Отменено.
    pause
    goto MENU
)

echo.
echo Удаление правил...
setlocal enabledelayedexpansion
for /f "tokens=2 delims=:" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /i /c:"Rule Name:" ^| findstr /i "MoonBot"') do (
    set rulename=%%a
    REM Удаляем пробелы в начале
    for /f "tokens=* delims= " %%b in ("!rulename!") do set rulename=%%b
    netsh advfirewall firewall delete rule name="!rulename!" >nul 2>&1
    echo ✓ Удалено: !rulename!
)
endlocal

echo.
echo ✓ Все правила MoonBot удалены!
pause
goto MENU

:SECURITY_CHECK
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║        ⚠️  ПРОВЕРКА БЕЗОПАСНОСТИ ПОРТОВ                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Проверяем потенциально опасные открытые порты...
echo.

setlocal enabledelayedexpansion

REM Список опасных портов (порт:название:описание)
set "dangerous_ports=21:FTP:Незашифрованная передача файлов"
set "dangerous_ports=!dangerous_ports!;22:SSH:Удаленный доступ (если не ваш)"
set "dangerous_ports=!dangerous_ports!;23:Telnet:Незашифрованный удаленный доступ"
set "dangerous_ports=!dangerous_ports!;25:SMTP:Почтовый сервер (спам риск)"
set "dangerous_ports=!dangerous_ports!;53:DNS:DNS сервер (DDoS риск)"
set "dangerous_ports=!dangerous_ports!;80:HTTP:Веб-сервер (если не защищен)"
set "dangerous_ports=!dangerous_ports!;110:POP3:Почта (незашифровано)"
set "dangerous_ports=!dangerous_ports!;135:RPC:Windows RPC (высокий риск)"
set "dangerous_ports=!dangerous_ports!;139:NetBIOS:Файловый доступ (опасно)"
set "dangerous_ports=!dangerous_ports!;143:IMAP:Почта (незашифровано)"
set "dangerous_ports=!dangerous_ports!;443:HTTPS:Веб-сервер SSL"
set "dangerous_ports=!dangerous_ports!;445:SMB:Общие папки Windows (ОПАСНО!)"
set "dangerous_ports=!dangerous_ports!;1433:SQL Server:База данных (не должен быть открыт)"
set "dangerous_ports=!dangerous_ports!;1434:SQL Browser:SQL Server (не должен быть открыт)"
set "dangerous_ports=!dangerous_ports!;3306:MySQL:База данных (не должна быть открыта)"
set "dangerous_ports=!dangerous_ports!;3389:RDP:Удаленный рабочий стол (атаки)"
set "dangerous_ports=!dangerous_ports!;3391:RD Gateway:Шлюз RDP"
set "dangerous_ports=!dangerous_ports!;5432:PostgreSQL:База данных (не должна быть открыта)"
set "dangerous_ports=!dangerous_ports!;5900:VNC:Удаленный доступ"
set "dangerous_ports=!dangerous_ports!;5985:WinRM HTTP:Удаленное управление Windows"
set "dangerous_ports=!dangerous_ports!;5986:WinRM HTTPS:Удаленное управление Windows"
set "dangerous_ports=!dangerous_ports!;8080:HTTP Alt:Альтернативный веб-порт"
set "dangerous_ports=!dangerous_ports!;8443:HTTPS Alt:Альтернативный HTTPS"
set "dangerous_ports=!dangerous_ports!;27017:MongoDB:База данных (не должна быть открыта)"

REM Получаем все открытые порты из Firewall
set "found_dangerous=0"
set "found_ports="

echo ════════════════════════════════════════════════════════════
echo  ⚠️  ОПАСНЫЕ ОТКРЫТЫЕ ПОРТЫ:
echo ════════════════════════════════════════════════════════════
echo.

for /f "tokens=2 delims=:" %%a in ('netsh advfirewall firewall show rule name^=all ^| findstr /C:"LocalPort"') do (
    set port=%%a
    set port=!port: =!
    
    REM Проверяем каждый найденный порт против списка опасных
    for %%p in (!dangerous_ports!) do (
        set rule=%%p
        for /f "tokens=1,2,3 delims=:" %%x in ("!rule!") do (
            if "!port!"=="%%x" (
                set found_dangerous=1
                echo   [!] Порт %%x (%%y)
                echo       └─ %%z
                echo.
            )
        )
    )
)

if !found_dangerous!==0 (
    echo   ✓ Опасных портов не найдено!
    echo.
) else (
    echo ════════════════════════════════════════════════════════════
)

echo.
echo ════════════════════════════════════════════════════════════
echo  📋 ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ:
echo ════════════════════════════════════════════════════════════
echo.

REM Проверка RDP (3389) - особенно опасен
netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "3389" >nul
if !errorlevel! equ 0 (
    echo   [⚠️  КРИТИЧНО] RDP порт 3389 открыт!
    echo       └─ Рекомендация: Разрешить доступ только с определенных IP
    echo       └─ Или использовать VPN
    echo.
)

REM Проверка SMB (445) - очень опасен
netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "445" >nul
if !errorlevel! equ 0 (
    echo   [⚠️  КРИТИЧНО] SMB порт 445 открыт!
    echo       └─ Рекомендация: Немедленно закрыть этот порт
    echo       └─ Это главный вектор атак (WannaCry, EternalBlue)
    echo.
)

REM Проверка SQL Server (1433)
netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "1433" >nul
if !errorlevel! equ 0 (
    echo   [⚠️  ВЫСОКИЙ РИСК] SQL Server порт 1433 открыт!
    echo       └─ Рекомендация: Закрыть или ограничить доступ
    echo       └─ Базы данных не должны быть доступны из интернета
    echo.
)

REM Проверка MySQL (3306)
netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "3306" >nul
if !errorlevel! equ 0 (
    echo   [⚠️  ВЫСОКИЙ РИСК] MySQL порт 3306 открыт!
    echo       └─ Рекомендация: Закрыть или ограничить доступ
    echo       └─ Базы данных не должны быть доступны из интернета
    echo.
)

echo ════════════════════════════════════════════════════════════
echo  ✅ БЕЗОПАСНЫЕ ПОРТЫ (для справки):
echo ════════════════════════════════════════════════════════════
echo.
echo   3000 - MoonBot Frontend (веб-интерфейс)
echo   8000 - MoonBot Backend API
echo   5005-5010 - MoonBot UDP (команды ботам)
echo.
echo   Эти порты безопасны для открытия с правильной настройкой!
echo.

echo ════════════════════════════════════════════════════════════
echo  💡 РЕКОМЕНДАЦИИ ПО БЕЗОПАСНОСТИ:
echo ════════════════════════════════════════════════════════════
echo.
echo   1. Закройте все неиспользуемые порты
echo   2. Для RDP используйте VPN или ограничьте IP
echo   3. Порты баз данных (1433, 3306, 5432) - только локально!
echo   4. Порт 445 (SMB) - ВСЕГДА должен быть закрыт
echo   5. Используйте сложные пароли
echo   6. Включите Windows Firewall
echo   7. Регулярно обновляйте Windows
echo.

echo ════════════════════════════════════════════════════════════
echo  🔍 Для проверки правил конкретного порта:
echo     Выберите пункт [2] из главного меню
echo ════════════════════════════════════════════════════════════

echo.
echo.

REM Предлагаем закрыть критичные порты
if !found_dangerous!==1 (
    echo ════════════════════════════════════════════════════════════
    echo  ⚡ БЫСТРОЕ ДЕЙСТВИЕ
    echo ════════════════════════════════════════════════════════════
    echo.
    set /p quick_action="Закрыть ВСЕ критично опасные порты сейчас? (yes/no): "
    
    if /i "!quick_action!"=="yes" (
        REM Проверка прав администратора
        net session >nul 2>&1
        if !errorlevel! neq 0 (
            echo.
            echo ❌ Требуются права администратора для закрытия портов!
            echo    Перезапустите батник от имени администратора.
        ) else (
            echo.
            echo Закрываем критично опасные порты...
            echo.
            
            REM Закрываем самые опасные порты
            set "closed_count=0"
            
            REM 445 - SMB (WannaCry)
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "445" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=445 >nul 2>&1
                netsh advfirewall firewall delete rule name=all protocol=UDP localport=445 >nul 2>&1
                echo   ✓ Закрыт порт 445 (SMB)
                set /a closed_count+=1
            )
            
            REM 135 - RPC
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "135" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=135 >nul 2>&1
                netsh advfirewall firewall delete rule name=all protocol=UDP localport=135 >nul 2>&1
                echo   ✓ Закрыт порт 135 (RPC)
                set /a closed_count+=1
            )
            
            REM 139 - NetBIOS
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "139" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=139 >nul 2>&1
                netsh advfirewall firewall delete rule name=all protocol=UDP localport=139 >nul 2>&1
                echo   ✓ Закрыт порт 139 (NetBIOS)
                set /a closed_count+=1
            )
            
            REM 1433 - SQL Server
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "1433" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=1433 >nul 2>&1
                netsh advfirewall firewall delete rule name=all protocol=UDP localport=1433 >nul 2>&1
                echo   ✓ Закрыт порт 1433 (SQL Server)
                set /a closed_count+=1
            )
            
            REM 1434 - SQL Browser
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "1434" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=UDP localport=1434 >nul 2>&1
                echo   ✓ Закрыт порт 1434 (SQL Browser)
                set /a closed_count+=1
            )
            
            REM 3306 - MySQL
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "3306" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=3306 >nul 2>&1
                echo   ✓ Закрыт порт 3306 (MySQL)
                set /a closed_count+=1
            )
            
            REM 5432 - PostgreSQL
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "5432" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=5432 >nul 2>&1
                echo   ✓ Закрыт порт 5432 (PostgreSQL)
                set /a closed_count+=1
            )
            
            REM 27017 - MongoDB
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr "27017" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=27017 >nul 2>&1
                echo   ✓ Закрыт порт 27017 (MongoDB)
                set /a closed_count+=1
            )
            
            REM 23 - Telnet
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr " 23" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=23 >nul 2>&1
                echo   ✓ Закрыт порт 23 (Telnet)
                set /a closed_count+=1
            )
            
            REM 21 - FTP
            netsh advfirewall firewall show rule name=all | findstr /C:"LocalPort" | findstr " 21" >nul 2>&1
            if !errorlevel! equ 0 (
                netsh advfirewall firewall delete rule name=all protocol=TCP localport=21 >nul 2>&1
                echo   ✓ Закрыт порт 21 (FTP)
                set /a closed_count+=1
            )
            
            echo.
            if !closed_count! gtr 0 (
                echo ═══════════════════════════════════════════════════════════
                echo   ✓ Закрыто портов: !closed_count!
                echo   ✓ Сервер стал безопаснее!
                echo ═══════════════════════════════════════════════════════════
            ) else (
                echo   ℹ️  Критичные порты уже закрыты
            )
            
            echo.
            echo ⚠️  ВАЖНО: Порт RDP (3389) не был закрыт автоматически,
            echo     чтобы вы не потеряли доступ к серверу!
            echo     Настройте его вручную или используйте VPN.
        )
    ) else (
        echo.
        echo Пропущено. Закройте порты вручную через пункт [4].
    )
)

endlocal
echo.
pause
goto MENU

:EXIT
cls
echo.
echo Спасибо за использование MoonBot UDP Manager!
echo.
timeout /t 2 /nobreak >nul
exit

:EOF
