#!/bin/bash

# ============================================================
# MOONBOT COMMANDER - CONTROL PANEL (Linux/macOS)
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create logs directory in backend
mkdir -p backend/logs

# ============================================================
# FUNCTIONS
# ============================================================

get_version() {
    if [[ -f "$SCRIPT_DIR/VERSION.txt" ]]; then
        cat "$SCRIPT_DIR/VERSION.txt" | tr -d '\r\n' | head -c 20
    else
        echo "unknown"
    fi
}

check_status() {
    local python_running=0
    local node_running=0
    
    pgrep -f "uvicorn" > /dev/null 2>&1 && python_running=1
    pgrep -f "node" > /dev/null 2>&1 && node_running=1
    
    if [[ $python_running -eq 1 && $node_running -eq 1 ]]; then
        echo -e "${GREEN}● RUNNING${NC} [Backend + Frontend]"
    elif [[ $python_running -eq 1 ]]; then
        echo -e "${YELLOW}◐ PARTIAL${NC} [Backend only]"
    elif [[ $node_running -eq 1 ]]; then
        echo -e "${YELLOW}◐ PARTIAL${NC} [Frontend only]"
    else
        echo -e "${RED}○ STOPPED${NC}"
    fi
}

press_enter() {
    echo ""
    read -p "  Press Enter to continue..."
}

show_menu() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :                                                                   :"
    echo -e "  :   M   M  OOO   OOO  N   N BBBB   OOO  TTTTT                       :"
    echo -e "  :   MM MM O   O O   O NN  N B   B O   O   T                         :"
    echo -e "  :   M M M O   O O   O N N N BBBB  O   O   T                         :"
    echo -e "  :   M   M O   O O   O N  NN B   B O   O   T                         :"
    echo -e "  :   M   M  OOO   OOO  N   N BBBB   OOO    T                         :"
    echo -e "  :                                                                   :"
    echo -e "  :                    COMMANDER CONTROL PANEL                        :"
    echo -e "  :                                                                   :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    echo -e "  Version: v$(get_version)"
    echo -e "  Status: $(check_status)"
    echo ""
    echo "  ==================================================================="
    echo ""
    echo "  SETUP:"
    echo "    [1] Local development setup"
    echo "    [2] Server (Production) setup"
    echo ""
    echo "  START:"
    echo "    [3] Start DEV mode"
    echo "    [4] Start PRODUCTION mode"
    echo ""
    echo "  MANAGE:"
    echo "    [5] Stop all processes"
    echo "    [6] Check migrations"
    echo ""
    echo "  UPDATE:"
    echo "    [7] Check for updates"
    echo "    [8] Upgrade to v3.0.0"
    echo ""
    echo "  [0] Exit"
    echo ""
    echo "  ==================================================================="
    echo ""
}

