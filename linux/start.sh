#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - Smart Start (Linux)"
echo "============================================================"
echo ""

# Check if setup was executed
if [ ! -f "backend/main.py" ] && [ ! -f "backend/main_v2.py" ]; then
    echo -e "${RED}[ERROR] Backend not found!${NC}"
    echo ""
    echo "Please run ./local-setup.sh first"
    echo ""
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}[ERROR] .env file not found!${NC}"
    echo ""
    echo "Please run ./local-setup.sh first to generate security keys"
    echo ""
    exit 1
fi

# Security check
cd backend
python3 check_keys.py > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}[WARNING] Security keys in .env are invalid!${NC}"
    echo -e "${YELLOW}[ACTION] Auto-fixing security keys...${NC}"
    echo ""
    
    if [ -f "moonbot_commander.db" ]; then
        echo "Backing up old database..."
        rm -f moonbot_commander.db.old
        mv moonbot_commander.db moonbot_commander.db.old
        echo -e "${GREEN}[OK] Old database backed up${NC}"
    fi
    
    rm -f .env
    python3 init_security.py
    
    python3 check_keys.py > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to generate valid security keys!${NC}"
        cd ..
        exit 1
    fi
    
    echo -e "${GREEN}[OK] Security keys regenerated${NC}"
    echo ""
fi

cd ..

# Auto-detect version
echo -e "${CYAN}[0/4] Detecting application version...${NC}"
echo ""

APP_VERSION="unknown"
MAIN_FILE="main.py"

if [ -f "backend/moonbot_commander.db" ]; then
    # Check for schema_versions table (v2.0 marker)
    python3 -c "import sqlite3; conn = sqlite3.connect('backend/moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'\"); result = cursor.fetchone(); conn.close(); exit(0 if result else 1)" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        APP_VERSION="v2.0"
        if [ -f "backend/main_v2.py" ]; then
            MAIN_FILE="main_v2.py"
            echo -e "${GREEN}[DETECTED] Version 2.0 - Using main_v2.py${NC}"
        else
            MAIN_FILE="main.py"
            echo -e "${GREEN}[DETECTED] Version 2.0 - Using main.py (migrated)${NC}"
        fi
    else
        APP_VERSION="v1.0"
        MAIN_FILE="main.py"
        echo -e "${GREEN}[DETECTED] Version 1.0 - Using main.py${NC}"
    fi
else
    # No DB yet - check which files exist
    if [ -f "backend/main_v2.py" ]; then
        APP_VERSION="v2.0"
        MAIN_FILE="main_v2.py"
        echo -e "${GREEN}[DETECTED] Version 2.0 (new install) - Using main_v2.py${NC}"
    else
        APP_VERSION="v1.0"
        MAIN_FILE="main.py"
        echo -e "${GREEN}[DETECTED] Version 1.0 (new install) - Using main.py${NC}"
    fi
fi

echo ""
echo "Application Version: $APP_VERSION"
echo "Main File: $MAIN_FILE"
echo ""

# Verify file exists
if [ ! -f "backend/$MAIN_FILE" ]; then
    echo -e "${RED}[ERROR] Main file not found: $MAIN_FILE${NC}"
    echo ""
    echo "Available files:"
    ls -1 backend/main*.py 2>/dev/null || echo "No main*.py files found"
    echo ""
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}[ERROR] Frontend not found!${NC}"
    echo ""
    echo "Please run ./local-setup.sh first"
    echo ""
    exit 1
fi

echo ""
echo -e "${CYAN}[1/4] Cleaning up old processes...${NC}"
echo ""

pkill -f "uvicorn" 2> /dev/null && echo "  [OK] Python processes stopped" || echo "  [INFO] No old Python processes"
pkill -f "scheduler.py" 2> /dev/null
pkill -f "vite" 2> /dev/null && echo "  [OK] Node.js processes stopped" || echo "  [INFO] No old Node.js processes"

sleep 2

echo "Cleaning frontend cache..."
cd frontend
rm -rf .vite 2> /dev/null || true
cd ..
echo -e "${GREEN}[OK] Cleanup complete${NC}"

echo ""
echo "Starting services in background..."
echo ""

PROJECT_DIR=$(pwd)
mkdir -p logs

# Extract module name from main file (remove .py)
MODULE_NAME="${MAIN_FILE%.py}"

echo -e "${CYAN}[2/4] Starting Backend ($APP_VERSION)...${NC}"
cd "$PROJECT_DIR/backend"
nohup python3 -m uvicorn ${MODULE_NAME}:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 3

echo -e "${CYAN}[3/4] Starting Scheduler...${NC}"
nohup python3 scheduler.py > "$PROJECT_DIR/logs/scheduler.log" 2>&1 &
SCHEDULER_PID=$!
echo "Scheduler PID: $SCHEDULER_PID"
sleep 2

echo -e "${CYAN}[4/4] Starting Frontend...${NC}"
cd "$PROJECT_DIR/frontend"
nohup npm run dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 5

echo ""
echo "============================================================"
echo "            Application Started ($APP_VERSION)"
echo "============================================================"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Process IDs:"
echo "  Backend:   $BACKEND_PID"
echo "  Scheduler: $SCHEDULER_PID"
echo "  Frontend:  $FRONTEND_PID"
echo ""
echo "To stop: ./kill-all-processes.sh"
echo ""

