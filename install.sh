#!/bin/bash

# ============================================================
# MOONBOT COMMANDER - UNIVERSAL INSTALLER FOR LINUX
# ============================================================
# This script automatically installs all dependencies and
# configures the application for your system.
#
# Supported: Ubuntu 20.04+, Debian 10+, CentOS 8+, Fedora 35+
# ============================================================

set -e

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

# ============================================================
# HELPER FUNCTIONS
# ============================================================

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. Some operations will be done without sudo."
        SUDO=""
    else
        # Check if sudo is available
        if command -v sudo &> /dev/null; then
            SUDO="sudo"
        else
            log_warning "sudo not found. Some operations may fail."
            SUDO=""
        fi
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi
    
    log_info "Detected OS: $OS $OS_VERSION"
}

detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_UPDATE="$SUDO apt-get update -qq"
        PKG_INSTALL="$SUDO apt-get install -y -qq"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_UPDATE="$SUDO dnf check-update -q || true"
        PKG_INSTALL="$SUDO dnf install -y -q"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_UPDATE="$SUDO yum check-update -q || true"
        PKG_INSTALL="$SUDO yum install -y -q"
    elif command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        PKG_UPDATE="$SUDO pacman -Sy --noconfirm"
        PKG_INSTALL="$SUDO pacman -S --noconfirm"
    else
        log_error "No supported package manager found (apt, dnf, yum, pacman)"
        exit 1
    fi
    
    log_info "Package manager: $PKG_MANAGER"
}

# ============================================================
# INSTALLATION FUNCTIONS
# ============================================================

install_python() {
    log_info "Checking Python..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        
        if [[ $PYTHON_MAJOR -ge 3 && $PYTHON_MINOR -ge 9 ]]; then
            log_success "Python $PYTHON_VERSION found"
            return 0
        fi
    fi
    
    log_info "Installing Python 3.11..."
    
    case $PKG_MANAGER in
        apt)
            # Install software-properties-common for add-apt-repository
            $PKG_INSTALL software-properties-common 2>/dev/null || true
            $SUDO add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
            $PKG_UPDATE
            $PKG_INSTALL python3.11 python3.11-venv python3.11-dev python3-pip
            # Set python3.11 as default if installed
            if command -v python3.11 &> /dev/null; then
                $SUDO update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
            fi
            ;;
        dnf|yum)
            $PKG_INSTALL python3.11 python3.11-devel python3-pip
            ;;
        pacman)
            $PKG_INSTALL python python-pip
            ;;
    esac
    
    if command -v python3 &> /dev/null; then
        log_success "Python $(python3 --version) installed"
    else
        log_error "Failed to install Python"
        exit 1
    fi
}

install_nodejs() {
    log_info "Checking Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | tr -d 'v' | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 18 ]]; then
            log_success "Node.js $(node --version) found"
            return 0
        fi
    fi
    
    log_info "Installing Node.js 20 LTS..."
    
    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
            $PKG_INSTALL nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
            $PKG_INSTALL nodejs
            ;;
        pacman)
            $PKG_INSTALL nodejs npm
            ;;
    esac
    
    if command -v node &> /dev/null; then
        log_success "Node.js $(node --version) installed"
    else
        log_error "Failed to install Node.js"
        exit 1
    fi
}

install_system_deps() {
    log_info "Installing system dependencies..."
    
    case $PKG_MANAGER in
        apt)
            $PKG_INSTALL curl wget git build-essential libffi-dev libssl-dev
            ;;
        dnf|yum)
            $PKG_INSTALL curl wget git gcc gcc-c++ make libffi-devel openssl-devel
            ;;
        pacman)
            $PKG_INSTALL curl wget git base-devel
            ;;
    esac
    
    log_success "System dependencies installed"
}

setup_backend() {
    log_info "Setting up Backend..."
    
    if [[ ! -d "$SCRIPT_DIR/backend" ]]; then
        log_error "Backend directory not found!"
        exit 1
    fi
    
    cd "$SCRIPT_DIR/backend"
    
    # Create virtual environment
    if [[ ! -d "venv" ]]; then
        log_info "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate and install dependencies
    source venv/bin/activate
    
    log_info "Installing Python packages..."
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    
    # Setup security
    if [[ -f "utils/init_security.py" ]]; then
        log_info "Initializing security..."
        python3 utils/init_security.py 2>/dev/null || true
    fi
    
    # Run migrations
    if [[ -f "updates/core/intelligent_migration.py" ]]; then
        log_info "Running database migrations..."
        python3 updates/core/intelligent_migration.py 2>/dev/null || true
    fi
    
    deactivate
    cd "$SCRIPT_DIR"
    
    log_success "Backend configured"
}

