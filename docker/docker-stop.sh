#!/bin/bash

# ============================================================
# MOONBOT COMMANDER - DOCKER STOP SCRIPT
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  Stopping MoonBot Commander..."
echo ""

# Use docker compose (v2) or docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Stop containers
$COMPOSE_CMD -f docker-compose.yml down

echo ""
echo "  MoonBot Commander stopped."
echo ""

# Optional: remove volumes
if [[ "$1" == "--clean" || "$1" == "-c" ]]; then
    echo "  Removing volumes..."
    $COMPOSE_CMD -f docker-compose.yml down -v
    echo "  Volumes removed."
fi

