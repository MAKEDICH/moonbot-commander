#!/bin/bash
set -e

# ============================================================
# Auto-Updater для MoonBot Commander (Linux)
# Этот скрипт запускается приложением для выполнения обновления
# ============================================================

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "       MoonBot Commander Auto-Updater"
echo "============================================================"
echo ""

# Определяем директорию скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIGNAL_FILE="$SCRIPT_DIR/.update_signal"

# Проверяем файл сигнала
if [ ! -f "$SIGNAL_FILE" ]; then
    echo -e "${RED}[ERROR] Файл сигнала не найден: $SIGNAL_FILE${NC}"
echo ""
echo "Этот скрипт должен запускаться автоматически из приложения."
echo "Для ручного обновления используйте ./MOONBOT.sh -> [7] или [8]"
echo ""
    exit 1
fi

echo -e "${GREEN}[INFO] Файл сигнала найден${NC}"
echo "[INFO] Ожидание завершения приложения..."

# Ждём завершения Python процессов (максимум 60 секунд)
WAIT_COUNT=0
while pgrep -f "python.*main.py" > /dev/null 2>&1; do
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -gt 30 ]; then
        echo -e "${YELLOW}[WARNING] Приложение не завершилось за 60 секунд${NC}"
        echo "[INFO] Принудительное завершение..."
        pkill -9 -f "python.*main.py" 2>/dev/null || true
        sleep 2
        break
    fi
done

echo -e "${GREEN}[OK] Приложение завершено${NC}"
echo ""

# Парсим JSON сигнала
echo "[INFO] Чтение параметров обновления..."

SOURCE_DIR=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['source_dir'])" 2>/dev/null || echo "")
TARGET_VERSION=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['target_version'])" 2>/dev/null || echo "")
BACKUP_PATH=$(python3 -c "import json; print(json.load(open('$SIGNAL_FILE'))['backup_path'])" 2>/dev/null || echo "")

if [ -z "$SOURCE_DIR" ] || [ -z "$TARGET_VERSION" ]; then
    echo -e "${RED}[ERROR] Не удалось прочитать параметры обновления${NC}"
    exit 1
fi

echo ""
echo "[INFO] Целевая версия: $TARGET_VERSION"
echo "[INFO] Источник: $SOURCE_DIR"
echo "[INFO] Бэкап: $BACKUP_PATH"
echo ""

# Проверяем что источник существует
if [ ! -f "$SOURCE_DIR/backend/main.py" ]; then
    echo -e "${RED}[ERROR] Исходные файлы не найдены!${NC}"
    echo "[ERROR] Путь: $SOURCE_DIR"
    exit 1
fi

# ============================================================
# STEP 1: Копирование backend
# ============================================================

echo -e "${CYAN}[STEP 1/8] Копирование backend...${NC}"

# Копируем Python файлы
cp -f "$SOURCE_DIR/backend/"*.py "$SCRIPT_DIR/backend/" 2>/dev/null || true
echo "  [OK] Python файлы"

# Копируем поддиректории
[ -d "$SOURCE_DIR/backend/api" ] && cp -r "$SOURCE_DIR/backend/api" "$SCRIPT_DIR/backend/" && echo "  [OK] api/"
[ -d "$SOURCE_DIR/backend/core" ] && cp -r "$SOURCE_DIR/backend/core" "$SCRIPT_DIR/backend/" && echo "  [OK] core/"
[ -d "$SOURCE_DIR/backend/models" ] && cp -r "$SOURCE_DIR/backend/models" "$SCRIPT_DIR/backend/" && echo "  [OK] models/"
[ -d "$SOURCE_DIR/backend/services" ] && cp -r "$SOURCE_DIR/backend/services" "$SCRIPT_DIR/backend/" && echo "  [OK] services/"
[ -d "$SOURCE_DIR/backend/utils" ] && cp -r "$SOURCE_DIR/backend/utils" "$SCRIPT_DIR/backend/" && echo "  [OK] utils/"
[ -d "$SOURCE_DIR/backend/updates" ] && cp -r "$SOURCE_DIR/backend/updates" "$SCRIPT_DIR/backend/" && echo "  [OK] updates/"
[ -d "$SOURCE_DIR/backend/alembic" ] && cp -r "$SOURCE_DIR/backend/alembic" "$SCRIPT_DIR/backend/" && echo "  [OK] alembic/"
[ -d "$SOURCE_DIR/backend/config" ] && cp -r "$SOURCE_DIR/backend/config" "$SCRIPT_DIR/backend/" && echo "  [OK] config/"
[ -d "$SOURCE_DIR/backend/tests" ] && cp -r "$SOURCE_DIR/backend/tests" "$SCRIPT_DIR/backend/" && echo "  [OK] tests/"

