#!/bin/bash
set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - Auto Update System (Linux)"
echo "============================================================"
echo ""

# ============================================================
# STEP 0: Check we're in the right folder
# ============================================================

if [ ! -f "backend/main.py" ] && [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}[ERROR] This does not look like MoonBot Commander folder!${NC}"
    echo ""
    echo "Please place update.sh in your MoonBot Commander folder"
    echo "where backend/ and frontend/ directories are located."
    echo ""
    exit 1
fi

echo -e "${GREEN}[INFO] Detected MoonBot Commander installation${NC}"
echo ""

# ============================================================
# STEP 1: Check current version
# ============================================================

echo -e "${CYAN}[1/11] Checking current version...${NC}"
echo ""

CURRENT_VERSION="unknown"

if [ -f "VERSION.txt" ]; then
    CURRENT_VERSION=$(cat VERSION.txt)
    echo "Current version: $CURRENT_VERSION"
else
    echo "Current version: 1.0.0 (pre-versioning)"
    CURRENT_VERSION="1.0.0"
fi

echo ""

# ============================================================
# STEP 2: Get latest version from GitHub
# ============================================================

echo -e "${CYAN}[2/11] Checking latest version on GitHub...${NC}"
echo ""

GITHUB_API="https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/latest"
TEMP_JSON="/tmp/moonbot_release.json"

# Download release info
if ! curl -s -f "$GITHUB_API" -o "$TEMP_JSON"; then
    echo -e "${RED}[ERROR] Failed to connect to GitHub!${NC}"
    echo ""
    echo "Please check:"
    echo "  - Internet connection"
    echo "  - Firewall settings"
    echo "  - GitHub is accessible"
    echo ""
    exit 1
fi

# Parse JSON for version and download URL
NEW_VERSION=$(grep -o '"tag_name": *"[^"]*"' "$TEMP_JSON" | sed 's/"tag_name": *"//;s/"//')
DOWNLOAD_URL=$(grep -o '"zipball_url": *"[^"]*"' "$TEMP_JSON" | sed 's/"zipball_url": *"//;s/"//')

# Remove 'v' from version if exists (v1.1.0 -> 1.1.0)
NEW_VERSION="${NEW_VERSION#v}"

echo "Latest version:  $NEW_VERSION"
echo ""

# Compare versions
if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
    echo -e "${YELLOW}[INFO] You already have the latest version ($CURRENT_VERSION)${NC}"
    echo ""
    read -p "Do you want to reinstall anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm "$TEMP_JSON" 2>/dev/null || true
        exit 0
    fi
fi

echo ""
echo "Update: v$CURRENT_VERSION → v$NEW_VERSION"
echo ""

read -p "Continue with update? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Update cancelled"
    rm "$TEMP_JSON" 2>/dev/null || true
    exit 0
fi

echo ""

# ============================================================
# STEP 3: Download new version
# ============================================================

echo -e "${CYAN}[3/11] Downloading new version...${NC}"
echo ""

TEMP_ZIP="/tmp/moonbot_update.zip"
TEMP_EXTRACT="/tmp/moonbot_extract"

echo "Downloading from GitHub..."
echo "This may take 1-2 minutes..."
echo ""

if ! curl -L -s -f "$DOWNLOAD_URL" -o "$TEMP_ZIP"; then
    echo -e "${RED}[ERROR] Download failed!${NC}"
    echo ""
    rm "$TEMP_JSON" 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}[OK] Downloaded successfully${NC}"
echo ""

# ============================================================
# STEP 4: Extract archive
# ============================================================

echo -e "${CYAN}[4/11] Extracting files...${NC}"
echo ""

rm -rf "$TEMP_EXTRACT" 2>/dev/null || true
mkdir -p "$TEMP_EXTRACT"

if ! unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"; then
    echo -e "${RED}[ERROR] Extraction failed!${NC}"
    rm "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null || true
    exit 1
fi

# Find the extracted folder (GitHub creates folder like MAKEDICH-moonbot-commander-abc123)
UPDATE_SOURCE=$(find "$TEMP_EXTRACT" -maxdepth 1 -type d -name "*moonbot*" | head -1)

if [ ! -f "$UPDATE_SOURCE/backend/main.py" ]; then
    echo -e "${RED}[ERROR] Invalid archive structure!${NC}"
    rm -rf "$TEMP_EXTRACT" "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}[OK] Files extracted${NC}"
echo ""

