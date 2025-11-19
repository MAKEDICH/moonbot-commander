#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - SERVER MODE (Linux)"
echo "============================================================"
echo ""
echo "   Этот режим оптимизирован для VPS/выделенных серверов:"
echo "   - Фиксированные UDP порты (без эфемерных)"
echo "   - Keep-alive ОТКЛЮЧЕН (нет NAT)"
echo "   - Production конфигурация"
echo ""
echo "============================================================"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Check if setup was executed
if [ ! -f "backend/main.py" ] && [ ! -f "backend/main_v2.py" ]; then
    echo -e "${RED}[ERROR] Backend не найден!${NC}"
    echo ""
    echo "Сначала запустите server-setup.sh"
    echo ""
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}[ERROR] Файл .env не найден!${NC}"
    echo ""
    echo "Сначала запустите server-setup.sh для генерации ключей безопасности"
    echo ""
    exit 1
fi

# Detect Python command
PYTHON_CMD="python3"
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
fi

echo -e "${CYAN}Используется Python: $PYTHON_CMD${NC}"

# Security check
cd backend
$PYTHON_CMD check_keys.py >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}[WARNING] Ключи безопасности в .env недействительны!${NC}"
    echo -e "${CYAN}[ACTION] Автоматическое исправление ключей безопасности...${NC}"
    echo ""
    
    if [ -f "moonbot_commander.db" ]; then
        echo "Создание резервной копии старой БД..."
        [ -f "moonbot_commander.db.old" ] && rm -f "moonbot_commander.db.old"
        mv moonbot_commander.db moonbot_commander.db.old
        echo -e "${GREEN}[OK] Старая БД сохранена${NC}"
    fi
    
    [ -f ".env" ] && rm -f .env
    $PYTHON_CMD init_security.py
    
    $PYTHON_CMD check_keys.py >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Не удалось сгенерировать действительные ключи безопасности!${NC}"
        cd ..
        exit 1
    fi
    
    echo -e "${GREEN}[OK] Ключи безопасности перегенерированы${NC}"
    echo ""
fi

# Auto-detect application version
echo -e "${CYAN}[0/4] Определение версии приложения...${NC}"
echo ""

APP_VERSION="unknown"
MAIN_FILE="main.py"

