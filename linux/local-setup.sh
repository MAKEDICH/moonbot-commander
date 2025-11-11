#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "     MoonBot Commander - Local Setup (Linux)"
echo "============================================================"
echo ""

# Check Python
echo -e "${CYAN}[1/4] Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] Python 3 not installed${NC}"
    echo "Install with: sudo apt install python3 python3-pip"
    exit 1
fi
echo -e "${GREEN}[OK] Python found: $(python3 --version)${NC}"

# Check Node.js
echo -e "${CYAN}[2/4] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js not installed${NC}"
    echo "Install with: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js found: $(node --version)${NC}"

echo ""
echo -e "${CYAN}[3/4] Setting up Backend...${NC}"
cd backend

echo "Installing packages..."
python3 -m pip install --upgrade pip --quiet
pip3 install -r requirements.txt --quiet
echo -e "${GREEN}[OK] Packages installed${NC}"

echo "Verifying WebSocket support..."
python3 -c "import websockets" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[WARNING] WebSocket library not found${NC}"
    echo -e "${YELLOW}[ACTION] Installing websockets...${NC}"
    pip3 install websockets --quiet
    python3 -c "import websockets" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to install websockets${NC}"
        cd ..
        exit 1
    fi
    echo -e "${GREEN}[OK] WebSocket support added${NC}"
else
    echo -e "${GREEN}[OK] WebSocket support confirmed${NC}"
fi

echo "Initializing security..."

# Check if keys are valid
python3 check_keys.py > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[WARNING] Security keys are invalid or missing${NC}"
    echo -e "${YELLOW}[ACTION] Regenerating security keys...${NC}"
    
    # Backup old database if exists
    if [ -f "moonbot_commander.db" ]; then
        echo -e "${YELLOW}[WARNING] Found existing database with incompatible encryption keys${NC}"
        [ -f "moonbot_commander.db.old" ] && rm moonbot_commander.db.old
        mv moonbot_commander.db moonbot_commander.db.old
        echo -e "${GREEN}[OK] Old database backed up to moonbot_commander.db.old${NC}"
    fi
fi

python3 init_security.py

# Verify keys are now valid
python3 check_keys.py
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to generate valid security keys!${NC}"
    cd ..
    exit 1
fi

# Run migrations silently
python3 migrate_add_password.py > /dev/null 2>&1 || true
python3 migrate_add_recovery_codes.py > /dev/null 2>&1 || true
python3 migrate_add_2fa.py > /dev/null 2>&1 || true
python3 migrate_scheduled_commands_full.py > /dev/null 2>&1 || true
python3 migrate_add_timezone.py > /dev/null 2>&1 || true
python3 migrate_add_scheduler_settings.py > /dev/null 2>&1 || true
python3 migrate_add_display_time.py > /dev/null 2>&1 || true
python3 migrate_add_udp_listener.py > /dev/null 2>&1 || true

echo -e "${GREEN}[OK] Backend ready${NC}"

cd ..

echo ""
echo -e "${CYAN}[4/4] Setting up Frontend...${NC}"
cd frontend

echo "Cleaning old cache..."
rm -rf dist node_modules/.vite .vite 2> /dev/null || true
echo -e "${GREEN}[OK] Cache cleaned${NC}"

echo "Installing packages..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to install frontend packages${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Frontend ready${NC}"

cd ..

echo ""
echo "============================================================"
echo "            Setup Complete - Ready to Start"
echo "============================================================"
echo ""
echo "Application configured but NOT started yet"
echo ""
echo "Next steps:"
echo "   1. Start application: ./local-start.sh"
echo "   2. Open browser: http://localhost:3000"
echo "   3. Register your account"
echo ""
echo "Note: local-start.sh will start Backend, Scheduler, and Frontend"
echo "      Use Ctrl+C to stop, or run ./kill-all-processes.sh"
echo ""

