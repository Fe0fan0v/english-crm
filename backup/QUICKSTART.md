# Быстрый старт после получения credentials

## После получения credentials от ps.kz выполните:

### 1. Подключитесь к серверу
```bash
ssh admin@158.160.141.83
cd /home/admin/english-crm
```

### 2. Обновите код
```bash
git pull
```

### 3. Создайте конфигурацию
```bash
cd backup
cp backup-config.env.example backup-config.env
nano backup-config.env
```

Заполните (получите из docker-compose.yml и от заказчика):
```env
# PostgreSQL (из docker-compose.yml)
DB_PASSWORD=ваш_пароль_из_compose

# ps.kz S3 (от заказчика)
S3_ENDPOINT_URL=https://s3.ps.kz
S3_ACCESS_KEY_ID=ваш_access_key
S3_SECRET_ACCESS_KEY=ваш_secret_key
S3_BUCKET_NAME=engcrm-backups
S3_REGION=kz-astana-1
```

Сохраните: Ctrl+X, Y, Enter

### 4. Защитите конфиг
```bash
chmod 600 backup-config.env
```

### 5. Установите AWS CLI
```bash
sudo apt-get update
sudo apt-get install -y awscli
```

### 6. Создайте bucket
```bash
source backup-config.env

AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 mb "s3://${S3_BUCKET_NAME}" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION"
```

### 7. Дайте права на выполнение
```bash
chmod +x backup-to-s3.sh restore-from-s3.sh
```

### 8. Тестовый бэкап
```bash
./backup-to-s3.sh
```

Должно быть:
```
✅ Backup created: postgres-backup-2026-01-27_XX-XX-XX.sql.gz (XXM)
✅ Backup uploaded to: s3://engcrm-backups/...
✅ Backup completed successfully!
```

### 9. Настройте cron
```bash
crontab -e
```

Добавьте:
```cron
0 0 * * * /home/admin/english-crm/backup/backup-to-s3.sh >> /var/log/postgres-backup.log 2>&1
```

### 10. Создайте лог-файл
```bash
sudo touch /var/log/postgres-backup.log
sudo chown admin:admin /var/log/postgres-backup.log
```

### 11. Настройте ротацию логов
```bash
sudo nano /etc/logrotate.d/postgres-backup
```

Добавьте:
```
/var/log/postgres-backup.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
```

## ✅ Готово!

Бэкапы будут создаваться автоматически каждый день в 00:00 UTC.

## Проверка

Список бэкапов в S3:
```bash
source backup-config.env
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION"
```

Просмотр логов:
```bash
tail -f /var/log/postgres-backup.log
```

## Проблемы?

См. [SETUP.md](SETUP.md) - раздел "Устранение неполадок"