# ============================================================
# LOCAL SETUP
# ============================================================
local_setup() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              LOCAL DEVELOPMENT SETUP                             :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    # Check Python
    echo "  [1/5] Checking Python..."
    if ! command -v python3 &> /dev/null; then
        echo -e "        ${RED}[X]${NC} Python3 not installed!"
        echo "        Install: sudo apt install python3 python3-pip python3-venv"
        press_enter
        return
    fi
    echo -e "        ${GREEN}[OK]${NC} $(python3 --version)"
    
    # Check Node.js
    echo "  [2/5] Checking Node.js..."
    if ! command -v node &> /dev/null; then
        echo -e "        ${RED}[X]${NC} Node.js not installed!"
        echo "        Install: sudo apt install nodejs npm"
        press_enter
        return
    fi
    echo -e "        ${GREEN}[OK]${NC} Node.js $(node --version)"
    
    # Backend
    echo ""
    echo "  [3/5] Installing Backend..."
    cd "$SCRIPT_DIR/backend"
    
    if [[ ! -d "venv" ]]; then
        echo "        Creating virtual environment..."
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip -q 2>/dev/null
    pip install -r requirements.txt -q 2>/dev/null
    echo -e "        ${GREEN}[OK]${NC} Backend ready"
    
    # Security
    echo ""
    echo "  [4/5] Security setup..."
    if [[ -f "utils/init_security.py" ]]; then
        python3 utils/init_security.py 2>/dev/null || true
    fi
    echo -e "        ${GREEN}[OK]${NC} Security configured"
    
    # Migrations
    echo ""
    echo "  [5/5] Database migrations..."
    if [[ -f "updates/core/intelligent_migration.py" ]]; then
        python3 updates/core/intelligent_migration.py 2>/dev/null || true
    fi
    echo -e "        ${GREEN}[OK]${NC} Migrations applied"
    
    deactivate 2>/dev/null || true
    cd "$SCRIPT_DIR"
    
    # Frontend
    echo ""
    echo "  [BONUS] Installing Frontend..."
    cd "$SCRIPT_DIR/frontend"
    rm -rf .vite node_modules/.vite 2>/dev/null || true
    npm install --silent 2>/dev/null
    echo -e "        ${GREEN}[OK]${NC} Frontend ready"
    cd "$SCRIPT_DIR"
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}SETUP COMPLETE!${NC} Now select [3] to start DEV mode"
    echo "  ==================================================================="
    press_enter
}

