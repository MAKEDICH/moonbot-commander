#!/bin/bash
# MoonBot Commander - Production Server Start Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo
echo "============================================================"
echo "      MoonBot Commander - PRODUCTION MODE (Linux)"
echo "============================================================"
echo
echo "  * Production build (minified)"
echo "  * Fixed UDP ports (2500)"
echo "  * Keep-alive DISABLED"
echo "  * Optimized for performance"
echo "  * Automatic migrations"
echo
echo "============================================================"
echo

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}[ERROR] Python not found!${NC}"
    echo "Please install Python 3.8+"
    exit 1
fi

# Determine Python command
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "Using Python: $PYTHON_CMD"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm not found!${NC}"
    echo "Please install Node.js and npm"
    exit 1
fi

# Check directory structure
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}[ERROR] Invalid directory structure!${NC}"
    echo "Please run from MoonBot Commander root directory"
    exit 1
fi

# Create logs directory if not exists
mkdir -p logs

echo
echo "[0/6] Applying automatic migrations..."
echo

# Apply migrations to backend DB
cd backend
if [ -f "moonbot_commander.db" ]; then
    echo "Checking backend database..."
    if [ -f "startup_migrations.py" ]; then
        $PYTHON_CMD startup_migrations.py 2>/dev/null || {
            echo "[WARNING] startup_migrations.py failed, trying direct migration..."
            $PYTHON_CMD -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); c=conn.cursor(); c.execute('PRAGMA table_info(servers)'); cols=[col[1] for col in c.fetchall()]; missing=[]; 'is_localhost' not in cols and missing.append('is_localhost'); 'default_currency' not in cols and missing.append('default_currency'); [c.execute(f'ALTER TABLE servers ADD COLUMN {col} {\"BOOLEAN DEFAULT FALSE\" if col==\"is_localhost\" else \"TEXT\"}') for col in missing]; conn.commit(); conn.close(); print(f'[OK] Applied {len(missing)} migrations') if missing else print('[OK] No migrations needed')" 2>/dev/null
        }
    else
        $PYTHON_CMD -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); c=conn.cursor(); c.execute('PRAGMA table_info(servers)'); cols=[col[1] for col in c.fetchall()]; missing=[]; 'is_localhost' not in cols and missing.append('is_localhost'); 'default_currency' not in cols and missing.append('default_currency'); [c.execute(f'ALTER TABLE servers ADD COLUMN {col} {\"BOOLEAN DEFAULT FALSE\" if col==\"is_localhost\" else \"TEXT\"}') for col in missing]; conn.commit(); conn.close(); print(f'[OK] Applied {len(missing)} migrations') if missing else print('[OK] No migrations needed')" 2>/dev/null
    fi
fi

# Apply migrations to root DB if exists
cd ..
if [ -f "moonbot_commander.db" ]; then
    echo "Checking root database..."
    $PYTHON_CMD -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); c=conn.cursor(); c.execute('PRAGMA table_info(servers)'); cols=[col[1] for col in c.fetchall()]; missing=[]; 'is_localhost' not in cols and missing.append('is_localhost'); 'default_currency' not in cols and missing.append('default_currency'); [c.execute(f'ALTER TABLE servers ADD COLUMN {col} {\"BOOLEAN DEFAULT FALSE\" if col==\"is_localhost\" else \"TEXT\"}') for col in missing]; conn.commit(); conn.close(); print(f'[OK] Applied {len(missing)} migrations') if missing else print('[OK] No migrations needed')" 2>/dev/null
fi

# Detect version
echo
echo "[1/6] Detecting application version..."
echo

VERSION="unknown"
if [ -f "VERSION.txt" ]; then
    VERSION=$(cat VERSION.txt | tr -d '\r\n')
    echo "Version: $VERSION"
fi

# Stop old processes
echo
echo "[2/6] Stopping old processes..."
echo

