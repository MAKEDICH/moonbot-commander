# 🐧 MoonBot Commander - Установка на Linux

## Содержание

- [Быстрая установка](#-быстрая-установка)
- [Требования](#требования)
- [Пошаговая установка](#пошаговая-установка)
- [Режимы работы](#режимы-работы)
- [Управление приложением](#управление-приложением)
- [Решение проблем](#решение-проблем)

---

## 🚀 Быстрая установка

### Один скрипт для всего

```bash
# Скачайте проект
git clone https://github.com/MAKEDICH/moonbot-commander.git
cd moonbot-commander

# Запустите установщик
chmod +x install.sh
./install.sh
```

Установщик автоматически:
- Определит вашу ОС (Ubuntu, Debian, CentOS, Fedora, Arch)
- Установит Python 3.11 и Node.js 20
- Настроит все зависимости
- Создаст виртуальное окружение
- Применит миграции базы данных
- Настроит firewall (для сервера)
- Создаст systemd сервисы (для сервера)

---

## Требования

### Поддерживаемые ОС

| ОС | Версия | Статус |
|---|---|---|
| Ubuntu | 20.04+ | ✅ Полная поддержка |
| Debian | 10+ | ✅ Полная поддержка |
| CentOS | 8+ | ✅ Полная поддержка |
| Fedora | 35+ | ✅ Полная поддержка |
| Arch Linux | Latest | ✅ Полная поддержка |

### Минимальные требования

- **CPU**: 1 ядро
- **RAM**: 1 GB
- **Диск**: 500 MB свободного места
- **Сеть**: Доступ к интернету для установки

### Рекомендуемые требования (для сервера)

- **CPU**: 2+ ядра
- **RAM**: 2+ GB
- **Диск**: 2+ GB свободного места

### Для высоких нагрузок (3000+ серверов)

- **CPU**: 8+ ядер
- **RAM**: 16+ GB
- **Диск**: 100+ GB SSD
- **Опционально**: PostgreSQL 15+, Redis 7+

> **Примечание**: Оптимизации для высоких нагрузок применяются автоматически при запуске в production режиме (опция [4]).

---

## Пошаговая установка

### Вариант 1: Автоматическая установка (рекомендуется)

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/MAKEDICH/moonbot-commander.git
cd moonbot-commander

# 2. Сделайте скрипты исполняемыми
chmod +x install.sh MOONBOT.sh

# 3. Запустите установщик
./install.sh

# 4. Выберите тип установки:
#    [1] LOCAL - для разработки
#    [2] SERVER - для production сервера
#    [3] DOCKER - через Docker
```

### Вариант 2: Ручная установка

#### Шаг 1: Установка зависимостей

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip nodejs npm curl git
```

**CentOS/Fedora:**
```bash
sudo dnf install -y python3.11 python3.11-devel nodejs npm curl git
```

**Arch Linux:**
```bash
sudo pacman -S python python-pip nodejs npm curl git
```

#### Шаг 2: Настройка Backend

```bash
cd backend

# Создайте виртуальное окружение
python3 -m venv venv

# Активируйте его
source venv/bin/activate

# Установите зависимости
pip install -r requirements.txt

# Инициализируйте безопасность
python utils/init_security.py

# Примените миграции
python updates/core/intelligent_migration.py

# Деактивируйте venv
deactivate
```

#### Шаг 3: Настройка Frontend

```bash
cd frontend

# Установите зависимости
npm install

# Для production: соберите приложение
npm run build
```

---

## Режимы работы

### 🔧 LOCAL Mode (для разработки)

```bash
# Через меню
./MOONBOT.sh
# Выберите [3] Start DEV mode

# Или напрямую
cd backend
source venv/bin/activate
export MOONBOT_MODE=local
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
python -m services.scheduler &
deactivate

cd ../frontend
npm run dev
```

**Особенности LOCAL режима:**
- Hot reload для разработки
- Debug режим
- Эфемерные UDP порты
- Keep-alive включен

### 🚀 SERVER Mode (для production)

```bash
# Через меню
./MOONBOT.sh
# Выберите [4] Start PRODUCTION mode

# Или через systemd (рекомендуется)
sudo systemctl start moonbot-backend moonbot-scheduler moonbot-frontend
sudo systemctl enable moonbot-backend moonbot-scheduler moonbot-frontend
```

**Особенности SERVER режима:**
- Оптимизированная сборка
- Фиксированный UDP порт 2500
- Keep-alive отключен
- Production frontend

---

## Управление приложением

### Через интерактивное меню

```bash
./MOONBOT.sh
```

Меню позволяет:
- Запускать/останавливать приложение
- Проверять статус
- Управлять миграциями
- Обновлять приложение

### Через systemd (для сервера)

```bash
# Запуск
sudo systemctl start moonbot-backend
sudo systemctl start moonbot-scheduler
sudo systemctl start moonbot-frontend

# Остановка
sudo systemctl stop moonbot-backend
sudo systemctl stop moonbot-scheduler
sudo systemctl stop moonbot-frontend

# Статус
sudo systemctl status moonbot-backend

# Логи
sudo journalctl -u moonbot-backend -f

# Автозапуск при загрузке
sudo systemctl enable moonbot-backend moonbot-scheduler moonbot-frontend
```

### Порты

| Сервис | Порт | Описание |
|---|---|---|
| Frontend | 3000 | Веб-интерфейс |
| Backend | 8000 | API сервер |
| UDP | 2500 | Команды ботам (server mode) |

---

## Решение проблем

### ❌ "Permission denied" при запуске скриптов

```bash
chmod +x install.sh MOONBOT.sh start.sh
```

### ❌ Python не найден

```bash
# Ubuntu/Debian
sudo apt install python3.11 python3.11-venv

# CentOS/Fedora
sudo dnf install python3.11

# Проверка
python3 --version
```

### ❌ Node.js не найден

```bash
# Установка через NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Проверка
node --version
npm --version
```

### ❌ Порты заняты

```bash
# Найти процессы
sudo lsof -i :3000
sudo lsof -i :8000

# Остановить все процессы MoonBot
./MOONBOT.sh
# Выберите [5] Stop all processes

# Или вручную
pkill -f "uvicorn"
pkill -f "node"
```

### ❌ Ошибки миграции

```bash
# Проверьте логи
cat backend/updates/logs/migration.log

# Откат на предыдущую версию
./linux/rollback.sh
```

### ❌ Frontend не загружается

```bash
cd frontend

# Очистите кэш
rm -rf node_modules dist .vite

# Переустановите
npm install

# Для production
npm run build
```

### ❌ Firewall блокирует подключения

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw status

# Firewalld (CentOS/Fedora)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

---

## Обновление

### Автоматическое обновление

```bash
./MOONBOT.sh
# Выберите [7] Check for updates
```

### Ручное обновление

```bash
# Создайте бэкап
cp -r backend/moonbot_commander.db backup_db.db

# Обновите код
git pull

# Переустановите зависимости
cd backend
source venv/bin/activate
pip install -r requirements.txt
python updates/core/intelligent_migration.py
deactivate

cd ../frontend
npm install
npm run build  # для production
```

---

## 🚀 Режим высокой нагрузки (3000+ серверов)

Для работы с большим количеством серверов (3000+) используйте специальный режим:

### Быстрый старт

```bash
./MOONBOT.sh
# Выберите [H] High-Load setup (3000+ servers)
# Затем [P] Start HIGH-LOAD mode
```

### Что включает High-Load режим

1. **База данных**:
   - PostgreSQL вместо SQLite (рекомендуется)
   - Connection pooling (50 соединений + 100 overflow)
   - Оптимизированные индексы

2. **Обработка UDP**:
   - Worker Pool (16 воркеров)
   - Очередь на 50000 сообщений
   - Batch-обработка для БД

3. **WebSocket**:
   - Батчинг сообщений
   - Gzip сжатие
   - Rate limiting

4. **Кэширование**:
   - Redis для распределённого кэша
   - Fallback на in-memory

5. **Мониторинг**:
   - `/api/metrics/all` - все метрики
   - `/api/metrics/system` - CPU, RAM, диск
   - `/api/metrics/servers-load` - нагрузка серверов

### Рекомендуемые требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 8 ядер | 16+ ядер |
| RAM | 16 GB | 32+ GB |
| Диск | 100 GB SSD | 500+ GB NVMe |
| Сеть | 1 Gbps | 10 Gbps |

### Установка PostgreSQL и Redis

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib redis-server

# Создание БД
sudo -u postgres psql
CREATE DATABASE moonbot;
CREATE USER moonbot WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE moonbot TO moonbot;
\q

# Настройка переменных
export DATABASE_URL="postgresql://moonbot:your_password@localhost:5432/moonbot"
export REDIS_URL="redis://localhost:6379/0"
```

Подробнее: [HIGH-LOAD-GUIDE.md](HIGH-LOAD-GUIDE.md)

---

## Контакты

- **GitHub**: https://github.com/MAKEDICH/moonbot-commander
- **Telegram**: @MAKEDICH
- **Группа**: https://t.me/+HfcEre3V6gsxNTUy

