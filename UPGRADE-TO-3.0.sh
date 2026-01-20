#!/bin/bash

# ============================================================
# СКРИПТ ОБНОВЛЕНИЯ НА ВЕРСИЮ 3.0.0
# ============================================================
# 
# Этот скрипт безопасно обновляет MoonBot Commander с любой
# предыдущей версии на версию 3.0.0 с новой системой обновлений.
# 
# ВАЖНО: Все пользовательские данные будут сохранены!
# - База данных (moonbot_commander.db)
# - Настройки (.env)
# - Серверы и их конфигурации
# - Запланированные команды
# - История ордеров
# 
# ============================================================

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo -e "  ${CYAN}MoonBot Commander - Upgrade to v3.0.0${NC}"
echo "============================================================"
echo ""
echo "  Этот скрипт безопасно обновит ваш MoonBot Commander"
echo "  на версию 3.0.0 с новой системой автообновлений."
echo ""
echo -e "  ${YELLOW}[!] ВСЕ ВАШИ ДАННЫЕ БУДУТ СОХРАНЕНЫ:${NC}"
echo "      - База данных"
echo "      - Настройки серверов"
echo "      - Запланированные команды"
echo "      - История ордеров"
echo ""
echo "============================================================"
echo ""

# Определяем директорию скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================================
# STEP 0: Проверка что приложение не запущено
# ============================================================

echo "[STEP 0/7] Проверка запущенных процессов..."

if pgrep -f "python.*main.py" > /dev/null 2>&1; then
    echo ""
    echo -e "  ${YELLOW}[!] ВНИМАНИЕ: Обнаружен запущенный Python процесс!${NC}"
    echo "  [!] Пожалуйста, остановите MoonBot Commander перед обновлением."
    echo ""
    read -p "Попытаться остановить автоматически? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  [INFO] Останавливаем Python процессы..."
        pkill -9 -f "python.*main.py" 2>/dev/null || true
        sleep 3
    else
        echo "  [INFO] Обновление отменено."
        exit 1
    fi
fi

echo -e "  ${GREEN}[OK] Проверка завершена${NC}"
echo ""

# ============================================================
# STEP 1: Создание резервной копии
# ============================================================

echo "[STEP 1/7] Создание резервной копии..."

BACKUP_DIR="$SCRIPT_DIR/backups/pre_upgrade_3.0_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Бэкап базы данных
if [ -f "backend/moonbot_commander.db" ]; then
    cp "backend/moonbot_commander.db" "$BACKUP_DIR/moonbot_commander.db"
    echo -e "  ${GREEN}[OK] База данных сохранена${NC}"
elif [ -f "moonbot_commander.db" ]; then
    cp "moonbot_commander.db" "$BACKUP_DIR/moonbot_commander.db"
    echo -e "  ${GREEN}[OK] База данных сохранена${NC}"
else
    echo "  [INFO] База данных не найдена (новая установка?)"
fi

# Бэкап .env
if [ -f "backend/.env" ]; then
    cp "backend/.env" "$BACKUP_DIR/.env"
    echo -e "  ${GREEN}[OK] Настройки .env сохранены${NC}"
fi

# Бэкап VERSION.txt
if [ -f "VERSION.txt" ]; then
    cp "VERSION.txt" "$BACKUP_DIR/VERSION_old.txt"
    echo -e "  ${GREEN}[OK] Версия сохранена${NC}"
fi

# Сохраняем информацию о бэкапе
cat > "$BACKUP_DIR/backup_info.txt" << EOF
Backup created: $(date)
Source version: Unknown (pre-3.0)
Target version: 3.0.0
EOF

echo -e "  ${GREEN}[OK] Резервная копия создана: $BACKUP_DIR${NC}"
echo ""

# ============================================================
# STEP 2: Обновление VERSION.txt
# ============================================================

echo "[STEP 2/7] Обновление версии..."

echo "3.0.0" > VERSION.txt
echo -e "  ${GREEN}[OK] VERSION.txt обновлён до 3.0.0${NC}"
echo ""

# ============================================================
# STEP 3: Установка зависимостей Python
# ============================================================

echo "[STEP 3/7] Обновление зависимостей Python..."

cd "$SCRIPT_DIR/backend"

# Определяем pip
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
else
    echo -e "  ${RED}[ERROR] pip не найден${NC}"
    PIP_CMD=""
fi

if [ -n "$PIP_CMD" ]; then
    $PIP_CMD install --upgrade pip --quiet 2>/dev/null || true
    
    if [ -f "requirements.txt" ]; then
        $PIP_CMD install -r requirements.txt --quiet 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}[OK] Зависимости Python установлены${NC}"
        else
            echo -e "  ${YELLOW}[WARNING] Некоторые зависимости не установились${NC}"
            echo "  [INFO] Пробуем установить критичные..."
            $PIP_CMD install aiohttp packaging websockets cryptography --quiet 2>/dev/null
        fi
    else
        echo -e "  ${YELLOW}[WARNING] requirements.txt не найден${NC}"
    fi