# Stop systemd services if they exist
if systemctl is-active --quiet moonbot-backend 2>/dev/null; then
    echo "Stopping moonbot-backend service..."
    sudo systemctl stop moonbot-backend
fi

if systemctl is-active --quiet moonbot-scheduler 2>/dev/null; then
    echo "Stopping moonbot-scheduler service..."
    sudo systemctl stop moonbot-scheduler
fi

if systemctl is-active --quiet moonbot-frontend 2>/dev/null; then
    echo "Stopping moonbot-frontend service..."
    sudo systemctl stop moonbot-frontend
fi

# Kill any remaining processes
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "scheduler.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "preview" 2>/dev/null || true

sleep 2
echo "[OK] Cleanup complete"

# Clean frontend cache
echo
echo "[3/6] Cleaning frontend cache..."
echo

cd frontend
rm -rf .vite node_modules/.vite 2>/dev/null || true
cd ..
echo "[OK] Cache cleaned"

# Build production bundle
echo
echo "[4/6] Building production bundle..."
echo "This will take 30-60 seconds..."
echo

cd frontend

# Check if we need to build
NEED_BUILD=1
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "Production build already exists."
    read -p "Rebuild? (y/N): " -n 1 -r -t 5 || true
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        NEED_BUILD=0
    fi
fi

if [ $NEED_BUILD -eq 1 ]; then
    echo "Running: npm run build"
    npm run build || {
        echo -e "${RED}[ERROR] Build failed!${NC}"
        cd ..
        exit 1
    }
fi

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}[ERROR] Production build not found!${NC}"
    cd ..
    exit 1
fi

echo "[OK] Production build ready"
cd ..

# Start Backend
echo
echo "[5/6] Starting Backend..."
echo

cd backend
export MOONBOT_MODE="server"
nohup $PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
cd ..

sleep 3

# Start Frontend and Scheduler
echo
echo "[6/6] Starting Frontend and Scheduler..."
echo

# Start Scheduler
cd backend
nohup $PYTHON_CMD scheduler.py > ../logs/scheduler.log 2>&1 &
SCHEDULER_PID=$!
echo "Scheduler started (PID: $SCHEDULER_PID)"
cd ..

# Start Frontend Preview Server
cd frontend
nohup npm run preview -- --host 0.0.0.0 --port 3000 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
cd ..

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
fi

echo
echo "============================================================"
echo "   Application Started in PRODUCTION MODE"
echo "============================================================"
echo
echo -e "${GREEN}LOCAL ACCESS (from this server):${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo
echo -e "${GREEN}REMOTE ACCESS (from any device):${NC}"
echo "  Frontend: http://$SERVER_IP:3000"
echo "  Backend:  http://$SERVER_IP:8000"
echo "  API Docs: http://$SERVER_IP:8000/docs"
echo
echo "============================================================"
echo
echo "Mode: PRODUCTION"
echo "Version: $VERSION"
echo
echo "Performance:"
echo "  * Production build (minified + optimized)"
echo "  * Bundle size: ~2 MB (vs 30+ MB in dev)"
echo "  * Page load: ~1 second (vs 5-10 sec)"
echo "  * Fixed UDP ports"
echo "  * Keep-alive DISABLED"
echo
echo -e "${YELLOW}Process IDs:${NC}"
echo "  Backend:   $BACKEND_PID"
echo "  Scheduler: $SCHEDULER_PID"
echo "  Frontend:  $FRONTEND_PID"
echo
echo -e "${BLUE}Logs:${NC}"
echo "  tail -f logs/backend.log"
echo "  tail -f logs/scheduler.log"
echo "  tail -f logs/frontend.log"
echo
echo -e "${RED}To stop all:${NC}"
echo "  kill $BACKEND_PID $SCHEDULER_PID $FRONTEND_PID"
echo
echo "============================================================"

# Save PIDs to file for easier management
echo "$BACKEND_PID" > logs/backend.pid
echo "$SCHEDULER_PID" > logs/scheduler.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo
echo "PIDs saved to logs/*.pid files"