setup_frontend() {
    log_info "Setting up Frontend..."
    
    if [[ ! -d "$SCRIPT_DIR/frontend" ]]; then
        log_error "Frontend directory not found!"
        exit 1
    fi
    
    cd "$SCRIPT_DIR/frontend"
    
    # Clean cache
    rm -rf .vite node_modules/.vite 2>/dev/null || true
    
    # Install dependencies
    log_info "Installing npm packages..."
    if ! npm install --silent 2>/dev/null; then
        log_warning "npm install had warnings, but continuing..."
    fi
    
    cd "$SCRIPT_DIR"
    
    log_success "Frontend configured"
}

build_frontend_production() {
    log_info "Building Frontend for production..."
    
    cd "$SCRIPT_DIR/frontend"
    
    rm -rf dist 2>/dev/null || true
    NODE_ENV=production npm run build
    
    if [[ -f "dist/index.html" ]]; then
        log_success "Production build created"
    else
        log_error "Production build failed"
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
}

setup_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        $SUDO ufw allow 3000/tcp 2>/dev/null || true
        $SUDO ufw allow 8000/tcp 2>/dev/null || true
        log_success "UFW: Ports 3000, 8000 opened"
    elif command -v firewall-cmd &> /dev/null; then
        $SUDO firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
        $SUDO firewall-cmd --permanent --add-port=8000/tcp 2>/dev/null || true
        $SUDO firewall-cmd --reload 2>/dev/null || true
        log_success "Firewalld: Ports 3000, 8000 opened"
    else
        log_warning "No firewall detected. Make sure ports 3000, 8000 are open."
    fi
}

create_systemd_services() {
    log_info "Creating systemd services..."
    
    # Backend service
    $SUDO tee /etc/systemd/system/moonbot-backend.service > /dev/null << EOF
[Unit]
Description=MoonBot Commander Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/backend
Environment=MOONBOT_MODE=server
ExecStart=$SCRIPT_DIR/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Scheduler service
    $SUDO tee /etc/systemd/system/moonbot-scheduler.service > /dev/null << EOF
[Unit]
Description=MoonBot Commander Scheduler
After=moonbot-backend.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/backend
Environment=MOONBOT_MODE=server
ExecStart=$SCRIPT_DIR/backend/venv/bin/python -m services.scheduler
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Install serve globally for frontend
    log_info "Installing serve globally..."
    npm install -g serve 2>/dev/null || $SUDO npm install -g serve 2>/dev/null || true
    
    # Get serve path
    SERVE_PATH=$(which serve 2>/dev/null || echo "/usr/local/bin/serve")
    
    # Frontend service
    $SUDO tee /etc/systemd/system/moonbot-frontend.service > /dev/null << EOF
[Unit]
Description=MoonBot Commander Frontend
After=moonbot-backend.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/frontend
ExecStart=$SERVE_PATH -s dist -l 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    $SUDO systemctl daemon-reload
    
    log_success "Systemd services created"
    log_info "To start: sudo systemctl start moonbot-backend moonbot-scheduler moonbot-frontend"
    log_info "To enable on boot: sudo systemctl enable moonbot-backend moonbot-scheduler moonbot-frontend"
}

create_start_scripts() {
    log_info "Creating start scripts..."
    
    # Make MOONBOT.sh executable
    chmod +x "$SCRIPT_DIR/MOONBOT.sh" 2>/dev/null || true
    chmod +x "$SCRIPT_DIR/install.sh" 2>/dev/null || true
    
    # Create quick start script
    cat > "$SCRIPT_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./MOONBOT.sh
EOF
    chmod +x "$SCRIPT_DIR/start.sh"
    
    log_success "Start scripts created"
}

# ============================================================
# MAIN MENU
# ============================================================

show_banner() {
    clear
    echo ""
    echo -e "${CYAN}"
    echo "  +===================================================================+"
    echo "  :                                                                   :"
    echo "  :   M   M  OOO   OOO  N   N BBBB   OOO  TTTTT                       :"
    echo "  :   MM MM O   O O   O NN  N B   B O   O   T                         :"
    echo "  :   M M M O   O O   O N N N BBBB  O   O   T                         :"
    echo "  :   M   M O   O O   O N  NN B   B O   O   T                         :"
    echo "  :   M   M  OOO   OOO  N   N BBBB   OOO    T                         :"
    echo "  :                                                                   :"
    echo "  :                    LINUX INSTALLER                               :"
    echo "  :                                                                   :"
    echo "  +===================================================================+"
    echo -e "${NC}"
    echo ""
}

install_local() {
    show_banner
    echo -e "${CYAN}Installing for LOCAL DEVELOPMENT...${NC}"
    echo ""
    
    check_root
    detect_os
    detect_package_manager
    
    echo ""
    log_info "Updating package lists..."
    $PKG_UPDATE 2>/dev/null || true
    
    install_system_deps
    install_python
    install_nodejs
    setup_backend
    setup_frontend
    create_start_scripts
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}LOCAL INSTALLATION COMPLETE!${NC}"
    echo ""
    echo "  To start the application:"
    echo "    ./MOONBOT.sh"
    echo "    or"
    echo "    ./start.sh"
    echo ""
    echo "  Then select [3] to start in DEV mode"
    echo "  ==================================================================="
    echo ""
}

