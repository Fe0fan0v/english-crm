#!/bin/bash
#
# Автоматический бэкап PostgreSQL в ps.kz S3 Storage
# Использование: ./backup-to-s3.sh
#

set -e  # Exit on error

# Директория скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/backup-config.env"

# Проверка наличия конфига
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ ERROR: Configuration file not found: $CONFIG_FILE"
    echo "Please create backup-config.env from backup-config.env.example"
    exit 1
fi

# Загрузка конфигурации
source "$CONFIG_FILE"

# Проверка обязательных переменных
REQUIRED_VARS=(
    "DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD"
    "S3_ENDPOINT_URL" "S3_ACCESS_KEY_ID" "S3_SECRET_ACCESS_KEY" "S3_BUCKET_NAME"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ ERROR: Required variable $var is not set in $CONFIG_FILE"
        exit 1
    fi
done

# Настройки
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DATE_ONLY=$(date +"%Y-%m-%d")
BACKUP_DIR="/tmp/postgres-backups"
BACKUP_FILE="${BACKUP_PREFIX}-${TIMESTAMP}.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
S3_PATH="s3://${S3_BUCKET_NAME}/${BACKUP_PREFIX}/${BACKUP_FILE}"

# Создание директории для временных файлов
mkdir -p "$BACKUP_DIR"

echo "========================================="
echo "PostgreSQL Backup to ps.kz S3"
echo "========================================="
echo "Timestamp: $TIMESTAMP"
echo "Database: $DB_NAME"
echo "S3 Bucket: $S3_BUCKET_NAME"
echo "========================================="

# 1. Создание дампа PostgreSQL
echo "📦 Creating PostgreSQL dump..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_PATH"

if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ ERROR: Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# 2. Загрузка в S3
echo "☁️  Uploading to ps.kz S3..."
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 cp "$BACKUP_PATH" "$S3_PATH" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    --no-progress

if [ $? -eq 0 ]; then
    echo "✅ Backup uploaded to: $S3_PATH"
else
    echo "❌ ERROR: Failed to upload backup to S3"
    exit 1
fi

# 3. Удаление локального файла
echo "🗑️  Removing local backup file..."
rm -f "$BACKUP_PATH"
echo "✅ Local backup removed"

# 4. Очистка старых бэкапов (старше BACKUP_RETENTION_DAYS дней)
echo "🧹 Cleaning old backups (older than ${BACKUP_RETENTION_DAYS} days)..."

# Получение списка всех бэкапов
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${S3_BUCKET_NAME}/${BACKUP_PREFIX}/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    | while read -r line; do
        # Извлечение имени файла
        file_name=$(echo "$line" | awk '{print $4}')
        if [ -z "$file_name" ]; then
            continue
        fi

        # Извлечение даты из имени файла (формат: prefix-YYYY-MM-DD_HH-MM-SS.sql.gz)
        file_date=$(echo "$file_name" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)

        if [ -z "$file_date" ]; then
            continue
        fi

        # Вычисление возраста файла в днях
        file_timestamp=$(date -d "$file_date" +%s 2>/dev/null || echo 0)
        current_timestamp=$(date +%s)
        age_days=$(( (current_timestamp - file_timestamp) / 86400 ))

        # Удаление если старше BACKUP_RETENTION_DAYS
        if [ "$age_days" -gt "$BACKUP_RETENTION_DAYS" ]; then
            echo "  Deleting old backup: $file_name (${age_days} days old)"
            AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
            AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
            aws s3 rm "s3://${S3_BUCKET_NAME}/${BACKUP_PREFIX}/${file_name}" \
                --endpoint-url "$S3_ENDPOINT_URL" \
                --region "$S3_REGION"
        fi
    done

echo "✅ Cleanup completed"

echo "========================================="
echo "✅ Backup completed successfully!"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo "S3 location: $S3_PATH"
echo "Size: $BACKUP_SIZE"
echo "========================================="

# Логирование в syslog
logger -t postgres-backup "Backup completed: $BACKUP_FILE ($BACKUP_SIZE) uploaded to ps.kz S3"

exit 0