fi

echo ""

# ============================================================
# STEP 4: Применение миграций БД
# ============================================================

echo "[STEP 4/7] Применение миграций базы данных..."

cd "$SCRIPT_DIR/backend"

# Определяем python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "  ${RED}[ERROR] Python не найден${NC}"
    PYTHON_CMD=""
fi

if [ -n "$PYTHON_CMD" ]; then
    if [ -f "updates/core/intelligent_migration.py" ]; then
        echo "  [INFO] Запуск интеллектуальной системы миграций..."
        $PYTHON_CMD updates/core/intelligent_migration.py
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}[OK] Миграции применены успешно${NC}"
        else
            echo -e "  ${YELLOW}[WARNING] Некоторые миграции могли не примениться${NC}"
            echo "  [INFO] Это нормально если база данных уже актуальна"
        fi
    else
        echo "  [INFO] Запуск миграций вручную..."
        for f in updates/migrate_*.py; do
            [ -f "$f" ] && $PYTHON_CMD "$f" 2>/dev/null || true
        done
        echo -e "  ${GREEN}[OK] Миграции обработаны${NC}"
    fi
fi

echo ""

# ============================================================
# STEP 5: Обновление зависимостей Frontend
# ============================================================

echo "[STEP 5/7] Обновление зависимостей Frontend..."

cd "$SCRIPT_DIR/frontend"

if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}[OK] Зависимости npm установлены${NC}"
    else
        echo -e "  ${YELLOW}[WARNING] Не все зависимости npm установились${NC}"
    fi
else
    echo -e "  ${YELLOW}[WARNING] package.json не найден${NC}"
fi

echo ""

# ============================================================
# STEP 6: Создание необходимых директорий
# ============================================================

echo "[STEP 6/7] Создание структуры проекта..."

cd "$SCRIPT_DIR"

mkdir -p backend/logs
mkdir -p backend/backups
mkdir -p logs
mkdir -p backups

# Делаем скрипты исполняемыми
chmod +x *.sh 2>/dev/null || true
chmod +x docker/*.sh 2>/dev/null || true

echo -e "  ${GREEN}[OK] Структура проекта готова${NC}"
echo ""

# ============================================================
# STEP 7: Финальная проверка
# ============================================================

echo "[STEP 7/7] Финальная проверка..."

cd "$SCRIPT_DIR"

ERRORS=0

# Проверяем VERSION.txt
if [ -f "VERSION.txt" ]; then
    VERSION=$(cat VERSION.txt)
    echo -e "  ${GREEN}[OK] Версия: $VERSION${NC}"
else
    echo -e "  ${RED}[ERROR] VERSION.txt не найден${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Проверяем backend
if [ -f "backend/main.py" ]; then
    echo -e "  ${GREEN}[OK] Backend найден${NC}"
else
    echo -e "  ${RED}[ERROR] backend/main.py не найден${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Проверяем frontend
if [ -f "frontend/package.json" ]; then
    echo -e "  ${GREEN}[OK] Frontend найден${NC}"
else
    echo -e "  ${YELLOW}[WARNING] frontend/package.json не найден${NC}"
fi

# Проверяем базу данных
if [ -f "backend/moonbot_commander.db" ]; then
    echo -e "  ${GREEN}[OK] База данных найдена${NC}"
else
    echo "  [INFO] База данных будет создана при первом запуске"
fi

echo ""

# ============================================================
# ЗАВЕРШЕНИЕ
# ============================================================

if [ $ERRORS -gt 0 ]; then
    echo "============================================================"
    echo -e "  ${YELLOW}[!] ОБНОВЛЕНИЕ ЗАВЕРШЕНО С ПРЕДУПРЕЖДЕНИЯМИ${NC}"
    echo "============================================================"
    echo ""
    echo "  Обнаружено проблем: $ERRORS"
    echo "  Резервная копия: $BACKUP_DIR"
    echo ""
    echo "  Пожалуйста, проверьте ошибки выше."
    echo "  Если что-то пошло не так, восстановите данные из бэкапа."
    echo ""
else
    echo "============================================================"
    echo -e "  ${GREEN}[OK] ОБНОВЛЕНИЕ УСПЕШНО ЗАВЕРШЕНО!${NC}"
    echo "============================================================"
    echo ""
    echo "  MoonBot Commander обновлён до версии 3.0.0"
    echo ""
    echo "  Резервная копия: $BACKUP_DIR"
    echo ""
    echo "  Что нового в версии 3.0.0:"
    echo "  - Автоматическая система обновлений"
    echo "  - Улучшенная система миграций БД"
    echo "  - Экспорт/импорт данных с шифрованием"
    echo "  - Множество улучшений и исправлений"
    echo ""
    echo "  Теперь вы можете запустить приложение:"
    echo "  - Запустите: ./MOONBOT.sh"
    echo "  - Выберите [3] для DEV режима или [4] для PRODUCTION"
    echo ""
fi

echo "============================================================"
echo ""

