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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander - БЕЗОПАСНОЕ ОБНОВЛЕНИЕ"
echo "============================================================"
echo ""
echo "   ✅ Автоматическое определение версии"
echo "   ✅ Интеллектуальные миграции БД"
echo "   ✅ Полное резервное копирование"
echo "   ✅ Возможность отката"
echo ""
echo "============================================================"
echo ""

# ============================================================
# STEP 0: Проверка расположения
# ============================================================

if [ ! -f "backend/main.py" ] && [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}[ОШИБКА] Это не похоже на папку MoonBot Commander!${NC}"
    echo ""
    echo "Поместите update-safe.sh в папку MoonBot Commander"
    echo "где находятся директории backend/ и frontend/."
    echo ""
    exit 1
fi

echo -e "${GREEN}[INFO] Обнаружена установка MoonBot Commander${NC}"
echo ""

# ============================================================
# STEP 1: Остановка приложения
# ============================================================

echo -e "${CYAN}[1/10] Остановка приложения...${NC}"
echo ""

# Проверяем запущены ли процессы
PYTHON_RUNNING=false
NODE_RUNNING=false

if pgrep -f "python.*main.py" > /dev/null || pgrep -f "python.*scheduler.py" > /dev/null; then
    PYTHON_RUNNING=true
fi

if pgrep -f "node.*vite" > /dev/null || pgrep -f "npm.*dev" > /dev/null; then
    NODE_RUNNING=true
fi

if [ "$PYTHON_RUNNING" = true ] || [ "$NODE_RUNNING" = true ]; then
    echo -e "${YELLOW}Обнаружены запущенные процессы${NC}"
    echo ""
    read -p "Остановить их для безопасного обновления? [Y/n] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        # Останавливаем systemd сервисы если есть
        if systemctl is-active --quiet moonbot-backend 2>/dev/null; then
            echo "Остановка moonbot-backend..."
            sudo systemctl stop moonbot-backend
        fi
        
        if systemctl is-active --quiet moonbot-frontend 2>/dev/null; then
            echo "Остановка moonbot-frontend..."
            sudo systemctl stop moonbot-frontend
        fi
        
        # Останавливаем процессы
        pkill -f "python.*main.py" || true
        pkill -f "python.*scheduler.py" || true
        pkill -f "node.*vite" || true
        pkill -f "npm.*dev" || true
        
        sleep 3
        echo -e "${GREEN}[OK] Процессы остановлены${NC}"
    else
        echo ""
        echo -e "${YELLOW}[ВНИМАНИЕ] Обновление при запущенном приложении может привести к ошибкам!${NC}"
        echo ""
        read -p "Все равно продолжить? (НЕ рекомендуется) [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
else
    echo -e "${GREEN}[OK] Приложение не запущено${NC}"
fi

echo ""

# ============================================================
# STEP 2: Проверка текущей версии
# ============================================================

echo -e "${CYAN}[2/10] Анализ текущей версии...${NC}"
echo ""

CURRENT_VERSION="unknown"

if [ -f "VERSION.txt" ]; then
    CURRENT_VERSION=$(cat VERSION.txt | tr -d '\r\n')
    echo "Версия из файла: $CURRENT_VERSION"
else
    echo "Файл версии не найден, определяем по БД..."
    CURRENT_VERSION="1.0.0"
fi

# Запускаем интеллектуальное определение версии
if [ -f "backend/intelligent_migration.py" ]; then
    cd backend
    python3 -c "from intelligent_migration import IntelligentMigrationSystem; m = IntelligentMigrationSystem(); v, _ = m.detect_current_version(); print(f'Определена версия БД: {v}')" 2>/dev/null || true
    cd ..
fi

echo ""

# ============================================================
# STEP 3: Создание полной резервной копии
# ============================================================

echo -e "${CYAN}[3/10] Создание полной резервной копии...${NC}"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FULL_BACKUP_DIR="full_backups/backup_${TIMESTAMP}"

mkdir -p full_backups
mkdir -p "$FULL_BACKUP_DIR"

# Копируем ВСЮ структуру приложения
echo "Копирование файлов приложения..."

# Backend
if [ -d "backend" ]; then
    cp -r backend "$FULL_BACKUP_DIR/" 2>/dev/null || true
    # Удаляем большие/ненужные файлы из бэкапа
    rm -rf "$FULL_BACKUP_DIR/backend/__pycache__" 2>/dev/null || true
    rm -rf "$FULL_BACKUP_DIR/backend/logs/*.log" 2>/dev/null || true
fi

