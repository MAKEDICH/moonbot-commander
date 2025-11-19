#!/bin/bash
# MoonBot Commander - Server Start Script with Auto-Migrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo
echo "============================================================"
echo "      MoonBot Commander - SERVER MODE (Linux)"
echo "============================================================"
echo
echo "  * Fixed UDP ports (2500)"
echo "  * Keep-alive DISABLED"
echo "  * Optimized for VPS/dedicated servers"
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

# Check directory structure
if [ ! -d "backend" ]; then
    echo -e "${RED}[ERROR] backend directory not found!${NC}"
    echo "Please run from MoonBot Commander root directory"
    exit 1
fi

if [ ! -d "frontend" ]; then
    echo -e "${RED}[ERROR] frontend directory not found!${NC}"
    echo "Please run from MoonBot Commander root directory"
    exit 1
fi

echo
echo "[0/5] Applying automatic migrations..."
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
echo "[1/5] Detecting application version..."
echo

VERSION="unknown"
if [ -f "VERSION.txt" ]; then
    VERSION=$(cat VERSION.txt | tr -d '\r\n')
    echo "Version from VERSION.txt: $VERSION"
elif [ -f "backend/VERSION.txt" ]; then
    VERSION=$(cat backend/VERSION.txt | tr -d '\r\n')
    echo "Version from backend/VERSION.txt: $VERSION"
else
    echo "Version file not found, using 'unknown'"
fi

# Stop old processes
echo
echo "[2/5] Stopping old processes..."
echo

# Kill Python processes (backend & scheduler)
if pgrep -f "uvicorn main:app" > /dev/null; then
    echo "Stopping old backend..."
    pkill -f "uvicorn main:app" || true
    sleep 2
fi

if pgrep -f "scheduler.py" > /dev/null; then
    echo "Stopping old scheduler..."
    pkill -f "scheduler.py" || true
    sleep 1
fi

# Kill Node processes (frontend)
if pgrep -f "vite" > /dev/null; then
    echo "Stopping old frontend..."
    pkill -f "vite" || true
    sleep 2
fi

echo "[OK] Cleanup complete"

# Install dependencies if needed
echo
echo "[3/5] Checking dependencies..."
echo

cd backend
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    $PYTHON_CMD -m pip install -r requirements.txt --quiet
fi
cd ..

cd frontend
if [ -f "package.json" ] && ! [ -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
elif [ -f "package.json" ]; then
    echo "Node modules already installed"
fi
cd ..

# Start Backend
echo
echo "[4/5] Starting Backend..."
echo

cd backend
export MOONBOT_MODE="server"
nohup $PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
cd ..

# Wait for backend to start
sleep 3

# Start Scheduler
echo "[5/5] Starting Scheduler..."
cd backend
nohup $PYTHON_CMD scheduler.py > ../logs/scheduler.log 2>&1 &
SCHEDULER_PID=$!
echo "Scheduler started (PID: $SCHEDULER_PID)"
cd ..

# Start Frontend
echo "Starting Frontend..."
cd frontend

# Build if needed
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "Building frontend..."
    npm run build
fi

# Start preview server
nohup npm run preview -- --host 0.0.0.0 --port 3000 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
cd ..

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="localhost"
fi

echo
echo "============================================================"
echo "   MoonBot Commander Started Successfully!"
echo "============================================================"
echo
echo "LOCAL ACCESS (from this server):"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo
echo "REMOTE ACCESS (from any device):"
echo "  Frontend: http://$SERVER_IP:3000"
echo "  Backend:  http://$SERVER_IP:8000"
echo "  API Docs: http://$SERVER_IP:8000/docs"
echo
echo "============================================================"
echo
echo "Process IDs:"
echo "  Backend:   $BACKEND_PID"
echo "  Scheduler: $SCHEDULER_PID"
echo "  Frontend:  $FRONTEND_PID"
echo
echo "Logs location:"
echo "  Backend:   logs/backend.log"
echo "  Scheduler: logs/scheduler.log"
echo "  Frontend:  logs/frontend.log"
echo
echo "To stop all: kill $BACKEND_PID $SCHEDULER_PID $FRONTEND_PID"
echo "Or use: pkill -f uvicorn && pkill -f scheduler && pkill -f vite"
echo
echo "============================================================"
