#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - Local Start (Linux)"
echo "============================================================"
echo ""

# Check if setup was executed
if [ ! -f "backend/main.py" ]; then
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
        echo "Please run ./local-setup.sh manually"
        cd ..
        exit 1
    fi
    
    echo -e "${GREEN}[OK] Security keys regenerated successfully${NC}"
    echo -e "${YELLOW}[INFO] You will need to register a new user (old database was incompatible)${NC}"
    echo ""
    echo -e "${GREEN}[OK] Security fixed! Continuing startup...${NC}"
    echo ""
fi
cd ..

if [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}[ERROR] Frontend not found!${NC}"
    echo ""
    echo "Please run ./local-setup.sh first"
    echo ""
    exit 1
fi

echo ""
echo -e "${CYAN}[0/3] Cleaning up old processes...${NC}"
echo ""

# Kill old processes
pkill -f "uvicorn main:app" 2> /dev/null && echo "  [OK] Old backend stopped" || echo "  [INFO] No old backend"
pkill -f "scheduler.py" 2> /dev/null && echo "  [OK] Old scheduler stopped" || echo "  [INFO] No old scheduler"
pkill -f "vite" 2> /dev/null && echo "  [OK] Old frontend stopped" || echo "  [INFO] No old frontend"

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

# Create log directory
mkdir -p logs

echo -e "${CYAN}[1/3] Starting Backend...${NC}"
cd "$PROJECT_DIR/backend"
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 3

echo -e "${CYAN}[2/3] Starting Scheduler...${NC}"
nohup python3 scheduler.py > "$PROJECT_DIR/logs/scheduler.log" 2>&1 &
SCHEDULER_PID=$!
echo "Scheduler PID: $SCHEDULER_PID"
sleep 2

echo -e "${CYAN}[3/3] Starting Frontend...${NC}"
cd "$PROJECT_DIR/frontend"
nohup npm run dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 5

echo ""
echo "============================================================"
echo "            Application Started"
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
echo "Logs location: $PROJECT_DIR/logs/"
echo ""
echo "To stop: ./kill-all-processes.sh"
echo "To view logs: tail -f logs/backend.log"
echo ""