# ============================================================
# STEP 5: Stop application
# ============================================================

echo -e "${CYAN}[5/11] Stopping application...${NC}"
echo ""

pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "scheduler.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 3

echo -e "${GREEN}[OK] Application stopped${NC}"
echo ""

# ============================================================
# STEP 6: Create backup
# ============================================================

echo -e "${CYAN}[6/11] Creating backup...${NC}"
echo ""

BACKUP_DIR="backups/v${CURRENT_VERSION}_$(date +%Y-%m-%d_%H-%M-%S)"

mkdir -p "$BACKUP_DIR"

# Backup critical files
if [ -f "backend/.env" ]; then
    cp "backend/.env" "$BACKUP_DIR/.env"
    echo "  [OK] Backed up .env"
else
    echo "  [WARNING] No .env file found"
fi

if [ -f "backend/moonbot_commander.db" ]; then
    cp "backend/moonbot_commander.db" "$BACKUP_DIR/moonbot_commander.db"
    echo "  [OK] Backed up database"
else
    echo "  [WARNING] No database found"
fi

if [ -f "VERSION.txt" ]; then
    cp "VERSION.txt" "$BACKUP_DIR/VERSION.txt"
fi

# Backup logs
if ls backend/*.log 1> /dev/null 2>&1; then
    cp backend/*.log "$BACKUP_DIR/" 2>/dev/null || true
    echo "  [OK] Backed up logs"
fi

echo ""
echo -e "${GREEN}[OK] Backup created at: $BACKUP_DIR${NC}"
echo ""

# ============================================================
# STEP 7: Update Backend files
# ============================================================

echo -e "${CYAN}[7/11] Updating Backend files...${NC}"
echo ""

# Copy all Python files
cp "$UPDATE_SOURCE"/backend/*.py backend/ 2>/dev/null || true
echo "  [OK] Updated Python files"

# Copy requirements.txt
if [ -f "$UPDATE_SOURCE/backend/requirements.txt" ]; then
    cp "$UPDATE_SOURCE/backend/requirements.txt" backend/requirements.txt
    echo "  [OK] Updated requirements.txt"
fi

# Copy .env.example (don't overwrite .env!)
if [ -f "$UPDATE_SOURCE/backend/.env.example" ]; then
    cp "$UPDATE_SOURCE/backend/.env.example" backend/.env.example
    echo "  [OK] Updated .env.example"
fi

echo ""

# ============================================================
# STEP 8: Update Frontend files
# ============================================================

echo -e "${CYAN}[8/11] Updating Frontend files...${NC}"
echo ""

# Copy frontend src
if [ -d "$UPDATE_SOURCE/frontend/src" ]; then
    cp -r "$UPDATE_SOURCE/frontend/src/"* frontend/src/ 2>/dev/null || true
    echo "  [OK] Updated frontend/src"
fi

# Copy frontend public
if [ -d "$UPDATE_SOURCE/frontend/public" ]; then
    cp -r "$UPDATE_SOURCE/frontend/public/"* frontend/public/ 2>/dev/null || true
    echo "  [OK] Updated frontend/public"
fi

# Copy config files
if [ -f "$UPDATE_SOURCE/frontend/package.json" ]; then
    cp "$UPDATE_SOURCE/frontend/package.json" frontend/package.json
    echo "  [OK] Updated package.json"
fi

if [ -f "$UPDATE_SOURCE/frontend/vite.config.js" ]; then
    cp "$UPDATE_SOURCE/frontend/vite.config.js" frontend/vite.config.js
    echo "  [OK] Updated vite.config.js"
fi

if [ -f "$UPDATE_SOURCE/frontend/index.html" ]; then
    cp "$UPDATE_SOURCE/frontend/index.html" frontend/index.html
    echo "  [OK] Updated index.html"
fi

echo ""

# ============================================================
# STEP 9: Update scripts and docs
# ============================================================

echo -e "${CYAN}[9/11] Updating scripts and docs...${NC}"
echo ""

# Update Linux folder (shell scripts and Docker files)
if [ -d "$UPDATE_SOURCE/linux" ]; then
    # New version: scripts in linux/ folder
    cp -r "$UPDATE_SOURCE/linux"/* "$SCRIPT_DIR/" 2>/dev/null || true
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
    echo "  [OK] Updated Linux scripts and Docker files"
else
    # Old version: scripts in root, copy to current location
    for file in "$UPDATE_SOURCE"/*.sh; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            if [[ "$filename" != "update.sh" && "$filename" != "rollback.sh" ]]; then
                cp "$file" "$SCRIPT_DIR/$filename" 2>/dev/null || true
                chmod +x "$SCRIPT_DIR/$filename" 2>/dev/null || true
            fi
        fi
    done
    # Copy Docker files from root if they exist
    [ -f "$UPDATE_SOURCE/docker-compose.yml" ] && cp "$UPDATE_SOURCE/docker-compose.yml" "$SCRIPT_DIR/docker-compose.yml" 2>/dev/null || true
    [ -f "$UPDATE_SOURCE/docker-start.sh" ] && cp "$UPDATE_SOURCE/docker-start.sh" "$SCRIPT_DIR/docker-start.sh" 2>/dev/null || true
    [ -f "$UPDATE_SOURCE/docker-stop.sh" ] && cp "$UPDATE_SOURCE/docker-stop.sh" "$SCRIPT_DIR/docker-stop.sh" 2>/dev/null || true
    echo "  [OK] Updated scripts from old structure"
fi

# Update batch files (copy to project root for Windows compatibility)
cd "$PROJECT_ROOT"
for file in "$UPDATE_SOURCE"/*.bat; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [[ "$filename" != "UPDATE.bat" && "$filename" != "ROLLBACK.bat" ]]; then
            cp "$file" "$filename" 2>/dev/null || true
        fi
    fi
done
echo "  [OK] Updated batch files"

# Update docs
if [ -f "$UPDATE_SOURCE/README.md" ]; then
    cp "$UPDATE_SOURCE/README.md" README.md
    echo "  [OK] Updated README.md"
fi

if [ -f "$UPDATE_SOURCE/CHANGELOG.md" ]; then
    cp "$UPDATE_SOURCE/CHANGELOG.md" CHANGELOG.md
    echo "  [OK] Updated CHANGELOG.md"
fi

# Update version file
echo "$NEW_VERSION" > VERSION.txt
echo "  [OK] Updated VERSION.txt"

# Copy other files
[ -f "$UPDATE_SOURCE/moonbot-icon.png" ] && cp "$UPDATE_SOURCE/moonbot-icon.png" moonbot-icon.png 2>/dev/null || true
[ -f "$UPDATE_SOURCE/.gitignore" ] && cp "$UPDATE_SOURCE/.gitignore" .gitignore 2>/dev/null || true

echo ""

# ============================================================
# STEP 10: Restore user data
# ============================================================

echo -e "${CYAN}[10/11] Restoring user data...${NC}"
echo ""

if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" backend/.env
    echo "  [OK] Restored .env"
else
    echo "  [WARNING] No .env to restore"
fi

if [ -f "$BACKUP_DIR/moonbot_commander.db" ]; then
    cp "$BACKUP_DIR/moonbot_commander.db" backend/moonbot_commander.db
    echo "  [OK] Restored database"
else
    echo "  [WARNING] No database to restore"
fi

echo ""

# ============================================================
# STEP 11: Install dependencies and finalize
# ============================================================

echo -e "${CYAN}[11/11] Installing dependencies...${NC}"
echo ""

cd backend
python3 -m pip install --upgrade pip --quiet >/dev/null 2>&1 || true
pip3 install -r requirements.txt --quiet
echo "  [OK] Backend dependencies installed"

# Verify WebSocket support
python3 -c "import websockets" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  [WARNING] WebSocket library not found, installing..."
    pip3 install websockets --quiet
    python3 -c "import websockets" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}  [ERROR] Failed to install websockets!${NC}"
        cd ..
        exit 1
    fi
    echo -e "${GREEN}  [OK] WebSocket support added${NC}"
else
    echo "  [OK] WebSocket support confirmed"
fi

# Run migrations
python3 migrate_add_password.py >/dev/null 2>&1 || true
python3 migrate_add_recovery_codes.py >/dev/null 2>&1 || true
python3 migrate_add_2fa.py >/dev/null 2>&1 || true
python3 migrate_scheduled_commands_full.py >/dev/null 2>&1 || true
python3 migrate_add_timezone.py >/dev/null 2>&1 || true
python3 migrate_add_scheduler_settings.py >/dev/null 2>&1 || true
python3 migrate_add_display_time.py >/dev/null 2>&1 || true
python3 migrate_add_udp_listener.py >/dev/null 2>&1 || true
echo "  [OK] Database migrations completed"

cd ../frontend
npm install --silent >/dev/null 2>&1 || true
echo "  [OK] Frontend dependencies installed"

# Clean cache
rm -rf dist .vite 2>/dev/null || true
echo "  [OK] Cache cleaned"

# Detect if this is a server installation
IS_SERVER=0
if systemctl list-units --full --all | grep -q "moonbot"; then
    IS_SERVER=1
fi

# Build frontend for production if server
if [ "$IS_SERVER" = "1" ]; then
    echo ""
    echo "  [INFO] Server installation detected"
    echo "  [INFO] Building frontend for production..."
    export NODE_ENV=production
    npm run build >/dev/null 2>&1 || true
    if [ -f "dist/index.html" ]; then
        echo -e "${GREEN}  [OK] Frontend built for production${NC}"
    else
        echo -e "${YELLOW}  [WARNING] Frontend build failed, but continuing...${NC}"
    fi
fi

cd ..

echo ""

# ============================================================
# STEP 12: Password encryption fix (if needed)
# ============================================================

echo -e "${CYAN}[12/13] Checking password encryption...${NC}"
echo ""

cd backend

# Check if database has servers with passwords
python3 -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); c = conn.cursor(); c.execute('SELECT COUNT(*) FROM servers WHERE password IS NOT NULL AND password != \"\"'); count = c.fetchone()[0]; conn.close(); exit(0 if count == 0 else 1)" >/dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "  [INFO] Found servers with passwords"
    echo ""
    echo "  Some servers may have encryption issues from previous versions."
    echo "  This can cause bad_hmac errors."
    echo ""
    read -p "  Do you want to run password encryption fix? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "  Running fix_password_encryption.py..."
        python3 fix_password_encryption.py
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  [OK] Password encryption fixed${NC}"
        else
            echo -e "${YELLOW}  [WARNING] Fix script failed, you can run it manually later${NC}"
        fi
    else
        echo "  [SKIPPED] You can run it later: cd backend && python3 fix_password_encryption.py"
    fi
else
    echo "  [OK] No password issues detected"
fi

cd ..

echo ""

# ============================================================
# STEP 13: Auto-start application
# ============================================================

echo -e "${CYAN}[13/13] Starting application...${NC}"
echo ""

# Detect which start script to use
START_SCRIPT=""

if [ "$IS_SERVER" = "1" ]; then
    if [ -f "server-start.sh" ]; then
        START_SCRIPT="server-start.sh"
        echo "  [INFO] Starting server mode..."
    fi
else
    if [ -f "local-start.sh" ]; then
        START_SCRIPT="local-start.sh"
        echo "  [INFO] Starting local development mode..."
    elif [ -f "start.sh" ]; then
        START_SCRIPT="start.sh"
        echo "  [INFO] Starting with smart start..."
    fi
fi

if [ -n "$START_SCRIPT" ]; then
    echo ""
    read -p "  Do you want to start the application now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "  [INFO] Starting application with $START_SCRIPT..."
        chmod +x "$START_SCRIPT"
        ./"$START_SCRIPT" &
        sleep 2
        echo -e "${GREEN}  [OK] Application started${NC}"
    else
        echo ""
        echo "  [SKIPPED] Start manually with: ./$START_SCRIPT"
    fi
else
    echo -e "${YELLOW}  [WARNING] No start script found${NC}"
    echo "  [INFO] Please start manually"
fi

echo ""

# ============================================================
# CLEANUP: Remove temporary files
# ============================================================

echo "Cleaning up temporary files..."
rm -rf "$TEMP_EXTRACT" "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null || true
echo ""

# ============================================================
# FINISHED
# ============================================================

echo ""
echo "============================================================"
echo "            UPDATE COMPLETED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Updated from v$CURRENT_VERSION to v$NEW_VERSION"
echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""
echo "Changes in v$NEW_VERSION:"
if [ -f "CHANGELOG.md" ]; then
    echo "See CHANGELOG.md for details"
else
    echo "  - WebSocket support for real-time updates"
    echo "  - Improved backend architecture"
    echo "  - Linux and Docker support"
    echo "  - Better error handling"
fi
echo ""
echo "Next steps:"
echo "  1. Start application: ./start.sh or ./local-start.sh"
echo "  2. Check that everything works"
echo "  3. If issues occur, run ./rollback.sh"
echo ""
echo "[!] Keep update.sh for future updates"
echo ""
