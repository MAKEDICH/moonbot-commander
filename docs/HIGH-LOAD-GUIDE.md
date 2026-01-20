# Руководство по масштабированию MoonBot Commander

## Обзор

MoonBot Commander оптимизирован для работы с **3000+ серверами из коробки**.

### ⚡ HIGH-LOAD MODE: Включён во ВСЕХ режимах!

Высокомощные оптимизации работают **автоматически** во всех режимах:
- ✅ **Local** (разработка)
- ✅ **Server** (production)
- ✅ **Dev mode** (npm run dev)
- ✅ **Production mode** (gunicorn/uvicorn)

При запуске автоматически:
- **32 UDP Worker Pool потока** для параллельной обработки сообщений
- **Batch Processor** группирует до 1000 записей для оптимизации БД
- Применяются индексы БД для высокой производительности
- Инициализируется Redis кэш (с fallback на in-memory)
- Очередь сообщений на **50,000 элементов** для обработки burst нагрузки
- Запускается **минимум 17 Uvicorn воркеров** в production

### Расчётная пропускная способность

| Параметр | Значение |
|----------|----------|
| UDP Worker Pool | 32 потока |
| Очередь сообщений | 50,000 |
| Batch размер | 1,000 записей |
| Пропускная способность | ~3,200 msg/sec |
| Макс. серверов | ~10,000+ |
| Утилизация при 3000 серверах | ~28% |

Это руководство описывает **дополнительные** настройки для максимальной производительности.

## Режимы работы

### Local vs Server

MoonBot Commander поддерживает два режима работы:

| Режим | MOONBOT_MODE | Описание |
|-------|--------------|----------|
| Local | `local` | Для разработки. Ephemeral UDP порты, keep-alive включён |
| Server | `server` | Для production. Global UDP socket, keep-alive выключен |

Режим устанавливается автоматически при запуске через скрипты:
- **[3] Start DEV** → `MOONBOT_MODE=local`
- **[4] Start PRODUCTION** → `MOONBOT_MODE=server`

## Требования к инфраструктуре

### Минимальные требования для 3000 серверов

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 8 ядер | 16+ ядер |
| RAM | 16 GB | 32+ GB |
| Диск | 100 GB SSD | 500+ GB NVMe |
| Сеть | 1 Gbps | 10 Gbps |

### Рекомендуемый стек

- **ОС**: Ubuntu 22.04 LTS или Debian 12
- **БД**: PostgreSQL 15+ (вместо SQLite)
- **Кэш**: Redis 7+
- **Reverse Proxy**: Nginx с HTTP/2

## Настройка базы данных

### Переход на PostgreSQL

1. Установите PostgreSQL:
```bash
sudo apt install postgresql postgresql-contrib
```

2. Создайте базу данных:
```bash
sudo -u postgres psql
CREATE DATABASE moonbot;
CREATE USER moonbot WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE moonbot TO moonbot;
```

3. Настройте переменную окружения:
```bash
export DATABASE_URL="postgresql://moonbot:your_secure_password@localhost:5432/moonbot"
```

### Оптимизация PostgreSQL

Добавьте в `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Память
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 256MB
maintenance_work_mem = 1GB

# Соединения
max_connections = 200

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB

# Параллельные запросы
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

## Настройка Redis

### Установка

```bash
sudo apt install redis-server
```

### Конфигурация

Добавьте в `/etc/redis/redis.conf`:

```ini
# Память
maxmemory 2gb
maxmemory-policy allkeys-lru

# Сеть
tcp-keepalive 300
timeout 0

# Производительность
tcp-backlog 511
```

### Переменная окружения

```bash
export REDIS_URL="redis://localhost:6379/0"
```

## Настройка Uvicorn

### Запуск с несколькими воркерами

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 9 --limit-concurrency 1000 --backlog 2048
```

### Systemd сервис