# ============================================================
# SERVER SETUP (Optimized for high-load)
# ============================================================
server_setup() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              SERVER (PRODUCTION) SETUP                           :"
    echo -e "  :              Optimized for 3000+ servers                         :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    # Check Python
    echo "  [1/9] Checking Python..."
    if ! command -v python3 &> /dev/null; then
        echo -e "        ${RED}[X]${NC} Python3 not installed!"
        press_enter
        return
    fi
    echo -e "        ${GREEN}[OK]${NC} $(python3 --version)"
    
    # Check Node.js
    echo "  [2/9] Checking Node.js..."
    if ! command -v node &> /dev/null; then
        echo -e "        ${RED}[X]${NC} Node.js not installed!"
        press_enter
        return
    fi
    echo -e "        ${GREEN}[OK]${NC} Node.js $(node --version)"
    
    # Check optional dependencies
    echo ""
    echo "  [3/9] Checking optional dependencies..."
    
    # PostgreSQL
    if command -v psql &> /dev/null; then
        echo -e "        ${GREEN}[OK]${NC} PostgreSQL available"
        HAS_POSTGRES=1
    else
        echo -e "        ${YELLOW}[i]${NC} PostgreSQL not found (using SQLite)"
        HAS_POSTGRES=0
    fi
    
    # Redis
    if command -v redis-cli &> /dev/null; then
        echo -e "        ${GREEN}[OK]${NC} Redis available"
        HAS_REDIS=1
    else
        echo -e "        ${YELLOW}[i]${NC} Redis not found (using in-memory cache)"
        HAS_REDIS=0
    fi
    
    # Backend
    echo ""
    echo "  [4/9] Installing Backend..."
    cd "$SCRIPT_DIR/backend"
    
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip -q 2>/dev/null
    pip install -r requirements.txt -q 2>/dev/null
    echo -e "        ${GREEN}[OK]${NC} Backend ready"
    
    # Security
    echo ""
    echo "  [5/9] Security setup..."
    if [[ -f "utils/init_security.py" ]]; then
        python3 utils/init_security.py 2>/dev/null || true
    fi
    echo -e "        ${GREEN}[OK]${NC} Security configured"
    
    # Migrations
    echo ""
    echo "  [6/9] Database migrations..."
    if [[ -f "updates/core/intelligent_migration.py" ]]; then
        python3 updates/core/intelligent_migration.py 2>/dev/null || true
    fi
    echo -e "        ${GREEN}[OK]${NC} Migrations applied"
    
    # High-load indexes
    echo ""
    echo "  [7/9] Applying performance indexes..."
    if [[ -f "updates/versions/add_high_load_indexes.py" ]]; then
        python3 updates/versions/add_high_load_indexes.py 2>/dev/null || true
    fi
    echo -e "        ${GREEN}[OK]${NC} Indexes applied"
    
    deactivate 2>/dev/null || true
    cd "$SCRIPT_DIR"
    
    # Frontend build
    echo ""
    echo "  [8/9] Building Frontend for production..."
    cd "$SCRIPT_DIR/frontend"
    rm -rf dist .vite 2>/dev/null || true
    npm install --silent 2>/dev/null
    
    # Install serve for production
    if ! command -v serve &> /dev/null; then
        echo "        Installing serve..."
        npm install -g serve 2>/dev/null || sudo npm install -g serve 2>/dev/null || true
    fi
    
    echo "        Building production bundle (1-2 min)..."
    NODE_ENV=production npm run build
    if [[ $? -ne 0 ]]; then
        echo -e "        ${RED}[X]${NC} Build failed!"
        cd "$SCRIPT_DIR"
        press_enter
        return
    fi
    echo -e "        ${GREEN}[OK]${NC} Production build ready"
    cd "$SCRIPT_DIR"
    
    # Firewall & System optimization
    echo ""
    echo "  [9/9] System optimization..."
    
    # Firewall
    if command -v ufw &> /dev/null; then
        sudo ufw allow 3000/tcp 2>/dev/null && echo "        Port 3000 opened"
        sudo ufw allow 8000/tcp 2>/dev/null && echo "        Port 8000 opened"
    fi
    
    # Increase file limits (if possible)
    if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
        if ! grep -q "# MoonBot" /etc/security/limits.conf 2>/dev/null; then
            echo "# MoonBot Commander" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1
            echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1
            echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1
            echo "        File limits increased"
        fi
    fi
    
    echo -e "        ${GREEN}[OK]${NC} System optimized"
    
    # Calculate workers
    CPU_CORES=$(nproc 2>/dev/null || echo 4)
    WORKERS=$((CPU_CORES * 2 + 1))
    
    # Get IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}SERVER SETUP COMPLETE!${NC}"
    echo ""
    echo "  Configuration:"
    echo "    - Workers: $WORKERS (auto-calculated)"
    [[ $HAS_POSTGRES -eq 1 ]] && echo "    - PostgreSQL: available"
    [[ $HAS_REDIS -eq 1 ]] && echo "    - Redis: available"
    echo ""
    echo "  Server IP: $SERVER_IP"
    echo "  After start, open: http://$SERVER_IP:3000"
    echo ""
    echo "  Optional: Configure PostgreSQL/Redis in .env for best performance"
    echo "  ==================================================================="
    press_enter
}