# Check for schema_versions table in database (v2.0 indicator)
if [ -f "moonbot_commander.db" ]; then
    HAS_SCHEMA=$($PYTHON_CMD -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'\"); result = cursor.fetchone(); conn.close(); print('1' if result else '0')" 2>/dev/null || echo "0")
    
    if [ "$HAS_SCHEMA" = "1" ]; then
        APP_VERSION="v2.0"
        if [ -f "main_v2.py" ]; then
            MAIN_FILE="main_v2.py"
            echo -e "${GREEN}[DETECTED] Версия 2.0 - Используется main_v2.py${NC}"
        else
            MAIN_FILE="main.py"
            echo -e "${GREEN}[DETECTED] Версия 2.0 - Используется main.py (мигрированный)${NC}"
        fi
    else
        APP_VERSION="v1.0"
        MAIN_FILE="main.py"
        echo -e "${GREEN}[DETECTED] Версия 1.0 - Используется main.py${NC}"
    fi
else
    # No database - check which files exist
    if [ -f "main_v2.py" ]; then
        APP_VERSION="v2.0"
        MAIN_FILE="main_v2.py"
        echo -e "${GREEN}[DETECTED] Версия 2.0 (новая установка) - Используется main_v2.py${NC}"
    else
        APP_VERSION="v1.0"
        MAIN_FILE="main.py"
        echo -e "${GREEN}[DETECTED] Версия 1.0 (новая установка) - Используется main.py${NC}"
    fi
fi

echo ""
echo "Версия приложения: $APP_VERSION"
echo "Основной файл: $MAIN_FILE"
echo -e "${YELLOW}Режим: SERVER (Фиксированные порты, без keep-alive)${NC}"
echo ""

# Verify main file exists
if [ ! -f "$MAIN_FILE" ]; then
    echo -e "${RED}[ERROR] Основной файл не найден: $MAIN_FILE${NC}"
    echo ""
    echo "Доступные файлы:"
    ls -la main*.py
    echo ""
    cd ..
    exit 1
fi

cd ..

# Check if running as systemd service is preferred
if command -v systemctl &> /dev/null && [ "$EUID" -eq 0 ]; then
    echo ""
    echo -e "${CYAN}Обнаружен systemd. Хотите установить как системные сервисы?${NC}"
    echo "Это позволит:"
    echo "  - Автоматический запуск при загрузке"
    echo "  - Автоматический перезапуск при сбоях"
    echo "  - Управление через systemctl"
    echo ""
    read -p "Установить как systemd сервисы? [Y/n] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        # Create systemd service files
        echo -e "${CYAN}Создание systemd сервисов...${NC}"
        
        # Backend service
        cat > /etc/systemd/system/moonbot-backend.service << EOF
[Unit]
Description=MoonBot Commander Backend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$PROJECT_ROOT/backend
Environment="MOONBOT_MODE=server"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=$PYTHON_CMD -m uvicorn ${MAIN_FILE%.*}:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        # Scheduler service
        cat > /etc/systemd/system/moonbot-scheduler.service << EOF
[Unit]
Description=MoonBot Commander Scheduler
After=network.target moonbot-backend.service

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$PROJECT_ROOT/backend
Environment="MOONBOT_MODE=server"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=$PYTHON_CMD scheduler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        # Frontend service (production mode)
        cat > /etc/systemd/system/moonbot-frontend.service << EOF
[Unit]
Description=MoonBot Commander Frontend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$PROJECT_ROOT/frontend
Environment="NODE_ENV=production"
ExecStartPre=/usr/bin/npm run build
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        # Reload systemd
        systemctl daemon-reload
        
        # Enable and start services
        echo -e "${CYAN}Запуск сервисов...${NC}"
        systemctl enable moonbot-backend moonbot-scheduler moonbot-frontend
        systemctl start moonbot-backend
        sleep 3
        systemctl start moonbot-scheduler
        systemctl start moonbot-frontend
        
        echo ""
        echo -e "${GREEN}✅ Сервисы установлены и запущены!${NC}"
        echo ""
        echo "Команды управления:"
        echo "  systemctl status moonbot-backend   - статус backend"
        echo "  systemctl status moonbot-scheduler - статус scheduler"
        echo "  systemctl status moonbot-frontend  - статус frontend"
        echo "  systemctl restart moonbot-backend  - перезапуск backend"
        echo "  journalctl -u moonbot-backend -f  - логи backend"
        echo ""
        
        # Get IP address
        SERVER_IP=$(hostname -I | awk '{print $1}')
        
        echo "============================================================"
        echo -e "   ${GREEN}ЛОКАЛЬНЫЙ ДОСТУП (с этого сервера):${NC}"
        echo "============================================================"
        echo "   Frontend: http://localhost:3000"
        echo "   Backend:  http://localhost:8000"
        echo "   API Docs: http://localhost:8000/docs"
        echo ""
        echo "============================================================"
        echo -e "   ${GREEN}УДАЛЕННЫЙ ДОСТУП (с любого устройства):${NC}"
        echo "============================================================"
        echo "   Frontend: http://$SERVER_IP:3000"
        echo "   Backend:  http://$SERVER_IP:8000"
        echo "   API Docs: http://$SERVER_IP:8000/docs"
        echo ""
        echo "============================================================"
        
        exit 0
    fi
fi

# Manual start (not as systemd)
echo -e "${CYAN}[1/4] Очистка старых процессов...${NC}"
echo ""

# Check and kill old processes
if pgrep -f "python.*main.py" > /dev/null; then
    echo "Остановка старых Python процессов..."
    pkill -f "python.*main.py"
    pkill -f "python.*scheduler.py"
    echo -e "   ${GREEN}[OK] Python процессы остановлены${NC}"
else
    echo -e "   ${BLUE}[INFO] Нет старых Python процессов${NC}"
fi

if pgrep -f "node.*vite" > /dev/null; then
    echo "Остановка старых Node.js процессов..."
    pkill -f "node.*vite"
    echo -e "   ${GREEN}[OK] Node.js процессы остановлены${NC}"
else
    echo -e "   ${BLUE}[INFO] Нет старых Node.js процессов${NC}"
fi

sleep 2

echo "Очистка кэша frontend..."
cd frontend
rm -rf .vite dist 2>/dev/null || true
cd ..
echo -e "${GREEN}[OK] Очистка завершена${NC}"

echo ""
echo "Запуск сервисов..."
echo ""

# Backend
echo -e "${CYAN}[2/4] Запуск Backend $APP_VERSION [SERVER MODE]...${NC}"
export MOONBOT_MODE=server
cd backend
nohup $PYTHON_CMD -m uvicorn ${MAIN_FILE%.*}:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "Backend PID: $BACKEND_PID"
sleep 3

# Scheduler
echo -e "${CYAN}[3/4] Запуск Scheduler...${NC}"
cd backend
nohup $PYTHON_CMD scheduler.py > ../logs/scheduler.log 2>&1 &
SCHEDULER_PID=$!
cd ..
echo "Scheduler PID: $SCHEDULER_PID"
sleep 2

# Frontend production build
echo -e "${CYAN}[4/4] Подготовка Frontend для production...${NC}"
cd frontend

# Check if production build exists and is fresh
NEED_BUILD=0
if [ ! -d "dist" ]; then
    NEED_BUILD=1
    echo "Production сборка не найдена, создаем..."
else
    echo "Проверка необходимости пересборки..."
    # Check if any source file is newer than dist
    if [ -n "$(find src -newer dist -print -quit 2>/dev/null)" ]; then
        NEED_BUILD=1
        echo "Исходные файлы обновлены, требуется пересборка..."
    fi
fi

if [ $NEED_BUILD -eq 1 ]; then
    echo ""
    echo "============================================================"
    echo "   Создание оптимизированной production сборки..."
    echo "   Это займет 1-2 минуты (только при первом запуске или обновлении)"
    echo "============================================================"
    echo ""
    
    if npm run build; then
        echo ""
        echo -e "${GREEN}[OK] Production сборка создана успешно!${NC}"
        echo ""
    else
        echo ""
        echo -e "${RED}[ERROR] Production сборка не удалась!${NC}"
        echo "Запускаем в DEV режиме (медленнее, но работает)"
        echo ""
        nohup npm run dev -- --host 0.0.0.0 --port 3000 > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        cd ..
        SERVER_IP=$(hostname -I | awk '{print $1}')
        echo ""
        echo -e "${YELLOW}Frontend запущен в DEV режиме (PID: $FRONTEND_PID)${NC}"
        echo "Frontend: http://$SERVER_IP:3000"
        exit 0
    fi
else
    echo -e "${GREEN}[OK] Используется существующая production сборка${NC}"
fi

# Start production server
echo "Запуск Frontend в PRODUCTION режиме..."
echo "Это будет НАМНОГО быстрее по сети!"
nohup npm run preview -- --host 0.0.0.0 --port 3000 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "Frontend PID: $FRONTEND_PID"
sleep 5

echo ""
echo "============================================================"
echo -e "      ${GREEN}Приложение запущено $APP_VERSION [SERVER MODE]${NC}"
echo "============================================================"
echo ""

# Detect server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo "============================================================"
echo -e "   ${CYAN}ЛОКАЛЬНЫЙ ДОСТУП (с этого сервера):${NC}"
echo "============================================================"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "============================================================"
echo -e "   ${CYAN}УДАЛЕННЫЙ ДОСТУП (с любого устройства):${NC}"
echo "============================================================"
echo "   Frontend: http://$SERVER_IP:3000"
echo "   Backend:  http://$SERVER_IP:8000"
echo "   API Docs: http://$SERVER_IP:8000/docs"
echo ""
echo "============================================================"
echo ""
echo -e "${YELLOW}Режим: SERVER (PRODUCTION)${NC}"
echo "   - Frontend: PRODUCTION сборка (10x быстрее по сети!)"
echo "   - Доступно с ЛЮБОГО устройства (0.0.0.0:3000)"
echo "   - Фиксированные UDP порты (из настроек сервера)"
echo "   - Keep-alive ОТКЛЮЧЕН"
echo "   - Оптимизировано для VPS/выделенных серверов"
echo ""
echo "Производительность:"
echo "   - Загрузка страницы: ~1 секунда (против 5-10 сек в dev режиме)"
echo "   - Размер бандла: ~2 MB (против 30+ MB в dev режиме)"
echo "   - Авто-пересборка только при изменении исходных файлов"
echo ""
echo -e "${YELLOW}Процессы:${NC}"
echo "   Backend PID:   $BACKEND_PID"
echo "   Scheduler PID: $SCHEDULER_PID"
echo "   Frontend PID:  $FRONTEND_PID"
echo ""
echo -e "${GREEN}Логи:${NC}"
echo "   tail -f logs/backend.log"
echo "   tail -f logs/scheduler.log"
echo "   tail -f logs/frontend.log"
echo ""
echo "Для остановки: ./linux/kill-all-processes.sh"
echo ""
