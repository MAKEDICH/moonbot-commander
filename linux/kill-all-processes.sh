#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - Kill All Processes"
echo "============================================================"
echo ""
echo "This will forcefully terminate ALL MoonBot processes:"
echo "   - Python (Backend + Scheduler)"
echo "   - Node.js (Frontend + dev servers)"
echo "   - Systemd Services (if running)"
echo ""
echo -e "${RED}WARNING: This will kill ALL Python and Node.js processes!${NC}"
echo "         Even if they are not related to MoonBot!"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "============================================================"
echo "                 AGGRESSIVE CLEANUP MODE"
echo "============================================================"
echo ""

# STEP 1: Stop systemd services if running as root
echo -e "${CYAN}[STEP 1/5] Stopping Systemd Services...${NC}"
echo ""

if [ "$EUID" -eq 0 ]; then
    if systemctl is-active --quiet moonbot-backend.service; then
        echo "Stopping moonbot-backend..."
        systemctl stop moonbot-backend.service
        echo "  [OK]"
    fi
    
    if systemctl is-active --quiet moonbot-scheduler.service; then
        echo "Stopping moonbot-scheduler..."
        systemctl stop moonbot-scheduler.service
        echo "  [OK]"
    fi
    
    if systemctl is-active --quiet moonbot-frontend.service; then
        echo "Stopping moonbot-frontend..."
        systemctl stop moonbot-frontend.service
        echo "  [OK]"
    fi
else
    echo -e "${YELLOW}[INFO] Not running as root, skipping systemd services${NC}"
fi

echo -e "${GREEN}[STEP 1/5] Services stopped${NC}"
echo ""

# STEP 2: Kill processes (aggressive loop)
echo -e "${CYAN}[STEP 2/5] Killing processes (aggressive mode)...${NC}"
echo ""

MAX_ATTEMPTS=5
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    
    # Kill Python processes related to uvicorn and scheduler
    pkill -9 -f "uvicorn.*main:app" 2>/dev/null && echo "  Killed uvicorn processes"
    pkill -9 -f "scheduler.py" 2>/dev/null && echo "  Killed scheduler processes"
    pkill -9 -f "python.*main" 2>/dev/null
    
    # Kill Node/NPM processes
    pkill -9 -f "vite" 2>/dev/null && echo "  Killed vite processes"
    pkill -9 -f "npm.*dev" 2>/dev/null && echo "  Killed npm dev processes"
    pkill -9 -f "node.*serve" 2>/dev/null && echo "  Killed serve processes"
    
    # Wait a bit
    sleep 2
    
    # Check if any processes remain
    PROCESSES_REMAIN=0
    
    if pgrep -f "uvicorn.*main:app" > /dev/null 2>&1; then
        PROCESSES_REMAIN=1
    fi
    
    if pgrep -f "scheduler.py" > /dev/null 2>&1; then
        PROCESSES_REMAIN=1
    fi
    
    if pgrep -f "vite" > /dev/null 2>&1; then
        PROCESSES_REMAIN=1
    fi
    
    if [ $PROCESSES_REMAIN -eq 0 ]; then
        echo -e "  ${GREEN}[OK] All processes killed after $ATTEMPT attempt(s)${NC}"
        break
    else
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo -e "  ${YELLOW}[WARNING] Max attempts reached, some processes may still be running${NC}"
        else
            echo "  Some processes still running, retrying..."
        fi
    fi
done

echo ""

# STEP 3: Force kill by port
echo -e "${CYAN}[STEP 3/5] Checking ports...${NC}"
echo ""

# Check port 8000
PORT_8000_PID=$(lsof -ti:8000 2>/dev/null)
if [ ! -z "$PORT_8000_PID" ]; then
    echo "  Port 8000 occupied by PID $PORT_8000_PID, killing..."
    kill -9 $PORT_8000_PID 2>/dev/null
fi

# Check port 3000
PORT_3000_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_3000_PID" ]; then
    echo "  Port 3000 occupied by PID $PORT_3000_PID, killing..."
    kill -9 $PORT_3000_PID 2>/dev/null
fi

echo -e "${GREEN}[STEP 3/5] Ports cleared${NC}"
echo ""

# STEP 4: Wait for TIME_WAIT to clear
echo -e "${CYAN}[STEP 4/5] Waiting for ports to fully release...${NC}"
sleep 3
echo -e "${GREEN}[STEP 4/5] Done${NC}"
echo ""

# STEP 5: Verification
echo -e "${CYAN}[STEP 5/5] Final verification...${NC}"
echo ""

ALL_CLEAN=1

# Check Python processes
if pgrep -f "uvicorn" > /dev/null 2>&1 || pgrep -f "scheduler.py" > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Python processes still running:${NC}"
    ps aux | grep -E "uvicorn|scheduler.py" | grep -v grep
    ALL_CLEAN=0
fi

# Check Node processes
if pgrep -f "vite" > /dev/null 2>&1 || pgrep -f "serve" > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Node.js processes still running:${NC}"
    ps aux | grep -E "vite|serve" | grep -v grep
    ALL_CLEAN=0
fi

# Check ports
if lsof -i:8000 > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Port 8000 still occupied:${NC}"
    lsof -i:8000
    ALL_CLEAN=0
fi

if lsof -i:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}[WARNING] Port 3000 still occupied:${NC}"
    lsof -i:3000
    ALL_CLEAN=0
fi

echo ""
echo "============================================================"
echo "                      RESULT"
echo "============================================================"
echo ""

if [ $ALL_CLEAN -eq 1 ]; then
    echo -e "${GREEN}[SUCCESS] All MoonBot processes terminated!${NC}"
    echo -e "${GREEN}[SUCCESS] Ports 3000 and 8000 are FREE!${NC}"
    echo ""
    echo "You can now safely run:"
    echo "   - ./local-start.sh"
    echo "   - sudo ./server-start.sh"
    echo "   - ./start.sh"
else
    echo -e "${YELLOW}[WARNING] Some processes or ports could not be cleared.${NC}"
    echo ""
    echo "Try these manual steps:"
    echo "   1. Run with sudo: sudo ./kill-all-processes.sh"
    echo "   2. Manually kill processes: ps aux | grep python"
    echo "   3. Reboot your system"
fi

echo ""
echo "============================================================"
echo "                      SUMMARY"
echo "============================================================"
echo ""
echo "What was done:"
echo "   - Stopped Systemd Services (if running as root)"
echo "   - Killed Python processes ($MAX_ATTEMPTS attempts)"
echo "   - Killed Node.js processes ($MAX_ATTEMPTS attempts)"
echo "   - Cleared ports 3000 and 8000"
echo "   - Waited for TIME_WAIT to clear"
echo ""