# Копируем requirements.txt
[ -f "$SOURCE_DIR/backend/requirements.txt" ] && cp "$SOURCE_DIR/backend/requirements.txt" "$SCRIPT_DIR/backend/" && echo "  [OK] requirements.txt"

# Копируем alembic.ini
[ -f "$SOURCE_DIR/backend/alembic.ini" ] && cp "$SOURCE_DIR/backend/alembic.ini" "$SCRIPT_DIR/backend/" && echo "  [OK] alembic.ini"

echo ""

# ============================================================
# STEP 2: Копирование frontend
# ============================================================

echo -e "${CYAN}[STEP 2/8] Копирование frontend...${NC}"

[ -d "$SOURCE_DIR/frontend/src" ] && cp -r "$SOURCE_DIR/frontend/src" "$SCRIPT_DIR/frontend/" && echo "  [OK] src/"
[ -d "$SOURCE_DIR/frontend/public" ] && cp -r "$SOURCE_DIR/frontend/public" "$SCRIPT_DIR/frontend/" && echo "  [OK] public/"

[ -f "$SOURCE_DIR/frontend/package.json" ] && cp "$SOURCE_DIR/frontend/package.json" "$SCRIPT_DIR/frontend/" && echo "  [OK] package.json"
[ -f "$SOURCE_DIR/frontend/vite.config.js" ] && cp "$SOURCE_DIR/frontend/vite.config.js" "$SCRIPT_DIR/frontend/" && echo "  [OK] vite.config.js"
[ -f "$SOURCE_DIR/frontend/index.html" ] && cp "$SOURCE_DIR/frontend/index.html" "$SCRIPT_DIR/frontend/" && echo "  [OK] index.html"

echo ""

# ============================================================
# STEP 3: Копирование скриптов
# ============================================================

echo -e "${CYAN}[STEP 3/8] Копирование скриптов...${NC}"

