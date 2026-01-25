# Развертывание EngCRM

## Production сервер

- **Домен**: https://justspeak.heliad.ru
- **IP**: 158.160.141.83
- **OS**: Ubuntu
- **SSH**: admin@158.160.141.83

## Архитектура

```
Internet
    ↓
Nginx (80, 443) - SSL/TLS терминация
    ↓
├─→ Frontend (127.0.0.1:3005)
└─→ Backend API (127.0.0.1:8005)
        ↓
    PostgreSQL (127.0.0.1:5435)
```

## Безопасность

### Закрытые порты
Все сервисы доступны **только на localhost**:
- Frontend: `127.0.0.1:3005` (не доступен снаружи)
- Backend: `127.0.0.1:8005` (не доступен снаружи)
- PostgreSQL: `127.0.0.1:5435` (не доступен снаружи)

### Публичные порты
Только через **Nginx**:
- HTTP (80) → редирект на HTTPS
- HTTPS (443) → SSL терминация → проксирование на localhost

### CORS
Backend настроен на прием запросов только с:
```
https://justspeak.heliad.ru
```

## Docker Compose конфигурации

### Локальная разработка
Файл: `docker-compose.yml`
- Порты открыты для localhost (без 127.0.0.1)
- CORS разрешен для localhost:3005, localhost:5173
- Используется для разработки

### Production
Файл: `docker-compose.prod.yml`
- Порты привязаны к 127.0.0.1 (закрыты снаружи)
- CORS только для https://justspeak.heliad.ru
- Используется на production сервере

**CI/CD автоматически копирует** `docker-compose.prod.yml` → `docker-compose.yml` при деплое.

## SSL сертификат

- **Выдан**: Let's Encrypt
- **Домен**: justspeak.heliad.ru
- **Срок действия**: до 2026-04-25 (90 дней)
- **Автообновление**: настроено через certbot
- **Сертификат**: `/etc/letsencrypt/live/justspeak.heliad.ru/fullchain.pem`
- **Ключ**: `/etc/letsencrypt/live/justspeak.heliad.ru/privkey.pem`

### Проверка сертификата
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## Nginx конфигурация

Файл: `/etc/nginx/sites-available/justspeak.heliad.ru`

### Роутинг
- `https://justspeak.heliad.ru/` → Frontend (localhost:3005)
- `https://justspeak.heliad.ru/api/*` → Backend (localhost:8005)
- `https://justspeak.heliad.ru/health` → Backend health check
- `http://justspeak.heliad.ru` → 301 redirect to HTTPS

### Настройки
- `client_max_body_size`: 20M (для загрузки файлов)
- SSL параметры: управляются certbot
- Редирект HTTP→HTTPS: автоматический

## CI/CD Pipeline

### Триггер
Push в ветку `main` или ручной запуск

### Этапы
1. **Backend Tests** - pytest
2. **Frontend Checks** - lint + build
3. **Docker Build** - тест сборки образов
4. **Deploy** - автоматический деплой на VPS

### Деплой на сервер
```bash
cd ~/english-crm
git pull origin main
cp docker-compose.prod.yml docker-compose.yml  # Использовать prod конфигурацию
docker compose build
docker compose up -d
docker compose exec -T backend python -m alembic upgrade head
docker compose exec -T backend python -m app.seed
docker system prune -f
```

### Health check
После деплоя проверяется:
- Backend: `http://localhost:8005/health`
- Frontend: `http://localhost:3005`

## Мониторинг

### Проверка статуса контейнеров
```bash
ssh admin@158.160.141.83
cd ~/english-crm
docker compose ps
```

### Логи
```bash
# Backend
docker compose logs backend --tail=100 -f

# Frontend
docker compose logs frontend --tail=100 -f

# Все сервисы
docker compose logs --tail=100 -f
```

### Nginx
```bash
# Статус
sudo systemctl status nginx

# Логи
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Проверка конфигурации
sudo nginx -t

# Перезагрузка
sudo systemctl reload nginx
```

## Базы данных

### Миграции
Автоматически применяются при деплое:
```bash
docker compose exec -T backend python -m alembic upgrade head
```

### Резервное копирование
```bash
# Создать бэкап
docker compose exec db pg_dump -U postgres engcrm > backup_$(date +%Y%m%d).sql

# Восстановить из бэкапа
docker compose exec -T db psql -U postgres engcrm < backup_20260125.sql
```

### Подключение к БД
```bash
docker compose exec db psql -U postgres -d engcrm
```

## Файловое хранилище

### Расположение
- **Контейнер**: `/app/storage`
- **Volume**: `storage_data` (Docker volume)

### Структура
```
storage/
├── chat/         # Файлы из чатов
├── materials/    # Учебные материалы
├── news/         # Баннеры новостей
└── photos/       # Фото профилей
```

### Резервное копирование
```bash
# Создать бэкап volume
docker run --rm -v english-crm_storage_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/storage_backup_$(date +%Y%m%d).tar.gz /data

# Восстановить бэкап
docker run --rm -v english-crm_storage_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/storage_backup_20260125.tar.gz -C /
```

## Обновление приложения

### Через CI/CD (рекомендуется)
```bash
git push origin main  # Автоматический деплой
```

### Вручную
```bash
ssh admin@158.160.141.83
cd ~/english-crm
git pull origin main
cp docker-compose.prod.yml docker-compose.yml
docker compose build
docker compose down
docker compose up -d
docker compose exec -T backend python -m alembic upgrade head
```

## Откат на предыдущую версию

```bash
ssh admin@158.160.141.83
cd ~/english-crm

# Посмотреть коммиты
git log --oneline -10

# Откатиться на нужный коммит
git checkout <commit-hash>

# Пересобрать и перезапустить
docker compose build
docker compose down
docker compose up -d
```

## Troubleshooting

### Сайт не открывается
```bash
# Проверить nginx
sudo systemctl status nginx
sudo nginx -t

# Проверить контейнеры
docker compose ps

# Проверить логи
docker compose logs backend --tail=50
sudo tail -f /var/log/nginx/error.log
```

### Ошибка 502 Bad Gateway
```bash
# Проверить backend
docker compose logs backend --tail=100

# Перезапустить backend
docker compose restart backend

# Проверить подключение
curl http://localhost:8005/health
```

### Ошибка CORS
Проверить CORS_ORIGINS в `docker-compose.prod.yml`:
```yaml
CORS_ORIGINS: '["https://justspeak.heliad.ru"]'
```

### SSL сертификат истёк
```bash
# Обновить вручную
sudo certbot renew

# Перезагрузить nginx
sudo systemctl reload nginx
```

## Контакты и доступы

- **GitHub**: https://github.com/Fe0fan0v/english-crm
- **SSL Email**: admin@heliad.ru
- **SSH**: требуется SSH ключ (хранится в GitHub Secrets)

## Полезные ссылки

- Сайт: https://justspeak.heliad.ru
- API Docs: https://justspeak.heliad.ru/api/docs
- Health Check: https://justspeak.heliad.ru/health
