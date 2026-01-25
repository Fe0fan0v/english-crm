# Настройка домена и SSL сертификата

## Статус

✅ **Nginx настроен** - конфигурация создана и активна
✅ **Скрипт SSL готов** - автоматическая установка сертификата
✅ **DNS настроен** - A запись justspeak.heliad.ru -> 158.160.141.83
✅ **SSL установлен** - сертификат от Let's Encrypt до 2026-04-25
✅ **Порты закрыты** - доступ только через nginx (127.0.0.1)
✅ **CORS обновлен** - backend принимает только https://justspeak.heliad.ru

## Текущая конфигурация

- **Домен**: justspeak.heliad.ru
- **IP сервера**: 158.160.141.83
- **Backend**: http://localhost:8005 (в контейнере :8000)
- **Frontend**: http://localhost:3005 (в контейнере :80)

## Шаг 1: Настройка DNS записи

Добавьте A запись в настройках домена heliad.ru:

```
Тип: A
Имя: justspeak
Значение: 158.160.141.83
TTL: 3600 (или auto)
```

После добавления записи подождите 5-15 минут для распространения DNS.

### Проверка DNS

Выполните на локальном компьютере или сервере:

```bash
nslookup justspeak.heliad.ru 8.8.8.8
# Должен вернуть: 158.160.141.83

# Или с помощью dig:
dig justspeak.heliad.ru +short
# Должен вернуть: 158.160.141.83
```

## Шаг 2: Получение SSL сертификата

После настройки DNS подключитесь к серверу и запустите скрипт:

```bash
ssh admin@158.160.141.83
~/setup-ssl.sh
```

Скрипт автоматически:
1. Проверит DNS запись
2. Получит SSL сертификат от Let's Encrypt
3. Настроит автоматический редирект с HTTP на HTTPS
4. Перезагрузит nginx

## Nginx конфигурация

### Текущая конфигурация (HTTP)

Файл: `/etc/nginx/sites-available/justspeak.heliad.ru`

```nginx
server {
    listen 80;
    server_name justspeak.heliad.ru;

    client_max_body_size 20M;

    location /api {
        proxy_pass http://localhost:8005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location /health {
        proxy_pass http://localhost:8005/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### После установки SSL

Certbot автоматически добавит в конфигурацию:
- SSL сертификат
- Редирект с HTTP (80) на HTTPS (443)
- SSL параметры безопасности

## Обновление CORS в backend

После установки SSL обновите `docker-compose.yml`:

```yaml
environment:
  CORS_ORIGINS: '["https://justspeak.heliad.ru"]'
```

Затем перезапустите контейнеры:

```bash
cd ~/english-crm
docker compose down
docker compose up -d
```

## Автообновление сертификата

Certbot автоматически настраивает cron job для обновления сертификата.
Сертификаты обновляются за 30 дней до истечения.

### Проверка автообновления

```bash
sudo certbot renew --dry-run
```

### Просмотр установленных сертификатов

```bash
sudo certbot certificates
```

## Полезные команды nginx

```bash
# Проверка конфигурации
sudo nginx -t

# Перезагрузка (применение изменений)
sudo systemctl reload nginx

# Перезапуск
sudo systemctl restart nginx

# Статус
sudo systemctl status nginx

# Просмотр логов
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Проверка после настройки

1. Откройте в браузере: https://justspeak.heliad.ru
2. Проверьте, что SSL сертификат установлен (зелёный замочек)
3. Проверьте API: https://justspeak.heliad.ru/api/health
4. Убедитесь, что редирект с HTTP работает: http://justspeak.heliad.ru → https://justspeak.heliad.ru

## Контакты для сертификата

- **Email**: admin@heliad.ru (используется при получении сертификата)
- **Организация**: Let's Encrypt
- **Срок действия**: 90 дней (автообновление)

## Troubleshooting

### DNS не резолвится
```bash
# Проверьте DNS с разных серверов
nslookup justspeak.heliad.ru 8.8.8.8
nslookup justspeak.heliad.ru 1.1.1.1

# Очистите кеш DNS (Windows)
ipconfig /flushdns

# Подождите 15-30 минут после добавления записи
```

### Ошибка при получении сертификата
```bash
# Проверьте, что порт 80 открыт
sudo netstat -tlnp | grep :80

# Проверьте логи certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Убедитесь, что nginx работает
sudo systemctl status nginx
```

### Сайт не открывается через HTTPS
```bash
# Проверьте, что порт 443 открыт в firewall
sudo ufw status
sudo ufw allow 443/tcp

# Проверьте конфигурацию nginx
sudo nginx -t

# Перезапустите nginx
sudo systemctl restart nginx
```