```ini
[Unit]
Description=MoonBot Commander Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=moonbot
WorkingDirectory=/opt/moonbot/backend
Environment=MOONBOT_MODE=server
Environment=DATABASE_URL=postgresql://moonbot:password@localhost:5432/moonbot
Environment=REDIS_URL=redis://localhost:6379/0
ExecStart=/opt/moonbot/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 9 --limit-concurrency 1000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Настройка Nginx

### Конфигурация

```nginx
upstream moonbot_backend {
    least_conn;
    server 127.0.0.1:8000;
    keepalive 64;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name moonbot.example.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/moonbot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/moonbot.example.com/privkey.pem;

    # Буферы
    client_max_body_size 100M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # Таймауты
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 300s;

    # API
    location /api {
        proxy_pass http://moonbot_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://moonbot_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Frontend
    location / {
        root /opt/moonbot/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Настройка системы

### Лимиты файлов

Добавьте в `/etc/security/limits.conf`:

```
moonbot soft nofile 65535
moonbot hard nofile 65535
moonbot soft nproc 65535
moonbot hard nproc 65535
```

### Сетевые настройки

Добавьте в `/etc/sysctl.conf`:

```ini
# Сеть
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# UDP
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384
```

Примените: `sudo sysctl -p`

## Мониторинг

### Эндпоинты метрик

- `/api/metrics/system` - системные метрики (CPU, RAM, диск)
- `/api/metrics/database` - метрики БД (пул соединений, таблицы)
- `/api/metrics/websocket` - метрики WebSocket
- `/api/metrics/udp` - метрики UDP обработки (Worker Pool, Batch Processor)
- `/api/metrics/redis` - метрики Redis кэша
- `/api/metrics/capacity` - **оценка пропускной способности и рекомендации**
- `/api/metrics/servers-load` - статистика нагрузки по серверам
- `/api/metrics/all` - все метрики

### Метрики для 3000+ серверов

Эндпоинт `/api/metrics/capacity` показывает:
- `current_servers` - текущее количество серверов
- `max_servers_estimate` - максимум серверов, которые система может обработать
- `headroom_percent` - запас пропускной способности (%)
- `can_handle_3000_servers` - готовность к 3000 серверам
- `recommendations` - рекомендации по оптимизации

Эндпоинт `/api/metrics/udp` показывает:
- `load_level` - уровень нагрузки (normal/high/critical)
- `packets_per_second` - пакетов в секунду
- `queue_utilization_percent` - заполненность очереди
- `alerts` - предупреждения о перегрузке

### Prometheus (опционально)

Добавьте в конфиг:

```yaml
monitoring:
  prometheus:
    enabled: true
    port: 9090
```

### Grafana дашборд

Импортируйте дашборд из `/docs/grafana-dashboard.json` (если доступен).

## Оптимизация конфигурации

### high_load.yaml

Основной файл конфигурации для высоких нагрузок: `backend/config/high_load.yaml`

**Оптимизировано для 3000+ серверов:**

```yaml
database:
  pool:
    pool_size: 100          # Увеличен для 3000+ серверов
    max_overflow: 200       # Увеличен для burst нагрузки
    pool_timeout: 30

udp:
  worker_pool:
    workers: 32             # 32 потока для параллельной обработки
    queue_size: 50000       # 50K сообщений в очереди
  batch:
    enabled: true
    max_batch_size: 200     # До 200 сообщений в пакете

async_processing:
  bulk:
    insert_batch_size: 1000 # До 1000 записей в одном DB commit
    flush_interval_ms: 50   # Быстрый flush

websocket:
  batch:
    enabled: true
    max_size: 50
    interval_ms: 100

redis:
  pool:
    max_connections: 200    # Увеличен для 3000+ серверов

uvicorn:
  workers: 17               # Минимум 17 воркеров
  limit_concurrency: 2000   # До 2000 соединений на воркер
  backlog: 4096             # Увеличенная очередь
```

## Troubleshooting

### Высокая нагрузка CPU

1. Проверьте количество воркеров uvicorn
2. Увеличьте `worker_pool.workers` для UDP
3. Проверьте индексы в БД

### Высокое потребление памяти

1. Проверьте размер пула соединений БД
2. Уменьшите `queue_size` для UDP
3. Настройте `maxmemory` в Redis

### Медленные запросы к БД

1. Выполните миграцию индексов:
   ```bash
   python -m updates.versions.add_high_load_indexes
   ```
2. Проверьте `EXPLAIN ANALYZE` для медленных запросов
3. Включите `database.echo: true` для отладки

### WebSocket отключения

1. Проверьте таймауты в Nginx
2. Увеличьте `max_connections_per_user`
3. Проверьте rate limiting

## Чеклист перед запуском

- [ ] PostgreSQL установлен и настроен
- [ ] Redis установлен и настроен
- [ ] Переменные окружения установлены
- [ ] Лимиты файлов увеличены
- [ ] Сетевые настройки оптимизированы
- [ ] Nginx настроен
- [ ] Миграции выполнены
- [ ] Мониторинг настроен
- [ ] Бэкапы настроены

## Поддержка

При возникновении проблем:
1. Проверьте логи: `/opt/moonbot/backend/logs/`
2. Проверьте метрики: `/api/metrics/all`
3. Проверьте статус сервисов: `systemctl status moonbot-*`

