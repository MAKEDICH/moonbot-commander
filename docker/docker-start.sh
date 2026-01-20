#!/bin/bash

# ============================================================
# MOONBOT COMMANDER - DOCKER START SCRIPT
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  Starting MoonBot Commander with Docker..."
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "  [ERROR] Docker is not running!"
    echo "  Please start Docker first."
    exit 1
fi

# Use docker compose (v2) or docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Build if needed
if [[ "$1" == "--build" || "$1" == "-b" ]]; then
    echo "  Building images..."
    $COMPOSE_CMD -f docker-compose.yml build
fi

# Start containers
echo "  Starting containers..."
$COMPOSE_CMD -f docker-compose.yml up -d

# Wait for health check
echo "  Waiting for services to start..."
sleep 5

# Check status
echo ""
echo "  Container status:"
docker ps --filter "name=moonbot" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "  ==================================================================="
echo "  MoonBot Commander is running!"
echo ""
echo "  Frontend: http://$SERVER_IP:3000"
echo "  Backend:  http://$SERVER_IP:8000"
echo "  API Docs: http://$SERVER_IP:8000/docs"
echo ""
echo "  Commands:"
echo "    View logs:    $COMPOSE_CMD logs -f"
echo "    Stop:         ./docker-stop.sh"
echo "    Restart:      $COMPOSE_CMD restart"
echo "  ==================================================================="
echo ""