# Frontend (только исходники, без node_modules)
if [ -d "frontend/src" ]; then
    mkdir -p "$FULL_BACKUP_DIR/frontend"
    cp -r frontend/src "$FULL_BACKUP_DIR/frontend/" 2>/dev/null || true
    cp -r frontend/public "$FULL_BACKUP_DIR/frontend/" 2>/dev/null || true
fi

# Конфигурационные файлы
[ -f "frontend/package.json" ] && cp "frontend/package.json" "$FULL_BACKUP_DIR/frontend/" 2>/dev/null || true
[ -f "frontend/vite.config.js" ] && cp "frontend/vite.config.js" "$FULL_BACKUP_DIR/frontend/" 2>/dev/null || true
[ -f "VERSION.txt" ] && cp "VERSION.txt" "$FULL_BACKUP_DIR/" 2>/dev/null || true

# Особенно важные файлы
if [ -f "backend/.env" ]; then
    cp "backend/.env" "$FULL_BACKUP_DIR/backend/.env"
    echo -e "   ${GREEN}✅ .env сохранен${NC}"
fi

if [ -f "backend/moonbot_commander.db" ]; then
    cp "backend/moonbot_commander.db" "$FULL_BACKUP_DIR/backend/moonbot_commander.db"
    echo -e "   ${GREEN}✅ База данных сохранена${NC}"
fi

echo ""
echo -e "${GREEN}[OK] Полный бэкап создан: $FULL_BACKUP_DIR${NC}"
echo ""

# ============================================================
# STEP 4: Получение списка версий с GitHub
# ============================================================

echo -e "${CYAN}[4/10] Получение доступных версий с GitHub...${NC}"
echo ""

TEMP_RELEASES="/tmp/moonbot_releases.json"

# Скачиваем список релизов
if ! curl -s -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/MAKEDICH/moonbot-commander/releases" \
    -o "$TEMP_RELEASES"; then
    
    echo -e "${RED}[ОШИБКА] Не удалось получить список версий с GitHub!${NC}"
    echo ""
    echo "Проверьте подключение к интернету."
    exit 1
fi

# Показываем версии
echo "Доступные версии (текущая: $CURRENT_VERSION):"
echo ""

# Парсим JSON и показываем версии
i=1
while read -r line; do
    tag_name=$(echo "$line" | jq -r '.tag_name // empty')
    name=$(echo "$line" | jq -r '.name // empty')
    prerelease=$(echo "$line" | jq -r '.prerelease // false')
    
    if [ -n "$tag_name" ]; then
        marker=""
        if [ "$tag_name" = "v$CURRENT_VERSION" ] || [ "$tag_name" = "$CURRENT_VERSION" ]; then
            marker=" [УСТАНОВЛЕНА]"
        fi
        
        if [ "$prerelease" = "true" ]; then
            marker="$marker (pre-release)"
        fi
        
        echo "  [$i] $tag_name - $name$marker"
        ((i++))
    fi
    
    if [ $i -gt 10 ]; then
        break
    fi
done < <(jq -c '.[]' "$TEMP_RELEASES")

echo ""
echo "  [0] Ввести версию вручную"
echo ""

# Выбор версии
read -p "Выберите номер версии: " VERSION_CHOICE

TEMP_JSON="/tmp/moonbot_release.json"

if [ "$VERSION_CHOICE" = "0" ]; then
    echo ""
    read -p "Введите тег версии (например v2.1.3): " SPECIFIC_VERSION
    echo ""
    echo "Получение версии $SPECIFIC_VERSION..."
    GITHUB_API="https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/$SPECIFIC_VERSION"
else
    echo ""
    echo "Получение выбранной версии..."
    # Получаем тег выбранной версии
    SELECTED_TAG=$(jq -r ".[$((VERSION_CHOICE-1))].tag_name // empty" "$TEMP_RELEASES")
    
    if [ -z "$SELECTED_TAG" ]; then
        echo -e "${RED}[ОШИБКА] Неверный выбор${NC}"
        exit 1
    fi
    
    GITHUB_API="https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/$SELECTED_TAG"
fi

# Скачиваем информацию о релизе
if ! curl -s -H "Accept: application/vnd.github.v3+json" "$GITHUB_API" -o "$TEMP_JSON"; then
    echo -e "${RED}[ОШИБКА] Не удалось получить информацию о версии!${NC}"
    exit 1
fi

# Парсим версию и URL
NEW_VERSION=$(jq -r '.tag_name // empty' "$TEMP_JSON" | sed 's/^v//')
DOWNLOAD_URL=$(jq -r '.zipball_url // empty' "$TEMP_JSON")