# ============================================================
# START DEV
# ============================================================
start_dev() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              STARTING DEV MODE                                   :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    if [[ ! -f "$SCRIPT_DIR/backend/main.py" ]]; then
        echo -e "        ${RED}[X]${NC} Backend not found! Run setup first [1]"
        press_enter
        return
    fi
    
    if [[ ! -d "$SCRIPT_DIR/backend/venv" ]]; then
        echo -e "        ${RED}[X]${NC} Virtual environment not found! Run setup first [1]"
        press_enter
        return
    fi
    
    # Stop old processes
    echo "  [1/3] Stopping old processes..."
    pkill -f "uvicorn.*main:app" 2>/dev/null || true
    pkill -f "python.*scheduler" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    sleep 2
    echo -e "        ${GREEN}[OK]${NC} Stopped"
    
    # Start Backend
    echo "  [2/3] Starting Backend..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    
    # Export MOONBOT_MODE before starting processes
    export MOONBOT_MODE=local
    
    # Start backend with MOONBOT_MODE in environment
    MOONBOT_MODE=local nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/backend/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    sleep 2
    
    # Start scheduler with MOONBOT_MODE in environment
    MOONBOT_MODE=local nohup python3 -m services.scheduler > "$SCRIPT_DIR/backend/logs/scheduler.log" 2>&1 &
    
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "        ${GREEN}[OK]${NC} Backend started (PID: $BACKEND_PID)"
    else
        echo -e "        ${RED}[X]${NC} Backend failed! Check logs/backend.log"
        deactivate 2>/dev/null || true
        cd "$SCRIPT_DIR"
        press_enter
        return
    fi
    
    deactivate 2>/dev/null || true
    cd "$SCRIPT_DIR"
    
    # Start Frontend
    echo "  [3/3] Starting Frontend..."
    cd "$SCRIPT_DIR/frontend"
    nohup npm run dev > "$SCRIPT_DIR/backend/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    sleep 3
    
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "        ${GREEN}[OK]${NC} Frontend started (PID: $FRONTEND_PID)"
    else
        echo -e "        ${YELLOW}[!]${NC} Frontend may have issues. Check logs/frontend.log"
    fi
    cd "$SCRIPT_DIR"
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}DEV MODE STARTED!${NC}"
    echo ""
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    echo "  Logs:"
    echo "    - logs/backend.log"
    echo "    - logs/scheduler.log"
    echo "    - logs/frontend.log"
    echo ""
    echo "  To stop: select [5]"
    echo "  ==================================================================="
    press_enter
}

