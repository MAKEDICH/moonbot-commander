#!/bin/bash

# Colors
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "============================================================"
echo "       MoonBot Commander - Docker Stop"
echo "============================================================"
echo ""

echo -e "${YELLOW}Stopping and removing containers...${NC}"
echo ""

# Use docker compose (newer) or docker-compose (older)
if docker compose version &> /dev/null 2>&1; then
    docker compose down
else
    docker-compose down
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}[OK] All containers stopped${NC}"
    echo ""
else
    echo -e "${RED}[ERROR] Failed to stop containers${NC}"
    exit 1
fi

