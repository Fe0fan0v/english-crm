# Настройка автоматических бэкапов PostgreSQL в ps.kz S3

## Предварительные требования

1. Доступ к серверу через SSH
2. Credentials от ps.kz S3 Storage
3. Созданный bucket на ps.kz (или права на создание)

## Шаг 1: Подготовка конфигурации

1. Подключитесь к серверу:
   ```bash
   ssh admin@158.160.141.83
   cd /home/admin/english-crm/backup
   ```

2. Скопируйте пример конфига:
   ```bash
   cp backup-config.env.example backup-config.env
   ```

3. Отредактируйте конфиг с реальными credentials:
   ```bash
   nano backup-config.env
   ```

   Заполните:
   - `DB_PASSWORD` - пароль от PostgreSQL (можно взять из docker-compose.yml)
   - `S3_ENDPOINT_URL` - URL endpoint ps.kz (например: https://s3.ps.kz)
   - `S3_ACCESS_KEY_ID` - ваш Access Key от ps.kz
   - `S3_SECRET_ACCESS_KEY` - ваш Secret Key от ps.kz
   - `S3_BUCKET_NAME` - название bucket (например: engcrm-backups)
   - `S3_REGION` - регион ps.kz (уточните у провайдера)

4. Защитите конфиг от чтения:
   ```bash
   chmod 600 backup-config.env
   ```

## Шаг 2: Установка AWS CLI

AWS CLI используется для работы с S3-совместимыми хранилищами.

```bash
# Установка AWS CLI
sudo apt-get update
sudo apt-get install -y awscli

# Проверка установки
aws --version
```

## Шаг 3: Создание bucket на ps.kz (если ещё не создан)

```bash
# Загрузка конфигурации
source /home/admin/english-crm/backup/backup-config.env

# Создание bucket
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 mb "s3://${S3_BUCKET_NAME}" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION"

# Проверка, что bucket создан
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION"
```

## Шаг 4: Настройка прав на выполнение скриптов

```bash
cd /home/admin/english-crm/backup
chmod +x backup-to-s3.sh
chmod +x restore-from-s3.sh
```

## Шаг 5: Тестовый бэкап

Запустите первый бэкап вручную для проверки:

```bash
cd /home/admin/english-crm/backup
./backup-to-s3.sh
```

Если всё настроено правильно, вы увидите:
```
=========================================
PostgreSQL Backup to ps.kz S3
=========================================
📦 Creating PostgreSQL dump...
✅ Backup created: postgres-backup-2026-01-27_12-34-56.sql.gz (15M)
☁️  Uploading to ps.kz S3...
✅ Backup uploaded to: s3://engcrm-backups/postgres-backup/...
🗑️  Removing local backup file...
✅ Local backup removed
🧹 Cleaning old backups...
✅ Cleanup completed
=========================================
✅ Backup completed successfully!
=========================================
```

## Шаг 6: Настройка автоматического запуска через cron

1. Откройте crontab:
   ```bash
   crontab -e
   ```

2. Добавьте строку для ежедневного бэкапа в 00:00 UTC:
   ```cron
   # PostgreSQL backup to ps.kz S3 every day at 00:00 UTC
   0 0 * * * /home/admin/english-crm/backup/backup-to-s3.sh >> /var/log/postgres-backup.log 2>&1
   ```

3. Сохраните и выйдите (Ctrl+X, Y, Enter в nano)

4. Проверьте, что задача добавлена:
   ```bash
   crontab -l
   ```

## Шаг 7: Настройка логирования

Создайте файл для логов:
```bash
sudo touch /var/log/postgres-backup.log
sudo chown admin:admin /var/log/postgres-backup.log
```

Настройте ротацию логов:
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

## Проверка работы

### Просмотр логов
```bash
tail -f /var/log/postgres-backup.log
```

### Список бэкапов в S3
```bash
source /home/admin/english-crm/backup/backup-config.env

AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION"
```

### Восстановление из бэкапа

1. Список доступных бэкапов:
   ```bash
   cd /home/admin/english-crm/backup
   ./restore-from-s3.sh
   ```

2. Восстановление из конкретного бэкапа:
   ```bash
   ./restore-from-s3.sh postgres-backup-2026-01-27_00-00-00.sql.gz
   ```

   **⚠️ ВНИМАНИЕ:** Это полностью заменит текущую базу данных!

## Мониторинг

### Проверка последнего бэкапа
```bash
# Проверка в логах
tail -20 /var/log/postgres-backup.log

# Проверка в S3
source /home/admin/english-crm/backup/backup-config.env
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    | tail -5
```

### Проверка размера бэкапов
```bash
source /home/admin/english-crm/backup/backup-config.env
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    --human-readable --summarize
```

## Устранение неполадок

### Ошибка: "aws: command not found"
```bash
sudo apt-get update
sudo apt-get install -y awscli
```

### Ошибка: "pg_dump: command not found"
```bash
# Установка PostgreSQL client tools
sudo apt-get install -y postgresql-client-16
```

### Ошибка при подключении к S3
Проверьте:
1. Правильность credentials в `backup-config.env`
2. Доступность endpoint URL (ping, curl)
3. Права доступа к bucket

### Тестирование подключения к S3
```bash
source /home/admin/english-crm/backup/backup-config.env

# Проверка подключения
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    --debug
```

## Безопасность

1. ✅ Файл `backup-config.env` содержит секретные данные - права 600
2. ✅ Добавлен в `.gitignore` (не попадёт в репозиторий)
3. ✅ Credentials хранятся только на сервере
4. ✅ Бэкапы сжаты (gzip) для экономии места
5. ✅ Автоматическое удаление старых бэкапов (> 7 дней)

## Рекомендации

1. **Проверяйте бэкапы регулярно** - раз в неделю делайте тестовое восстановление в тестовую БД
2. **Мониторьте размер бэкапов** - резкое изменение может указывать на проблемы
3. **Настройте алерты** - если бэкап не создался, вы должны знать об этом
4. **Документируйте изменения** - если меняете конфигурацию, обновляйте документацию

## Дополнительно: Алерты при ошибках

Для отправки уведомлений при ошибках бэкапа можно настроить email-алерты или интеграцию с Telegram.

Пример добавления в конец `backup-to-s3.sh`:
```bash
# В случае ошибки отправить уведомление
if [ $? -ne 0 ]; then
    # Отправка в Telegram (требует настройки bot token)
    curl -s -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
        -d chat_id=<YOUR_CHAT_ID> \
        -d text="❌ PostgreSQL backup failed on $(hostname) at $(date)"
fi
```
