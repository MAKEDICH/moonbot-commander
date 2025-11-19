#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Этот скрипт должен запускаться с правами root${NC}"
    echo "Используйте: sudo ./install-systemd-services.sh"
    exit 1
fi

echo ""
echo "============================================================"
echo "    Установка MoonBot Commander как systemd сервисов"
echo "============================================================"
echo ""

# Get installation path
INSTALL_PATH=""
if [ -f "../backend/main.py" ]; then
    INSTALL_PATH="$(cd .. && pwd)"
elif [ -f "backend/main.py" ]; then
    INSTALL_PATH="$(pwd)"
else
    echo -e "${YELLOW}Не могу определить путь установки автоматически${NC}"
    echo "Введите полный путь к папке moonbot-commander:"
    read -r INSTALL_PATH
fi

# Validate path
if [ ! -d "$INSTALL_PATH/backend" ] || [ ! -d "$INSTALL_PATH/frontend" ]; then
    echo -e "${RED}Ошибка: Неверный путь установки${NC}"
    echo "Путь должен содержать папки backend и frontend"
    exit 1
fi

echo -e "${GREEN}Путь установки: $INSTALL_PATH${NC}"

# Get username
if [ -n "$SUDO_USER" ]; then
    USERNAME="$SUDO_USER"
else
    echo "Введите имя пользователя для запуска сервисов:"
    read -r USERNAME
fi

# Validate user
if ! id "$USERNAME" >/dev/null 2>&1; then
    echo -e "${RED}Ошибка: Пользователь $USERNAME не существует${NC}"
    exit 1
fi

echo -e "${GREEN}Пользователь: $USERNAME${NC}"
echo ""

# Create log directory
echo "Создание директории для логов..."
mkdir -p /var/log/moonbot
chown "$USERNAME:$USERNAME" /var/log/moonbot
echo -e "${GREEN}✓ Директория логов создана${NC}"

# Create systemd service files
echo ""
echo "Создание systemd сервисов..."

# Backend service
cat > /etc/systemd/system/moonbot-backend.service << EOF
[Unit]
Description=MoonBot Commander Backend API
Documentation=https://github.com/MAKEDICH/moonbot-commander
After=network.target

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME
WorkingDirectory=$INSTALL_PATH/backend
Environment="MOONBOT_MODE=server"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStartPre=/bin/bash -c 'if command -v python3.11 &>/dev/null; then echo "Using Python 3.11"; elif command -v python3.10 &>/dev/null; then echo "Using Python 3.10"; else echo "Using default Python3"; fi'
ExecStart=/bin/bash -c 'PYTHON_CMD=python3; if command -v python3.11 &>/dev/null; then PYTHON_CMD=python3.11; elif command -v python3.10 &>/dev/null; then PYTHON_CMD=python3.10; fi; exec \$PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8000'
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitInterval=60
StandardOutput=append:/var/log/moonbot/backend.log
StandardError=append:/var/log/moonbot/backend-error.log
LimitNOFILE=65536
LimitNPROC=4096
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_PATH/backend

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ moonbot-backend.service создан${NC}"

# Scheduler service
cat > /etc/systemd/system/moonbot-scheduler.service << EOF
[Unit]
Description=MoonBot Commander Task Scheduler
Documentation=https://github.com/MAKEDICH/moonbot-commander
After=network.target moonbot-backend.service
Requires=moonbot-backend.service

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME
WorkingDirectory=$INSTALL_PATH/backend
Environment="MOONBOT_MODE=server"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/bin/bash -c 'PYTHON_CMD=python3; if command -v python3.11 &>/dev/null; then PYTHON_CMD=python3.11; elif command -v python3.10 &>/dev/null; then PYTHON_CMD=python3.10; fi; exec \$PYTHON_CMD scheduler.py'
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitInterval=60
StandardOutput=append:/var/log/moonbot/scheduler.log
StandardError=append:/var/log/moonbot/scheduler-error.log
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_PATH/backend

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ moonbot-scheduler.service создан${NC}"

# Frontend service
cat > /etc/systemd/system/moonbot-frontend.service << EOF
[Unit]
Description=MoonBot Commander Web Frontend
Documentation=https://github.com/MAKEDICH/moonbot-commander
After=network.target moonbot-backend.service
Wants=moonbot-backend.service

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME
WorkingDirectory=$INSTALL_PATH/frontend
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/node/bin"
ExecStartPre=/bin/bash -c 'if [ ! -d "dist" ] || [ -n "\$(find src -newer dist -print -quit 2>/dev/null)" ]; then echo "Building frontend..." && npm run build; fi'
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 3000
Restart=always
RestartSec=10
StartLimitBurst=5
StartLimitInterval=60
StandardOutput=append:/var/log/moonbot/frontend.log
StandardError=append:/var/log/moonbot/frontend-error.log
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_PATH/frontend

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ moonbot-frontend.service создан${NC}"

