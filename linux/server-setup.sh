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
    echo "Please run: sudo ./server-setup.sh"
    echo ""
    exit 1
fi

echo ""
echo "============================================================"
echo "    MoonBot Commander - Server Setup (Linux)"
echo "============================================================"
echo ""

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}[ERROR] Cannot detect Linux distribution${NC}"
    exit 1
fi

echo "Detected: $PRETTY_NAME"
echo ""

# Step 1: Install Python
echo "============================================================"
echo "  Step 1/6: Installing Python 3.11"
echo "============================================================"
echo ""

if command -v python3.11 &> /dev/null; then
    echo -e "${GREEN}[OK] Python 3.11 already installed${NC}"
else
    echo "Installing Python 3.11..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt update
        apt install -y software-properties-common
        add-apt-repository -y ppa:deadsnakes/ppa
        apt update
        apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        dnf install -y python3.11 python3.11-devel python3-pip
    else
        echo -e "${YELLOW}[WARNING] Unsupported distribution, trying default package manager...${NC}"
        apt install -y python3 python3-pip || dnf install -y python3 python3-pip || yum install -y python3 python3-pip
    fi
    
    echo -e "${GREEN}[OK] Python installed${NC}"
fi

# Make python3.11 default python3 if available
if command -v python3.11 &> /dev/null; then
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
fi

# Step 2: Install Node.js
echo ""
echo "============================================================"
echo "  Step 2/6: Installing Node.js 18 LTS"
echo "============================================================"
echo ""

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}[OK] Node.js $(node --version) already installed${NC}"
    else
        echo -e "${YELLOW}[WARNING] Node.js version is too old, upgrading...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs || dnf install -y nodejs
    fi
else
    echo "Installing Node.js 18 LTS..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        dnf install -y nodejs
    fi
    
    echo -e "${GREEN}[OK] Node.js installed${NC}"
fi

# Step 3: Install application dependencies
echo ""
echo "============================================================"
echo "  Step 3/6: Installing application dependencies"
echo "============================================================"
echo ""

# Backend
echo "Installing Backend dependencies..."
cd backend

if [ ! -f "main.py" ]; then
    echo -e "${RED}[ERROR] main.py not found in backend directory${NC}"
    cd ..
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}[ERROR] requirements.txt not found in backend directory${NC}"
    cd ..
    exit 1
fi

# Create .env if doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}[OK] Created .env file${NC}"
fi

python3 -m pip install --upgrade pip --quiet
pip3 install -r requirements.txt --quiet
echo -e "${GREEN}[OK] Backend dependencies installed${NC}"

echo ""
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

echo ""
echo "Initializing security keys..."

# Check if keys are valid
python3 check_keys.py > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[WARNING] Security keys are invalid or missing${NC}"
    echo -e "${YELLOW}[ACTION] Regenerating security keys...${NC}"
    
    # Backup old database if exists
    if [ -f "moonbot_commander.db" ]; then
        echo -e "${YELLOW}[WARNING] Found existing database with incompatible encryption keys${NC}"
        rm -f moonbot_commander.db.old
        mv moonbot_commander.db moonbot_commander.db.old
        echo -e "${GREEN}[OK] Old database backed up to moonbot_commander.db.old${NC}"
    fi
fi

python3 init_security.py
echo -e "${GREEN}[OK] Security keys initialized${NC}"

# Verify keys
python3 check_keys.py
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to generate valid security keys!${NC}"
    cd ..
    exit 1
fi

# Auto-configure CORS for server IP
echo ""
echo "Configuring CORS for server IP..."
SERVER_IP=$(hostname -I | awk '{print $1}')

if [ ! -z "$SERVER_IP" ]; then
    echo "Detected server IP: $SERVER_IP"
    
    # Check if IP already in CORS_ORIGINS
    if ! grep -q "http://$SERVER_IP:3000" .env; then
        # Add IP to CORS_ORIGINS
        sed -i "s|CORS_ORIGINS=\(.*\)|CORS_ORIGINS=\1,http://$SERVER_IP:3000|g" .env
        echo -e "${GREEN}[OK] Added $SERVER_IP to CORS_ORIGINS${NC}"
    else
        echo -e "${GREEN}[OK] $SERVER_IP already in CORS_ORIGINS${NC}"
    fi
else
    echo -e "${YELLOW}[WARNING] Could not detect server IP, CORS may need manual configuration${NC}"
fi

echo ""
echo "Running database migrations..."
python3 migrate_add_password.py > /dev/null 2>&1 || true
python3 migrate_add_recovery_codes.py > /dev/null 2>&1 || true
python3 migrate_add_2fa.py > /dev/null 2>&1 || true
python3 migrate_scheduled_commands_full.py > /dev/null 2>&1 || true
python3 migrate_add_timezone.py > /dev/null 2>&1 || true
python3 migrate_add_scheduler_settings.py > /dev/null 2>&1 || true
python3 migrate_add_display_time.py > /dev/null 2>&1 || true
python3 migrate_add_udp_listener.py > /dev/null 2>&1 || true
echo -e "${GREEN}[OK] Database ready${NC}"

