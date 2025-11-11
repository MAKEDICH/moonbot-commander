#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}[ERROR] This script must be run as root (sudo)${NC}"
    echo ""
    echo "Please run: sudo ./server-start.sh"
    echo ""
    exit 1
fi

echo ""
echo "============================================================"
echo "       MoonBot Commander - Server Start (Linux)"
echo "============================================================"
echo ""

# Check if setup was executed
if [ ! -f "backend/main.py" ]; then
    echo -e "${RED}[ERROR] Backend not found!${NC}"
    echo ""
    echo "Please run sudo ./server-setup.sh first"
    echo ""
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}[ERROR] .env file not found!${NC}"
    echo ""
    echo "Please run sudo ./server-setup.sh first to generate security keys"
    echo ""
    exit 1
fi

# Security check
cd backend
python3 check_keys.py > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}[WARNING] Security keys in .env are invalid or corrupted!${NC}"
    echo ""
    echo "This may happen if:"
    echo "   - .env file was manually edited incorrectly"
    echo "   - ENCRYPTION_KEY is invalid or placeholder text"
    echo "   - SECRET_KEY is too short or placeholder text"
    echo ""
    echo -e "${YELLOW}[ACTION] Auto-fixing security keys...${NC}"
    echo ""
    
    # Backup and delete old database
    if [ -f "moonbot_commander.db" ]; then
        echo "Backing up old database..."
        rm -f moonbot_commander.db.old
        mv moonbot_commander.db moonbot_commander.db.old
        echo -e "${GREEN}[OK] Old database backed up to moonbot_commander.db.old${NC}"
    fi
    
    # Delete invalid .env
    if [ -f ".env" ]; then
        echo "Removing invalid .env file..."
        rm .env
        echo -e "${GREEN}[OK] Invalid .env removed${NC}"
    fi
    
    # Generate new valid keys
    echo "Generating new security keys..."
    python3 init_security.py
    
    # Verify new keys are valid
    python3 check_keys.py > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to generate valid security keys!${NC}"
        echo "Please run sudo ./server-setup.sh manually"
        cd ..
        exit 1
    fi
    
    echo -e "${GREEN}[OK] Security keys regenerated successfully${NC}"
    echo -e "${YELLOW}[INFO] You will need to register a new user (old database was incompatible)${NC}"
    echo ""
    
    # Auto-configure CORS for server IP
    echo "Configuring CORS..."
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    if [ ! -z "$SERVER_IP" ]; then
        if ! grep -q "http://$SERVER_IP:3000" .env; then
            sed -i "s|CORS_ORIGINS=\(.*\)|CORS_ORIGINS=\1,http://$SERVER_IP:3000|g" .env
            echo -e "${GREEN}[OK] Added $SERVER_IP to CORS_ORIGINS${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}[OK] Security fixed! Continuing startup...${NC}"
    echo ""
fi
cd ..

if [ ! -f "frontend/dist/index.html" ]; then
    echo -e "${RED}[ERROR] Frontend dist not found!${NC}"
    echo ""
    echo "Please run sudo ./server-setup.sh first"
    echo ""
    exit 1
fi

echo ""
echo -e "${CYAN}[0/3] Stopping old services if running...${NC}"
echo ""

# Stop services if running
systemctl stop moonbot-backend.service 2>/dev/null && echo "  [OK] Backend service stopped" || echo "  [INFO] Backend not running"
systemctl stop moonbot-scheduler.service 2>/dev/null && echo "  [OK] Scheduler service stopped" || echo "  [INFO] Scheduler not running"
systemctl stop moonbot-frontend.service 2>/dev/null && echo "  [OK] Frontend service stopped" || echo "  [INFO] Frontend not running"

sleep 2
echo -e "${GREEN}[OK] Cleanup complete${NC}"
echo ""

echo "Starting all services..."
echo ""

echo -e "${CYAN}[1/3] Starting Backend...${NC}"
systemctl start moonbot-backend.service
sleep 2
if systemctl is-active --quiet moonbot-backend.service; then
    echo -e "${GREEN}[OK] Backend started${NC}"
else
    echo -e "${RED}[ERROR] Backend failed to start${NC}"
    echo "Check logs: sudo journalctl -u moonbot-backend -n 50"
    exit 1
fi

echo -e "${CYAN}[2/3] Starting Scheduler...${NC}"
systemctl start moonbot-scheduler.service
sleep 2
if systemctl is-active --quiet moonbot-scheduler.service; then
    echo -e "${GREEN}[OK] Scheduler started${NC}"
else
    echo -e "${RED}[ERROR] Scheduler failed to start${NC}"
    echo "Check logs: sudo journalctl -u moonbot-scheduler -n 50"
    exit 1
fi

echo -e "${CYAN}[3/3] Starting Frontend...${NC}"
systemctl start moonbot-frontend.service
sleep 3
if systemctl is-active --quiet moonbot-frontend.service; then
    echo -e "${GREEN}[OK] Frontend started${NC}"
else
    echo -e "${RED}[ERROR] Frontend failed to start${NC}"
    echo "Check logs: sudo journalctl -u moonbot-frontend -n 50"
    exit 1
fi

echo ""
echo "============================================================"
echo "[OK] All services started successfully!"
echo "============================================================"
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo "Services status:"
systemctl status moonbot-backend.service --no-pager | head -3
systemctl status moonbot-scheduler.service --no-pager | head -3
systemctl status moonbot-frontend.service --no-pager | head -3

echo ""
echo "Open in browser:"
echo "   http://$SERVER_IP:3000"
echo ""
echo "Services will auto-start on reboot"
echo ""
echo "To stop: sudo ./kill-all-processes.sh"
echo "To view logs: sudo journalctl -u moonbot-backend -f"
echo ""