if [ -z "$NEW_VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
    echo -e "${RED}[ОШИБКА] Не удалось распарсить информацию о версии${NC}"
    exit 1
fi

echo "Выбранная версия: v$NEW_VERSION"
echo ""

# ============================================================
# STEP 5: Скачивание новой версии
# ============================================================

echo -e "${CYAN}[5/10] Скачивание новой версии...${NC}"
echo ""

TEMP_ZIP="/tmp/moonbot_update.zip"
TEMP_EXTRACT="/tmp/moonbot_extract"

echo "Загрузка с GitHub..."
echo "Это может занять 1-2 минуты..."
echo ""

if ! curl -L -H "Accept: application/vnd.github.v3+json" \
    "$DOWNLOAD_URL" -o "$TEMP_ZIP"; then
    
    echo -e "${RED}[ОШИБКА] Загрузка не удалась!${NC}"
    rm -f "$TEMP_JSON"
    exit 1
fi

echo -e "${GREEN}[OK] Загружено успешно${NC}"
echo ""

# ============================================================
# STEP 6: Распаковка файлов
# ============================================================

echo -e "${CYAN}[6/10] Распаковка файлов...${NC}"
echo ""

rm -rf "$TEMP_EXTRACT"
mkdir -p "$TEMP_EXTRACT"

if ! unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"; then
    echo -e "${RED}[ОШИБКА] Распаковка не удалась!${NC}"
    rm -f "$TEMP_ZIP" "$TEMP_JSON"
    exit 1
fi

# Находим папку внутри архива
UPDATE_SOURCE=$(find "$TEMP_EXTRACT" -type d -name "moonbot-commander-*" | head -1)

if [ -z "$UPDATE_SOURCE" ] || [ ! -f "$UPDATE_SOURCE/backend/main.py" ]; then
    echo -e "${RED}[ОШИБКА] Неверная структура архива!${NC}"
    rm -rf "$TEMP_EXTRACT"
    rm -f "$TEMP_ZIP" "$TEMP_JSON"
    exit 1
fi

echo -e "${GREEN}[OK] Файлы распакованы${NC}"
echo ""

# ============================================================
# STEP 7: Обновление файлов приложения
# ============================================================

echo -e "${CYAN}[7/10] Обновление файлов приложения...${NC}"
echo ""

# Backend
echo "Обновление Backend..."
cp -f "$UPDATE_SOURCE"/backend/*.py backend/ 2>/dev/null || true
[ -d "$UPDATE_SOURCE/backend/api" ] && cp -rf "$UPDATE_SOURCE/backend/api" backend/ 2>/dev/null || true
[ -d "$UPDATE_SOURCE/backend/alembic" ] && cp -rf "$UPDATE_SOURCE/backend/alembic" backend/ 2>/dev/null || true
[ -f "$UPDATE_SOURCE/backend/requirements.txt" ] && cp -f "$UPDATE_SOURCE/backend/requirements.txt" backend/

# Frontend
echo "Обновление Frontend..."
[ -d "$UPDATE_SOURCE/frontend/src" ] && cp -rf "$UPDATE_SOURCE/frontend/src" frontend/ 2>/dev/null || true
[ -d "$UPDATE_SOURCE/frontend/public" ] && cp -rf "$UPDATE_SOURCE/frontend/public" frontend/ 2>/dev/null || true
[ -f "$UPDATE_SOURCE/frontend/package.json" ] && cp -f "$UPDATE_SOURCE/frontend/package.json" frontend/
[ -f "$UPDATE_SOURCE/frontend/vite.config.js" ] && cp -f "$UPDATE_SOURCE/frontend/vite.config.js" frontend/
[ -f "$UPDATE_SOURCE/frontend/index.html" ] && cp -f "$UPDATE_SOURCE/frontend/index.html" frontend/

# Скрипты и документация
echo "Обновление скриптов..."
for script in "$UPDATE_SOURCE"/*.bat; do
    if [ -f "$script" ]; then
        filename=$(basename "$script")
        if [ "$filename" != "UPDATE.bat" ] && [ "$filename" != "UPDATE-SAFE.bat" ]; then
            cp -f "$script" ./ 2>/dev/null || true
        fi
    fi
done

# Linux скрипты
if [ -d "$UPDATE_SOURCE/linux" ]; then
    for script in "$UPDATE_SOURCE"/linux/*.sh; do
        if [ -f "$script" ]; then
            filename=$(basename "$script")
            if [ "$filename" != "update.sh" ] && [ "$filename" != "update-safe.sh" ]; then
                cp -f "$script" linux/ 2>/dev/null || true
                chmod +x "linux/$filename"
            fi
        fi
    done
fi

# Обновляем версию
echo "$NEW_VERSION" > VERSION.txt

echo -e "${GREEN}[OK] Файлы обновлены${NC}"
echo ""

# ============================================================
# STEP 8: Восстановление пользовательских данных
# ============================================================

echo -e "${CYAN}[8/10] Восстановление пользовательских данных...${NC}"
echo ""

# Восстанавливаем критические файлы из бэкапа
if [ -f "$FULL_BACKUP_DIR/backend/.env" ]; then
    cp -f "$FULL_BACKUP_DIR/backend/.env" "backend/.env"
    echo -e "   ${GREEN}✅ .env восстановлен${NC}"
fi

if [ -f "$FULL_BACKUP_DIR/backend/moonbot_commander.db" ]; then
    cp -f "$FULL_BACKUP_DIR/backend/moonbot_commander.db" "backend/moonbot_commander.db"
    echo -e "   ${GREEN}✅ База данных восстановлена${NC}"
fi

echo ""

# ============================================================
# STEP 9: Установка зависимостей и ИНТЕЛЛЕКТУАЛЬНАЯ МИГРАЦИЯ
# ============================================================

echo -e "${CYAN}[9/10] Обновление зависимостей и миграция БД...${NC}"
echo ""

cd backend

# Определяем Python команду
PYTHON_CMD="python3"
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
fi

# Обновляем pip
$PYTHON_CMD -m pip install --upgrade pip --quiet

# Устанавливаем зависимости
echo "Установка Python зависимостей..."
$PYTHON_CMD -m pip install -r requirements.txt --quiet

# ВАЖНО: Проверяем наличие intelligent_migration.py
if [ ! -f "intelligent_migration.py" ]; then
    echo ""
    echo -e "${YELLOW}[ВНИМАНИЕ] Система интеллектуальной миграции не найдена!${NC}"
    echo "Используется старый метод миграции..."
    echo ""
    
    # Старый метод - запускаем все миграции подряд
    for migration in migrate_*.py; do
        if [ -f "$migration" ]; then
            echo "   Миграция: $migration"
            $PYTHON_CMD "$migration" >/dev/null 2>&1 || true
        fi
    done
else
    echo ""
    echo "============================================================"
    echo "     ЗАПУСК ИНТЕЛЛЕКТУАЛЬНОЙ МИГРАЦИИ БД"
    echo "============================================================"
    echo ""
    
    # Запускаем интеллектуальную миграцию
    if ! $PYTHON_CMD intelligent_migration.py; then
        echo ""
        echo -e "${RED}[ОШИБКА] Миграция завершилась с ошибками!${NC}"
        echo ""
        echo "Вы можете:"
        echo "   1. Проверить файл backend/migration.log"
        echo "   2. Восстановить бэкап из $FULL_BACKUP_DIR"
        echo "   3. Обратиться в поддержку"
        echo ""
        cd ..
        exit 1
    fi
fi

cd ..

# Frontend зависимости
echo ""
echo "Обновление Frontend зависимостей..."
cd frontend

# Проверяем npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}[ВНИМАНИЕ] npm не установлен! Пропускаем обновление frontend зависимостей${NC}"
else
    npm install --silent >/dev/null 2>&1 || true
    rm -rf dist .vite 2>/dev/null || true
fi

cd ..

echo ""

# ============================================================
# STEP 10: Финализация
# ============================================================

echo -e "${CYAN}[10/10] Завершение обновления...${NC}"
echo ""

# Устанавливаем права на исполнение для всех .sh файлов
chmod +x *.sh 2>/dev/null || true
[ -d "linux" ] && chmod +x linux/*.sh 2>/dev/null || true

# Очистка временных файлов
rm -rf "$TEMP_EXTRACT"
rm -f "$TEMP_ZIP" "$TEMP_JSON" "$TEMP_RELEASES"

# ============================================================
# ГОТОВО!
# ============================================================

echo ""
echo "============================================================"
echo -e "          ${GREEN}✅ ОБНОВЛЕНИЕ УСПЕШНО ЗАВЕРШЕНО!${NC}"
echo "============================================================"
echo ""
echo "Обновлено: v$CURRENT_VERSION → v$NEW_VERSION"
echo ""
echo -e "${BLUE}📦 Полный бэкап сохранен в: $FULL_BACKUP_DIR${NC}"
echo ""
echo "Что дальше:"
echo "   1. Запустите приложение:"
echo "      - Локально: ./linux/local-start.sh"
echo "      - Сервер: sudo ./linux/server-start.sh"
echo "   2. Проверьте что все работает корректно"
echo "   3. При проблемах используйте: ./linux/rollback.sh"
echo ""
echo -e "${YELLOW}💡 Совет: Сохраните update-safe.sh для будущих обновлений!${NC}"
echo ""
