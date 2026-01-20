# 🐳 MoonBot Commander - Установка через Docker

## Содержание

- [Быстрый старт](#-быстрый-старт)
- [Требования](#требования)
- [Установка Docker](#установка-docker)
- [Запуск приложения](#запуск-приложения)
- [Конфигурация](#конфигурация)
- [Управление контейнерами](#управление-контейнерами)
- [Решение проблем](#решение-проблем)

---

## 🚀 Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/MAKEDICH/moonbot-commander.git
cd moonbot-commander

# 2. Запустите через Docker Compose
cd docker
docker compose up -d

# 3. Откройте в браузере
# http://localhost:3000
```

**Всё!** Приложение запущено и готово к работе.

---

## Требования

### Docker

- Docker Engine 20.10+
- Docker Compose v2.0+ (или docker-compose 1.29+)

### Ресурсы

| Ресурс | Минимум | Рекомендуется |
|---|---|---|
| CPU | 1 ядро | 2+ ядра |
| RAM | 1 GB | 2+ GB |
| Диск | 1 GB | 2+ GB |

---

## Установка Docker

### Ubuntu/Debian

```bash
# Обновите пакеты
sudo apt update

# Установите зависимости
sudo apt install -y ca-certificates curl gnupg lsb-release

# Добавьте GPG ключ Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавьте репозиторий
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установите Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER

# Перезайдите в систему или выполните
newgrp docker

# Проверьте установку
docker --version
docker compose version
```

### CentOS/Fedora

```bash
# Установите зависимости
sudo dnf install -y dnf-plugins-core

# Добавьте репозиторий Docker
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo

# Установите Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Запустите Docker
sudo systemctl start docker
sudo systemctl enable docker

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker
```

### Arch Linux

```bash
sudo pacman -S docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## Запуск приложения

### Способ 1: Через скрипт (рекомендуется)

```bash
cd docker

# Запуск
./docker-start.sh

# Запуск с пересборкой образов
./docker-start.sh --build

# Остановка
./docker-stop.sh

# Остановка с удалением данных
./docker-stop.sh --clean
```

### Способ 2: Через docker compose

```bash
cd docker

# Запуск в фоне
docker compose up -d

# Запуск с логами в консоли
docker compose up

# Остановка
docker compose down

# Пересборка образов
docker compose build --no-cache
docker compose up -d
```

### Способ 3: Через универсальный установщик

```bash
chmod +x install.sh
./install.sh
# Выберите [3] DOCKER
```

---

## Конфигурация

### Безопасность (автоматически)

При первом запуске контейнера автоматически генерируются:
- `SECRET_KEY` - ключ для JWT токенов
- `ENCRYPTION_KEY` - ключ для шифрования паролей

Эти ключи сохраняются в Docker volume `moonbot-data` и переиспользуются при перезапуске.

> ⚠️ **Важно:** Не удаляйте volume `moonbot-data` - это приведёт к потере ключей и невозможности расшифровать существующие данные!

### Переменные окружения (опционально)

Скопируйте `env.example` в `.env` и настройте:

```bash
cd docker
cp env.example .env
nano .env
```

**Основные переменные:**

```env
# Режим работы
MOONBOT_MODE=server

# CORS (добавьте ваш домен)
CORS_ORIGINS=http://localhost:3000,http://yourdomain.com:3000

# API URL для frontend
VITE_API_URL=http://localhost:8000

# Порты
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### Изменение портов

В `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Изменить внешний порт на 8080
  
  frontend:
    ports:
      - "80:3000"    # Изменить внешний порт на 80
```

### Использование внешней базы данных

По умолчанию используется SQLite в Docker volume. Для PostgreSQL:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/moonbot
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=moonbot
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

---

## Управление контейнерами

### Просмотр статуса

```bash
# Список контейнеров
docker ps --filter "name=moonbot"

# Подробный статус
docker compose ps
```

### Логи

```bash
# Все логи
docker compose logs

# Логи в реальном времени
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f scheduler
```

### Перезапуск

```bash
# Перезапуск всех сервисов
docker compose restart

# Перезапуск конкретного сервиса
docker compose restart backend
```

### Обновление

```bash
# 1. Остановите контейнеры
docker compose down

# 2. Обновите код
cd ..
git pull

# 3. Пересоберите образы
cd docker
docker compose build --no-cache

# 4. Запустите
docker compose up -d
```

### Бэкап данных

```bash
# Бэкап базы данных
docker cp moonbot-backend:/app/data/moonbot_commander.db ./backup.db

# Восстановление
docker cp ./backup.db moonbot-backend:/app/data/moonbot_commander.db
docker compose restart backend
```

---

## Решение проблем

### ❌ Docker не запускается

```bash
# Проверьте статус
sudo systemctl status docker

# Запустите Docker
sudo systemctl start docker

# Проверьте права
groups $USER
# Должна быть группа docker
```

### ❌ "permission denied" при работе с Docker

```bash
# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER

# Перезайдите в систему или
newgrp docker
```

### ❌ Порты заняты

```bash
# Найдите процесс
sudo lsof -i :3000
sudo lsof -i :8000

# Измените порты в docker-compose.yml
```

### ❌ Контейнер не запускается

```bash
# Проверьте логи
docker compose logs backend

# Пересоберите образ
docker compose build --no-cache backend
docker compose up -d
```

### ❌ База данных не сохраняется

Убедитесь, что volume создан:

```bash
docker volume ls | grep moonbot

# Если нет - пересоздайте
docker compose down -v
docker compose up -d
```

### ❌ Frontend не подключается к Backend

1. Проверьте, что backend работает:
```bash
curl http://localhost:8000/health
```

2. Проверьте CORS настройки в `.env`

3. Проверьте сеть Docker:
```bash
docker network inspect docker_moonbot-network
```

---

## Продвинутые настройки

### Nginx Reverse Proxy

Для использования с доменом:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL с Let's Encrypt

```bash
# Установите certbot
sudo apt install certbot python3-certbot-nginx

# Получите сертификат
sudo certbot --nginx -d yourdomain.com
```

### Docker Swarm (для кластера)

```bash
# Инициализация Swarm
docker swarm init

# Деплой стека
docker stack deploy -c docker-compose.yml moonbot
```

---

## Контакты

- **GitHub**: https://github.com/MAKEDICH/moonbot-commander
- **Telegram**: @MAKEDICH
- **Группа**: https://t.me/+HfcEre3V6gsxNTUy