install_server() {
    show_banner
    echo -e "${CYAN}Installing for SERVER (PRODUCTION)...${NC}"
    echo ""
    
    check_root
    detect_os
    detect_package_manager
    
    echo ""
    log_info "Updating package lists..."
    $PKG_UPDATE 2>/dev/null || true
    
    install_system_deps
    install_python
    install_nodejs
    setup_backend
    setup_frontend
    build_frontend_production
    setup_firewall
    create_systemd_services
    create_start_scripts
    
    # Get server IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}SERVER INSTALLATION COMPLETE!${NC}"
    echo ""
    echo "  To start manually:"
    echo "    ./MOONBOT.sh"
    echo "    Then select [4] for PRODUCTION mode"
    echo ""
    echo "  To start with systemd (recommended):"
    echo "    sudo systemctl start moonbot-backend moonbot-scheduler moonbot-frontend"
    echo "    sudo systemctl enable moonbot-backend moonbot-scheduler moonbot-frontend"
    echo ""
    echo "  Access:"
    echo "    Frontend: http://$SERVER_IP:3000"
    echo "    Backend:  http://$SERVER_IP:8000"
    echo "  ==================================================================="
    echo ""
}

install_docker() {
    show_banner
    echo -e "${CYAN}Installing with DOCKER...${NC}"
    echo ""
    
    check_root
    detect_os
    detect_package_manager
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        
        case $PKG_MANAGER in
            apt)
                $PKG_INSTALL ca-certificates curl gnupg lsb-release
                curl -fsSL https://download.docker.com/linux/$OS/gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
                $PKG_UPDATE
                $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-compose-plugin
                ;;
            dnf|yum)
                $PKG_INSTALL dnf-plugins-core
                $SUDO dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || \
                $SUDO dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || true
                $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-compose-plugin
                ;;
            pacman)
                $PKG_INSTALL docker docker-compose
                ;;
        esac
        
        $SUDO systemctl start docker
        $SUDO systemctl enable docker
        $SUDO usermod -aG docker $USER 2>/dev/null || true
        
        log_success "Docker installed"
    else
        log_success "Docker $(docker --version | cut -d' ' -f3) found"
    fi
    
    # Check docker-compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_info "Installing docker-compose..."
        $SUDO curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        $SUDO chmod +x /usr/local/bin/docker-compose
        log_success "docker-compose installed"
    fi
    
    # Build and start
    log_info "Building Docker images..."
    cd "$SCRIPT_DIR"
    
    # Make docker scripts executable
    chmod +x docker-start.sh docker-stop.sh docker/docker-start.sh docker/docker-stop.sh 2>/dev/null || true
    
    if docker compose version &> /dev/null; then
        docker compose -f docker/docker-compose.yml build
        log_success "Docker images built"
    else
        docker-compose -f docker/docker-compose.yml build
        log_success "Docker images built"
    fi
    
    echo ""
    echo "  To start:"
    echo "    ./docker-start.sh"
    echo "    or: cd docker && docker compose up -d"
    echo ""
    echo "  To stop:"
    echo "    ./docker-stop.sh"
    echo "    or: cd docker && docker compose down"
    
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
    
    echo ""
    echo "  ==================================================================="
    echo -e "  ${GREEN}DOCKER INSTALLATION COMPLETE!${NC}"
    echo ""
    echo "  Access after start:"
    echo "    Frontend: http://$SERVER_IP:3000"
    echo "    Backend:  http://$SERVER_IP:8000"
    echo "  ==================================================================="
    echo ""
}

show_menu() {
    show_banner
    
    echo "  Select installation type:"
    echo ""
    echo "    [1] LOCAL - For development on your machine"
    echo "        - Hot reload enabled"
    echo "        - Debug mode"
    echo ""
    echo "    [2] SERVER - For production server"
    echo "        - Optimized build"
    echo "        - Systemd services"
    echo "        - Firewall configuration"
    echo ""
    echo "    [3] DOCKER - Using Docker containers"
    echo "        - Isolated environment"
    echo "        - Easy deployment"
    echo ""
    echo "    [0] Exit"
    echo ""
    echo "  ==================================================================="
    echo ""
    read -p "  Select option: " choice
    
    case $choice in
        1) install_local ;;
        2) install_server ;;
        3) install_docker ;;
        0) 
            echo ""
            echo "  Goodbye!"
            exit 0
            ;;
        *)
            echo ""
            log_error "Invalid option"
            sleep 1
            show_menu
            ;;
    esac
}

# ============================================================
# ENTRY POINT
# ============================================================

# Check if running with argument
if [[ "$1" == "local" ]]; then
    install_local
elif [[ "$1" == "server" ]]; then
    install_server
elif [[ "$1" == "docker" ]]; then
    install_docker
else
    show_menu
fi

