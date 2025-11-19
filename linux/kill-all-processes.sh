#!/bin/bash
# Script to kill all MoonBot Commander processes

echo "============================================================"
echo "      Stopping MoonBot Commander Processes"
echo "============================================================"
echo

# Kill systemd services if they exist
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

# Kill Python processes
echo "Stopping Python processes..."
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "scheduler.py" 2>/dev/null || true
pkill -f "python main.py" 2>/dev/null || true

# Kill Node processes  
echo "Stopping Node.js processes..."
pkill -f "vite" 2>/dev/null || true
pkill -f "npm run" 2>/dev/null || true
pkill -f "node" 2>/dev/null || true

# Kill using PID files if they exist
if [ -f "logs/backend.pid" ]; then
    PID=$(cat logs/backend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Killing backend (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f logs/backend.pid
fi

if [ -f "logs/scheduler.pid" ]; then
    PID=$(cat logs/scheduler.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Killing scheduler (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f logs/scheduler.pid
fi

if [ -f "logs/frontend.pid" ]; then
    PID=$(cat logs/frontend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Killing frontend (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f logs/frontend.pid
fi

# Wait a moment
sleep 2

# Force kill if still running
if pgrep -f "uvicorn\|scheduler\|vite" > /dev/null; then
    echo "Force killing remaining processes..."
    pkill -9 -f "uvicorn" 2>/dev/null || true
    pkill -9 -f "scheduler" 2>/dev/null || true
    pkill -9 -f "vite" 2>/dev/null || true
fi

echo
echo "All MoonBot Commander processes have been stopped."
echo "============================================================"