# Reload systemd
echo ""
echo "Перезагрузка systemd..."
systemctl daemon-reload
echo -e "${GREEN}✓ systemd перезагружен${NC}"

# Enable services
echo ""
echo "Включение автозапуска сервисов..."
systemctl enable moonbot-backend.service
systemctl enable moonbot-scheduler.service
systemctl enable moonbot-frontend.service
echo -e "${GREEN}✓ Автозапуск включен${NC}"

# Create helper script
echo ""
echo "Создание скрипта управления..."

cat > "$INSTALL_PATH/moonbot-control.sh" << 'EOF'
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

case "$1" in
    start)
        echo -e "${CYAN}Запуск MoonBot Commander...${NC}"
        sudo systemctl start moonbot-backend
        sleep 3
        sudo systemctl start moonbot-scheduler
        sudo systemctl start moonbot-frontend
        echo -e "${GREEN}✓ Запущено${NC}"
        ;;
    stop)
        echo -e "${CYAN}Остановка MoonBot Commander...${NC}"
        sudo systemctl stop moonbot-frontend
        sudo systemctl stop moonbot-scheduler
        sudo systemctl stop moonbot-backend
        echo -e "${GREEN}✓ Остановлено${NC}"
        ;;
    restart)
        echo -e "${CYAN}Перезапуск MoonBot Commander...${NC}"
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        echo -e "${CYAN}Статус сервисов:${NC}"
        echo ""
        echo -e "${YELLOW}Backend:${NC}"
        sudo systemctl status moonbot-backend --no-pager | head -n 3
        echo ""
        echo -e "${YELLOW}Scheduler:${NC}"
        sudo systemctl status moonbot-scheduler --no-pager | head -n 3
        echo ""
        echo -e "${YELLOW}Frontend:${NC}"
        sudo systemctl status moonbot-frontend --no-pager | head -n 3
        ;;
    logs)
        echo -e "${CYAN}Последние логи (Ctrl+C для выхода):${NC}"
        sudo journalctl -u moonbot-backend -u moonbot-scheduler -u moonbot-frontend -f
        ;;
    logs-backend)
        sudo journalctl -u moonbot-backend -f
        ;;
    logs-scheduler)
        sudo journalctl -u moonbot-scheduler -f
        ;;
    logs-frontend)
        sudo journalctl -u moonbot-frontend -f
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs|logs-backend|logs-scheduler|logs-frontend}"
        exit 1
        ;;
esac
EOF

chmod +x "$INSTALL_PATH/moonbot-control.sh"
echo -e "${GREEN}✓ Скрипт управления создан: $INSTALL_PATH/moonbot-control.sh${NC}"

# Show summary
echo ""
echo "============================================================"
echo -e "              ${GREEN}✅ УСТАНОВКА ЗАВЕРШЕНА${NC}"
echo "============================================================"
echo ""
echo "Управление сервисами:"
echo ""
echo "  ${CYAN}Запуск:${NC}      ./moonbot-control.sh start"
echo "  ${CYAN}Остановка:${NC}   ./moonbot-control.sh stop"
echo "  ${CYAN}Перезапуск:${NC}  ./moonbot-control.sh restart"
echo "  ${CYAN}Статус:${NC}      ./moonbot-control.sh status"
echo "  ${CYAN}Логи:${NC}        ./moonbot-control.sh logs"
echo ""
echo "Или через systemctl:"
echo ""
echo "  sudo systemctl start moonbot-backend"
echo "  sudo systemctl status moonbot-backend"
echo "  sudo journalctl -u moonbot-backend -f"
echo ""
echo "Файлы логов:"
echo "  /var/log/moonbot/backend.log"
echo "  /var/log/moonbot/scheduler.log"
echo "  /var/log/moonbot/frontend.log"
echo ""
echo -e "${YELLOW}Запустить сервисы сейчас? [Y/n]${NC} "
read -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    "$INSTALL_PATH/moonbot-control.sh" start
    echo ""
    
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo "============================================================"
    echo -e "            ${GREEN}MoonBot Commander запущен!${NC}"
    echo "============================================================"
    echo ""
    echo "Доступ к приложению:"
    echo ""
    echo "  Frontend: http://$SERVER_IP:3000"
    echo "  Backend:  http://$SERVER_IP:8000"
    echo "  API Docs: http://$SERVER_IP:8000/docs"
    echo ""
fi