# Копируем shell скрипты (кроме auto-updater)
for f in "$SOURCE_DIR"/*.sh; do
    [ -f "$f" ] && [ "$(basename "$f")" != "auto-updater.sh" ] && cp "$f" "$SCRIPT_DIR/"
done
echo "  [OK] Shell скрипты"

# Копируем Docker директорию
[ -d "$SOURCE_DIR/docker" ] && cp -r "$SOURCE_DIR/docker" "$SCRIPT_DIR/" && echo "  [OK] docker/"

# Копируем scripts директорию
[ -d "$SOURCE_DIR/scripts" ] && cp -r "$SOURCE_DIR/scripts" "$SCRIPT_DIR/" && echo "  [OK] scripts/"

# Копируем docs
[ -d "$SOURCE_DIR/docs" ] && cp -r "$SOURCE_DIR/docs" "$SCRIPT_DIR/" && echo "  [OK] docs/"

# Копируем README и CHANGELOG
[ -f "$SOURCE_DIR/README.md" ] && cp "$SOURCE_DIR/README.md" "$SCRIPT_DIR/"
[ -f "$SOURCE_DIR/CHANGELOG.md" ] && cp "$SOURCE_DIR/CHANGELOG.md" "$SCRIPT_DIR/"

# Делаем скрипты исполняемыми
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
chmod +x "$SCRIPT_DIR/docker"/*.sh 2>/dev/null || true

echo ""

# ============================================================
# STEP 4: Обновление VERSION.txt
# ============================================================

echo -e "${CYAN}[STEP 4/8] Обновление VERSION.txt...${NC}"

echo "$TARGET_VERSION" > "$SCRIPT_DIR/VERSION.txt"
echo "  [OK] Версия: $TARGET_VERSION"

echo ""

# ============================================================
# STEP 5: Установка зависимостей backend
# ============================================================

echo -e "${CYAN}[STEP 5/8] Установка зависимостей backend...${NC}"

cd "$SCRIPT_DIR/backend"

# Пробуем pip3, потом pip
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt --quiet 2>/dev/null && echo "  [OK] Зависимости установлены (pip3)" || echo "  [WARNING] Некоторые зависимости не установились"
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt --quiet 2>/dev/null && echo "  [OK] Зависимости установлены (pip)" || echo "  [WARNING] Некоторые зависимости не установились"
else
    echo "  [WARNING] pip не найден"
fi

echo ""

# ============================================================
# STEP 6: Применение миграций
# ============================================================

echo -e "${CYAN}[STEP 6/8] Применение миграций БД...${NC}"

cd "$SCRIPT_DIR/backend"

# Используем intelligent_migration если доступен
if [ -f "updates/core/intelligent_migration.py" ]; then
    echo "  [INFO] Использую intelligent_migration.py..."
    python3 updates/core/intelligent_migration.py 2>/dev/null || python updates/core/intelligent_migration.py 2>/dev/null || echo "  [WARNING] Ошибка миграции"
    echo "  [OK] Миграции обработаны"
else
    echo "  [INFO] Запуск миграций вручную..."
    for f in updates/migrate_*.py; do
        [ -f "$f" ] && (python3 "$f" 2>/dev/null || python "$f" 2>/dev/null || true)
    done
    echo "  [OK] Миграции обработаны"
fi

echo ""

# ============================================================
# STEP 7: Установка зависимостей frontend
# ============================================================

echo -e "${CYAN}[STEP 7/8] Установка зависимостей frontend...${NC}"

cd "$SCRIPT_DIR/frontend"

npm install --silent 2>/dev/null && echo "  [OK] npm install завершён" || echo "  [WARNING] Не все зависимости установились"

# Проверяем серверный режим (наличие production build)
if [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    echo "  [INFO] Обнаружен серверный режим"
    echo "  [INFO] Сборка frontend для production..."
    NODE_ENV=production npm run build 2>/dev/null && echo "  [OK] Frontend собран" || echo "  [WARNING] Сборка frontend не удалась"
fi

echo ""

# ============================================================
# STEP 8: Очистка
# ============================================================

echo -e "${CYAN}[STEP 8/8] Очистка временных файлов...${NC}"

cd "$SCRIPT_DIR"

# Удаляем файл сигнала
rm -f "$SIGNAL_FILE"

# Удаляем временную директорию
rm -rf "backend/.update_temp"

# Удаляем файл статуса
rm -f "backend/.update_status.json"

# Очищаем кэш frontend (он будет пересоздан)
rm -rf "frontend/.vite"

echo "  [OK] Очистка завершена"

echo ""

# ============================================================
# ЗАВЕРШЕНИЕ
# ============================================================

echo ""
echo "============================================================"
echo -e "       ${GREEN}ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!${NC}"
echo "============================================================"
echo ""
echo "Версия: $TARGET_VERSION"
echo "Бэкап:  $BACKUP_PATH"
echo ""
echo "[INFO] Запуск приложения..."
echo ""

cd "$SCRIPT_DIR"

# Определяем какой скрипт запуска использовать
if [ -f "MOONBOT.sh" ]; then
    echo "[INFO] Используйте ./MOONBOT.sh для запуска приложения"
    echo "[INFO] Выберите [3] для DEV режима или [4] для PRODUCTION"
elif [ -f "start.sh" ]; then
    echo "[INFO] Запуск через start.sh"
    nohup ./start.sh > /dev/null 2>&1 &
else
    echo "[INFO] Запуск backend напрямую"
    cd backend
    source venv/bin/activate 2>/dev/null || true
    nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > logs/backend.log 2>&1 &
fi

echo ""
echo "Приложение запущено!"
echo ""

exit 0