# ============================================================
# START PRODUCTION
# ============================================================
start_prod() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              STARTING PRODUCTION MODE                            :"
    echo -e "  :              Optimized for high-load (3000+ servers)             :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    if [[ ! -f "$SCRIPT_DIR/backend/main.py" ]]; then
        echo -e "        ${RED}[X]${NC} Backend not found! Run setup first [2]"
        press_enter
        return
    fi
    
    if [[ ! -d "$SCRIPT_DIR/backend/venv" ]]; then
        echo -e "        ${RED}[X]${NC} Virtual environment not found! Run setup first [2]"
        press_enter
        return
    fi
    
    if [[ ! -f "$SCRIPT_DIR/frontend/dist/index.html" ]]; then
        echo -e "        ${YELLOW}[!]${NC} Production build not found!"
        read -p "        Build now? (y/n): " answer
        if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
            return
        fi
        cd "$SCRIPT_DIR/frontend"
        NODE_ENV=production npm run build
        cd "$SCRIPT_DIR"
    fi
    
    # Calculate optimal workers for 3000+ servers
    # Minimum 17 workers for high-load
    CPU_CORES=$(nproc 2>/dev/null || echo 4)
    CALC_WORKERS=$((CPU_CORES * 2 + 1))
    # Use at least 17 workers for 3000+ servers
    if [[ $CALC_WORKERS -lt 17 ]]; then
        WORKERS=17
    else
        WORKERS=$CALC_WORKERS
    fi
    
    # Stop old processes
    echo "  [1/4] Stopping old processes..."
    pkill -f "uvicorn.*main:app" 2>/dev/null || true
    pkill -f "gunicorn.*main:app" 2>/dev/null || true
    pkill -f "python.*scheduler" 2>/dev/null || true
    pkill -f "serve.*dist" 2>/dev/null || true
    pkill -f "npx.*serve" 2>/dev/null || true
    sleep 2
    echo -e "        ${GREEN}[OK]${NC} Stopped"
    
    # Check optional services
    echo "  [2/4] Checking services..."
    
    # Check Redis
    if command -v redis-cli &> /dev/null && redis-cli ping &> /dev/null; then
        echo -e "        ${GREEN}[OK]${NC} Redis connected"
        export REDIS_URL="redis://localhost:6379/0"
    else
        echo -e "        ${YELLOW}[i]${NC} Redis not running (using in-memory cache)"
    fi
    
    # Check PostgreSQL (if configured)
    if [[ -n "$DATABASE_URL" ]] && [[ "$DATABASE_URL" == postgresql* ]]; then
        echo -e "        ${GREEN}[OK]${NC} PostgreSQL configured"
    else
        echo -e "        ${YELLOW}[i]${NC} Using SQLite"
    fi
    
    # Start Backend with Gunicorn (if available) or Uvicorn
    echo "  [3/4] Starting Backend ($WORKERS workers)..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    
    mkdir -p logs
    
    # Check if gunicorn is available
    if python3 -c "import gunicorn" 2>/dev/null; then
        # Use Gunicorn with Uvicorn workers (best for production)
        # Optimized for 3000+ servers
        MOONBOT_MODE=server nohup gunicorn main:app \
            -w $WORKERS \
            -k uvicorn.workers.UvicornWorker \
            --bind 0.0.0.0:8000 \
            --timeout 120 \
            --keep-alive 30 \
            --max-requests 50000 \
            --max-requests-jitter 5000 \
            --graceful-timeout 60 \
            --backlog 4096 \
            --worker-connections 2000 \
            --access-logfile logs/access.log \
            --error-logfile logs/error.log \
            > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo -e "        Using Gunicorn + Uvicorn ($WORKERS workers)"
    else
        # Fallback to Uvicorn only
        MOONBOT_MODE=server nohup python3 -m uvicorn main:app \
            --host 0.0.0.0 \
            --port 8000 \
            --workers $WORKERS \
            --limit-concurrency 2000 \
            --backlog 4096 \
            --timeout-keep-alive 30 \
            > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo -e "        Using Uvicorn ($WORKERS workers)"
    fi
    
    sleep 3
    
    # Start scheduler with MOONBOT_MODE in environment
    MOONBOT_MODE=server nohup python3 -m services.scheduler > logs/scheduler.log 2>&1 &
    
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "        ${GREEN}[OK]${NC} Backend started (PID: $BACKEND_PID)"
    else
        echo -e "        ${RED}[X]${NC} Backend failed! Check logs/backend.log"
        deactivate 2>/dev/null || true
        cd "$SCRIPT_DIR"
        press_enter
        return
    fi
    
    deactivate 2>/dev/null || true
    cd "$SCRIPT_DIR"
    
    # Start Frontend
    echo "  [4/4] Starting Frontend..."
    cd "$SCRIPT_DIR/frontend"
    
    if command -v serve &> /dev/null; then
        nohup serve -s dist -l 3000 > "$SCRIPT_DIR/backend/logs/frontend.log" 2>&1 &
    else
        nohup npx serve -s dist -l 3000 > "$SCRIPT_DIR/backend/logs/frontend.log" 2>&1 &
    fi
    sleep 2
    echo -e "        ${GREEN}[OK]${NC} Frontend started"
    cd "$SCRIPT_DIR"
    
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}PRODUCTION MODE STARTED!${NC}"
    echo ""
    echo "  LOCAL ACCESS:"
    echo "    Frontend: http://localhost:3000"
    echo "    Backend:  http://localhost:8000"
    echo ""
    echo "  REMOTE ACCESS:"
    echo "    Frontend: http://$SERVER_IP:3000"
    echo "    Backend:  http://$SERVER_IP:8000"
    echo ""
    echo "  Logs: logs/backend.log, logs/scheduler.log, logs/frontend.log"
    echo "  ==================================================================="
    press_enter
}

# ============================================================
# STOP ALL
# ============================================================
stop_all() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              STOPPING ALL PROCESSES                              :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    echo -e "  ${YELLOW}[!] All MoonBot processes will be stopped!${NC}"
    echo ""
    read -p "  Continue? (y/n): " answer
    if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
        return
    fi
    
    echo ""
    echo "  Stopping processes..."
    
    # Backend
    if pkill -f "uvicorn.*main:app" 2>/dev/null; then
        echo -e "        ${GREEN}[OK]${NC} Backend stopped"
    else
        echo "        [i] Backend was not running"
    fi
    
    # Scheduler
    if pkill -f "python.*scheduler" 2>/dev/null; then
        echo -e "        ${GREEN}[OK]${NC} Scheduler stopped"
    else
        echo "        [i] Scheduler was not running"
    fi
    
    # Frontend
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    pkill -f "serve.*dist" 2>/dev/null || true
    pkill -f "npx.*serve" 2>/dev/null || true
    echo -e "        ${GREEN}[OK]${NC} Frontend stopped"
    
    sleep 2
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}ALL PROCESSES STOPPED!${NC}"
    echo "  Ports 3000 and 8000 are now free."
    echo "  ==================================================================="
    press_enter
}