cd ..
echo -e "${GREEN}[OK] Backend ready${NC}"

# Frontend
echo ""
echo "Installing Frontend dependencies (may take 2-3 minutes)..."
cd frontend

if [ ! -f "package.json" ]; then
    echo -e "${RED}[ERROR] package.json not found in frontend directory${NC}"
    cd ..
    exit 1
fi

npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to install Frontend dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Dependencies installed${NC}"

echo ""
echo "Cleaning old build cache..."
rm -rf dist node_modules/.vite .vite 2>/dev/null || true
echo -e "${GREEN}[OK] Cache cleaned${NC}"

echo ""
echo "Building Frontend for production..."
export NODE_ENV=production
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to build Frontend${NC}"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}[ERROR] Build failed - dist folder not created${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Frontend built${NC}"
cd ..

# Step 4: Configure Firewall
echo ""
echo "============================================================"
echo "  Step 4/6: Configuring Firewall"
echo "============================================================"
echo ""

echo "Allowing ports 3000 and 8000..."

# Try ufw (Ubuntu/Debian)
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
    ufw allow 8000/tcp
    echo -e "${GREEN}[OK] UFW firewall configured${NC}"
# Try firewall-cmd (CentOS/RHEL/Fedora)
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=8000/tcp
    firewall-cmd --reload
    echo -e "${GREEN}[OK] FirewallD configured${NC}"
else
    echo -e "${YELLOW}[WARNING] No firewall detected, skipping...${NC}"
fi

# Step 5: Install serve globally for production frontend
echo ""
echo "============================================================"
echo "  Step 5/6: Installing serve for production frontend"
echo "============================================================"
echo ""

npm install -g serve
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to install serve${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Serve installed${NC}"

# Step 6: Create systemd services
echo ""
echo "============================================================"
echo "  Step 6/6: Configuring systemd services"
echo "============================================================"
echo ""

PROJECT_DIR=$(pwd)
PYTHON_PATH=$(which python3)

echo "Creating systemd service files..."

# Backend Service
cat > /etc/systemd/system/moonbot-backend.service <<EOF
[Unit]
Description=MoonBot Commander Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PYTHON_PATH -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/logs/backend.log
StandardError=append:$PROJECT_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Scheduler Service
cat > /etc/systemd/system/moonbot-scheduler.service <<EOF
[Unit]
Description=MoonBot Commander Scheduler Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PYTHON_PATH scheduler.py
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/logs/scheduler.log
StandardError=append:$PROJECT_DIR/logs/scheduler-error.log

[Install]
WantedBy=multi-user.target
EOF

# Frontend Service
cat > /etc/systemd/system/moonbot-frontend.service <<EOF
[Unit]
Description=MoonBot Commander Frontend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/frontend/dist
ExecStart=$(which serve) -s . -l 3000
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/logs/frontend.log
StandardError=append:$PROJECT_DIR/logs/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Reload systemd
systemctl daemon-reload

# Enable services (but don't start yet)
systemctl enable moonbot-backend.service
systemctl enable moonbot-scheduler.service
systemctl enable moonbot-frontend.service

echo -e "${GREEN}[OK] Systemd services created and enabled${NC}"

echo ""
echo "============================================================"
echo "            [OK] SETUP COMPLETED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Checking services configuration:"
systemctl status moonbot-backend.service --no-pager | head -3
systemctl status moonbot-scheduler.service --no-pager | head -3
systemctl status moonbot-frontend.service --no-pager | head -3
echo ""
echo -e "${GREEN}[OK] All services are configured (inactive - not started yet)${NC}"
echo ""
echo "============================================================"
echo "  Setup Complete - Application is NOT started yet"
echo "============================================================"
echo ""
echo "After starting, access at:"
echo "   http://$SERVER_IP:3000"
echo ""
echo "Next steps:"
echo "   1. Start the application: sudo ./server-start.sh"
echo "   2. Open browser: http://$SERVER_IP:3000"
echo "   3. Register your account"
echo "   4. Add your MoonBot servers"
echo ""
echo "============================================================"
echo "  Systemd Services Management"
echo "============================================================"
echo ""
echo "Services are configured for auto-start on reboot"
echo ""
echo "Management commands:"
echo "   sudo systemctl start moonbot-backend    - Start Backend"
echo "   sudo systemctl stop moonbot-backend     - Stop Backend"
echo "   sudo systemctl restart moonbot-backend  - Restart Backend"
echo "   sudo systemctl status moonbot-backend   - Check status"
echo "   sudo journalctl -u moonbot-backend -f  - View logs"
echo ""
echo "Same commands for: moonbot-scheduler, moonbot-frontend"
echo ""

