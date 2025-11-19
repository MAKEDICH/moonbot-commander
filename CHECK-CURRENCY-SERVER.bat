@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🔍 ДИАГНОСТИКА ВАЛЮТ НА СЕРВЕРЕ
echo ============================================================
echo.

cd /d "%~dp0"
cd backend

echo [1/4] Проверка валют в базе данных...
echo =====================================
python -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); cursor=conn.cursor(); cursor.execute('SELECT id, name, host, port, default_currency FROM servers'); servers=cursor.fetchall(); print('\nСерверы и их валюты:'); [print(f'ID: {s[0]}, Name: {s[1]}, Host: {s[2]}:{s[3]}, Currency: {s[4]}') for s in servers]; conn.close()" 2>nul

echo.
echo [2/4] Проверка структуры таблицы servers...
echo ===========================================
python -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); cursor=conn.cursor(); cursor.execute('PRAGMA table_info(servers)'); cols=cursor.fetchall(); print('Колонки:'); [print(f'  - {col[1]} ({col[2]})') for col in cols]; conn.close()" 2>nul | findstr "currency"

echo.
echo [3/4] Проверка последних lst команд...
echo ======================================
python -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); cursor=conn.cursor(); cursor.execute(\"SELECT server_id, command_text, response_text FROM command_history WHERE command_text LIKE 'lst%%' ORDER BY created_at DESC LIMIT 5\"); cmds=cursor.fetchall(); print('Последние lst команды:'); [print(f'\nServer {c[0]}: {c[1]}\nОтвет: {c[2][:200]}...') for c in cmds if c[2]]; conn.close()" 2>nul

echo.
echo [4/4] Тест определения валюты...
echo ================================
python -c "
test_messages = [
    'Available: 8410.60$  Total: 8412.58$',
    'Available USDC: 2903.4$ Total: 2997.46$',
    'Доступно TRY: 108.4k Total: 565285 TRY',
    'Available: 5000 BTC Total: 5500 BTC'
]

import re

def extract_currency(message):
    # Копия логики из udp_listener.py
    excluded_words = {'SELL', 'BUY', 'OPEN', 'CLOSE', 'ORDER', 'ORDERS', 'TOTAL', 'AVAILABLE', 'PROFIT', 'LOSS'}
    found_currencies = []
    
    patterns = [
        (r'Available\s+([A-Z]{2,10}):', 100),
        (r'Доступно\s+([A-Z]{2,10}):', 100),
        (r':\s*([\d,\.]+)\s*([A-Z]{2,10})', 90),
        (r'([\d,\.]+)\s*([A-Z]{2,10})\b', 80),
        (r'(?:Balance|Total|Баланс):\s*[\d,\.]+\s+([A-Z]{2,10})', 60),
        (r'\b([A-Z]{2,10})\b', 30),
    ]
    
    for pattern, priority in patterns:
        for match in re.finditer(pattern, message, re.IGNORECASE):
            currency = match.groups()[-1].upper()
            if currency not in excluded_words and 2 <= len(currency) <= 10:
                found_currencies.append((currency, priority))
    
    if not found_currencies:
        if '$' in message:
            return 'USDT'
        return 'USDT'
    
    found_currencies.sort(key=lambda x: -x[1])
    return found_currencies[0][0]

print('Тесты определения валюты:')
for msg in test_messages:
    currency = extract_currency(msg)
    print(f'{msg[:50]}... -> {currency}')
" 2>nul

echo.
echo ============================================================
echo.
echo Если валюты в БД пустые или неправильные:
echo 1. Отправьте команду "lst" каждому боту
echo 2. Проверьте логи: backend\logs\moonbot.log
echo 3. Ищите строки: "Server currency updated:"
echo.
pause