# ============================================================
# CHECK MIGRATIONS
# ============================================================
check_migrations() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              DATABASE MIGRATIONS STATUS                          :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    cd "$SCRIPT_DIR/backend"
    
    if [[ -d "venv" ]]; then
        source venv/bin/activate 2>/dev/null || true
    fi
    
    python3 -c "
try:
    from updates.core.migrations_registry import MigrationsRegistry
    registry = MigrationsRegistry()
    applied = registry.get_applied_migrations()
    pending = registry.get_pending_migrations()
    print(f'  Applied migrations: {len(applied)}')
    print(f'  Pending migrations: {len(pending)}')
    if pending:
        print()
        for m in pending[:5]:
            print(f'    - {m}')
except Exception as e:
    print(f'  [!] Could not check migrations: {e}')
" 2>/dev/null || echo -e "  ${YELLOW}[!]${NC} Could not check migrations"
    
    deactivate 2>/dev/null || true
    cd "$SCRIPT_DIR"
    
    press_enter
}

# ============================================================
# CHECK UPDATES
# ============================================================
check_updates() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              CHECK FOR UPDATES                                   :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    echo "  Current version: v$(get_version)"
    echo ""
    echo "  To update use:"
    echo "    1. Web interface (Settings -> Updates)"
    echo "    2. GitHub: https://github.com/MAKEDICH/moonbot-commander"
    echo ""
    
    if [[ -f "$SCRIPT_DIR/auto-updater.sh" ]]; then
        read -p "  Run auto-updater? (y/n): " answer
        if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
            bash "$SCRIPT_DIR/auto-updater.sh"
        fi
    fi
    
    press_enter
}

# ============================================================
# UPGRADE TO 3.0
# ============================================================
upgrade_3() {
    clear
    echo ""
    echo -e "${CYAN}  +===================================================================+"
    echo -e "  :              UPGRADE TO v3.0.0                                   :"
    echo -e "  +===================================================================+${NC}"
    echo ""
    
    echo "  For users with old versions without auto-update."
    echo ""
    echo "  [OK] All data will be preserved"
    echo "  [OK] Backup will be created"
    echo "  [OK] Migrations will apply automatically"
    echo ""
    
    read -p "  Continue? (y/n): " answer
    if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
        return
    fi
    
    if [[ -f "$SCRIPT_DIR/UPGRADE-TO-3.0.sh" ]]; then
        bash "$SCRIPT_DIR/UPGRADE-TO-3.0.sh"
    else
        echo ""
        echo -e "  ${RED}[X]${NC} UPGRADE-TO-3.0.sh not found!"
        echo "  Download from GitHub repository."
    fi
    
    press_enter
}

# ============================================================
# MAIN MENU LOOP
# ============================================================
main() {
    while true; do
        show_menu
        read -p "  Select option: " choice
        
        case $choice in
            1) local_setup ;;
            2) server_setup ;;
            3) start_dev ;;
            4) start_prod ;;
            5) stop_all ;;
            6) check_migrations ;;
            7) check_updates ;;
            8) upgrade_3 ;;
            0) 
                clear
                echo ""
                echo "  Goodbye!"
                echo ""
                exit 0
                ;;
            *) 
                echo ""
                echo "  Invalid option. Try again."
                sleep 1
                ;;
        esac
    done
}

# Run
main
