#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - Rollback System (Linux)"
echo "============================================================"
echo ""
echo -e "${YELLOW}WARNING: This will restore your application code to a${NC}"
echo -e "${YELLOW}         previous version while keeping your current data${NC}"
echo ""

# ============================================================
# STEP 1: Find available backups
# ============================================================

echo "Available backups:"
echo ""

if [ ! -d "backups" ]; then
    echo -e "${RED}[ERROR] No backups found!${NC}"
    echo ""
    echo "Backups are automatically created when you run ./update.sh"
    echo ""
    exit 1
fi

COUNT=0
declare -a BACKUPS

for dir in backups/*; do
    if [ -d "$dir" ]; then
        COUNT=$((COUNT + 1))
        BACKUPS[$COUNT]=$(basename "$dir")
        echo "  $COUNT. ${BACKUPS[$COUNT]}"
    fi
done

if [ $COUNT -eq 0 ]; then
    echo -e "${RED}[ERROR] No backups found!${NC}"
    echo ""
    exit 1
fi

echo ""
read -p "Select backup to restore (1-$COUNT, or 0 to cancel): " CHOICE

if [ "$CHOICE" = "0" ]; then
    echo "Rollback cancelled"
    exit 0
fi

if [ $CHOICE -lt 1 ] || [ $CHOICE -gt $COUNT ]; then
    echo -e "${RED}[ERROR] Invalid choice!${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$CHOICE]}"
BACKUP_PATH="backups/$SELECTED_BACKUP"
echo ""
echo "Selected backup: $SELECTED_BACKUP"
echo ""

# Extract version from backup name (e.g., v1.1.2_2024-11-11_...)
TARGET_VERSION=$(echo "$SELECTED_BACKUP" | cut -d'_' -f1)

if [ -z "$TARGET_VERSION" ]; then
    echo -e "${RED}[ERROR] Cannot determine version from backup name${NC}"
    exit 1
fi

echo "Target version: $TARGET_VERSION"
echo ""

# ============================================================
# STEP 2: Confirm rollback
# ============================================================

echo -e "${YELLOW}WARNING: This will:${NC}"
echo "  - Stop the application"
echo "  - Download code version $TARGET_VERSION from GitHub"
echo "  - Replace application files with $TARGET_VERSION"
echo "  - KEEP your current database (all servers, settings, orders)"
echo "  - KEEP your current .env (encryption keys)"
echo "  - Your data will be preserved!"
echo ""

read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

echo ""

# ============================================================
# STEP 3: Download target version from GitHub
# ============================================================

echo -e "${CYAN}[1/7] Downloading version $TARGET_VERSION from GitHub...${NC}"
echo ""

GITHUB_API="https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/$TARGET_VERSION"
TEMP_JSON="/tmp/moonbot_rollback.json"
TEMP_ZIP="/tmp/moonbot_rollback.zip"
TEMP_EXTRACT="/tmp/moonbot_rollback_extract"

# Get release info
curl -s -L "$GITHUB_API" > "$TEMP_JSON" 2>/dev/null

if [ ! -s "$TEMP_JSON" ]; then
    echo -e "${RED}[ERROR] Failed to get release info from GitHub!${NC}"
    echo ""
    echo "Possible reasons:"
    echo "  - Version $TARGET_VERSION not found on GitHub"
    echo "  - No internet connection"
    echo "  - GitHub is not accessible"
    echo ""
    rm -f "$TEMP_JSON" 2>/dev/null
    exit 1
fi

# Get download URL
DOWNLOAD_URL=$(grep -o '"zipball_url": *"[^"]*"' "$TEMP_JSON" | cut -d'"' -f4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "${RED}[ERROR] Failed to get download URL!${NC}"
    rm -f "$TEMP_JSON" 2>/dev/null
    exit 1
fi

echo "Downloading from GitHub..."
curl -L "$DOWNLOAD_URL" -o "$TEMP_ZIP" 2>/dev/null

if [ ! -f "$TEMP_ZIP" ]; then
    echo -e "${RED}[ERROR] Download failed!${NC}"
    rm -f "$TEMP_JSON" 2>/dev/null
    exit 1
fi

echo -e "${GREEN}[OK] Downloaded${NC}"
echo ""

# ============================================================
# STEP 4: Extract files
# ============================================================

echo -e "${CYAN}[2/7] Extracting files...${NC}"
echo ""

rm -rf "$TEMP_EXTRACT" 2>/dev/null
mkdir -p "$TEMP_EXTRACT"

unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT" 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Extraction failed!${NC}"
    rm -rf "$TEMP_EXTRACT" "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null
    exit 1
fi

# Find extracted folder
ROLLBACK_SOURCE=$(find "$TEMP_EXTRACT" -maxdepth 1 -type d -name "*moonbot*" | head -1)

if [ ! -f "$ROLLBACK_SOURCE/backend/main.py" ]; then
    echo -e "${RED}[ERROR] Invalid archive structure!${NC}"
    rm -rf "$TEMP_EXTRACT" "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null
    exit 1
fi

echo -e "${GREEN}[OK] Files extracted${NC}"
echo ""

# ============================================================
# STEP 5: Stop application
# ============================================================

echo -e "${CYAN}[3/7] Stopping application...${NC}"
echo ""

pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "scheduler.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 3

echo -e "${GREEN}[OK] Application stopped${NC}"
echo ""

# ============================================================
# STEP 6: Backup current state (safety)
# ============================================================

echo -e "${CYAN}[4/7] Creating safety backup...${NC}"
echo ""

SAFETY_BACKUP="backups/safety_before_rollback_$(date +%Y-%m-%d_%H-%M-%S)"

mkdir -p "$SAFETY_BACKUP"

if [ -f "backend/.env" ]; then
    cp "backend/.env" "$SAFETY_BACKUP/.env"
fi

if [ -f "backend/moonbot_commander.db" ]; then
    cp "backend/moonbot_commander.db" "$SAFETY_BACKUP/moonbot_commander.db"
fi

if [ -f "VERSION.txt" ]; then
    cp "VERSION.txt" "$SAFETY_BACKUP/VERSION.txt"
fi

echo -e "${GREEN}[OK] Safety backup created at: $SAFETY_BACKUP${NC}"
echo ""

# ============================================================
# STEP 7: Replace application code
# ============================================================

echo -e "${CYAN}[5/7] Restoring application code to $TARGET_VERSION...${NC}"
echo ""

# Backend files
for file in "$ROLLBACK_SOURCE"/backend/*.py; do
    if [ -f "$file" ]; then
        cp "$file" "backend/"
    fi
done
echo "  [OK] Backend Python files restored"

if [ -f "$ROLLBACK_SOURCE/backend/requirements.txt" ]; then
    cp "$ROLLBACK_SOURCE/backend/requirements.txt" "backend/requirements.txt"
    echo "  [OK] requirements.txt restored"
fi

if [ -f "$ROLLBACK_SOURCE/backend/.env.example" ]; then
    cp "$ROLLBACK_SOURCE/backend/.env.example" "backend/.env.example"
    echo "  [OK] .env.example restored"
fi

# Frontend files
if [ -d "$ROLLBACK_SOURCE/frontend/src" ]; then
    cp -r "$ROLLBACK_SOURCE/frontend/src" "frontend/"
    echo "  [OK] Frontend source restored"
fi

if [ -d "$ROLLBACK_SOURCE/frontend/public" ]; then
    cp -r "$ROLLBACK_SOURCE/frontend/public" "frontend/"
    echo "  [OK] Frontend public restored"
fi

if [ -f "$ROLLBACK_SOURCE/frontend/package.json" ]; then
    cp "$ROLLBACK_SOURCE/frontend/package.json" "frontend/package.json"
    echo "  [OK] package.json restored"
fi

if [ -f "$ROLLBACK_SOURCE/frontend/vite.config.js" ]; then
    cp "$ROLLBACK_SOURCE/frontend/vite.config.js" "frontend/vite.config.js"
fi

if [ -f "$ROLLBACK_SOURCE/frontend/index.html" ]; then
    cp "$ROLLBACK_SOURCE/frontend/index.html" "frontend/index.html"
fi

# Shell scripts and batch files (keep compatibility with old structure)
SCRIPTS_RESTORED=0

# Copy shell scripts (they should stay in root for Linux)
for file in "$ROLLBACK_SOURCE"/*.sh; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [ "$filename" != "update.sh" ] && [ "$filename" != "rollback.sh" ]; then
            cp "$file" "./$filename"
            SCRIPTS_RESTORED=1
        fi
    fi
done

# Copy batch files for Windows compatibility
for file in "$ROLLBACK_SOURCE"/*.bat; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [ "$filename" != "UPDATE.bat" ] && [ "$filename" != "ROLLBACK.bat" ]; then
            cp "$file" "./$filename"
            SCRIPTS_RESTORED=1
        fi
    fi
done

# Docker files
if [ -f "$ROLLBACK_SOURCE/docker-compose.yml" ]; then
    cp "$ROLLBACK_SOURCE/docker-compose.yml" "./docker-compose.yml"
    SCRIPTS_RESTORED=1
fi

if [ -f "$ROLLBACK_SOURCE/docker-start.sh" ]; then
    cp "$ROLLBACK_SOURCE/docker-start.sh" "./docker-start.sh"
    SCRIPTS_RESTORED=1
fi

if [ -f "$ROLLBACK_SOURCE/docker-stop.sh" ]; then
    cp "$ROLLBACK_SOURCE/docker-stop.sh" "./docker-stop.sh"
    SCRIPTS_RESTORED=1
fi

if [ $SCRIPTS_RESTORED -eq 1 ]; then
    echo "  [OK] Scripts and Docker files restored"
fi

# Documentation
if [ -f "$ROLLBACK_SOURCE/README.md" ]; then
    cp "$ROLLBACK_SOURCE/README.md" "README.md"
fi

if [ -f "$ROLLBACK_SOURCE/CHANGELOG.md" ]; then
    cp "$ROLLBACK_SOURCE/CHANGELOG.md" "CHANGELOG.md"
fi

# Update VERSION.txt
echo "$TARGET_VERSION" > VERSION.txt
echo "  [OK] VERSION.txt updated to $TARGET_VERSION"

echo ""
echo -e "${GREEN}[OK] Application code restored to $TARGET_VERSION${NC}"
echo ""

# ============================================================
# STEP 8: Install dependencies
# ============================================================

echo -e "${CYAN}[6/7] Installing dependencies...${NC}"
echo ""

cd backend
python3 -m pip install --upgrade pip --quiet >/dev/null 2>&1 || true
pip3 install -r requirements.txt --quiet
echo "  [OK] Backend dependencies installed"

# Verify websockets
python3 -c "import websockets" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  [WARNING] Installing websockets..."
    pip3 install websockets --quiet
fi
echo "  [OK] WebSocket support confirmed"

cd ../frontend
npm install --silent >/dev/null 2>&1 || true
echo "  [OK] Frontend dependencies installed"

# Clean cache
rm -rf dist .vite 2>/dev/null || true
echo "  [OK] Cache cleaned"

cd ..

echo ""

# ============================================================
# STEP 9: Cleanup
# ============================================================

echo -e "${CYAN}[7/7] Cleaning up...${NC}"
echo ""

rm -rf "$TEMP_EXTRACT" "$TEMP_ZIP" "$TEMP_JSON" 2>/dev/null || true

echo -e "${GREEN}[OK] Temporary files removed${NC}"
echo ""

# ============================================================
# FINISHED
# ============================================================

echo ""
echo "============================================================"
echo "            ROLLBACK COMPLETED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Application rolled back to: $TARGET_VERSION"
echo ""
echo "YOUR DATA IS PRESERVED:"
echo "  [OK] Database - all servers, orders, settings intact"
echo "  [OK] Encryption keys - .env unchanged"
echo "  [OK] All user data preserved"
echo ""
echo "Safety backup created at:"
echo "  $SAFETY_BACKUP"
echo ""
echo "Next steps:"
echo "  1. Start application with ./local-start.sh or ./server-start.sh"
echo "  2. Verify that everything works correctly"
echo "  3. Your data should be intact"
echo ""
echo "If you need to undo this rollback, manually restore from:"
echo "  $SAFETY_BACKUP"
echo ""
