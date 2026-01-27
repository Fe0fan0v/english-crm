#!/bin/bash
#
# Восстановление PostgreSQL из бэкапа в ps.kz S3 Storage
# Использование: ./restore-from-s3.sh [backup-filename]
#
# Если backup-filename не указан, показывает список доступных бэкапов
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

# Функция для вывода списка доступных бэкапов
list_backups() {
    echo "========================================="
    echo "Available backups in ps.kz S3:"
    echo "========================================="

    AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    aws s3 ls "s3://${S3_BUCKET_NAME}/${BACKUP_PREFIX}/" \
        --endpoint-url "$S3_ENDPOINT_URL" \
        --region "$S3_REGION" \
        | awk '{print $4}' \
        | grep -v '^$' \
        | sort -r

    echo "========================================="
    echo "Usage: $0 <backup-filename>"
    echo "Example: $0 ${BACKUP_PREFIX}-2026-01-27_00-00-00.sql.gz"
    echo "========================================="
}

# Если файл не указан, показываем список
if [ -z "$1" ]; then
    list_backups
    exit 0
fi

BACKUP_FILE="$1"
BACKUP_DIR="/tmp/postgres-backups"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
S3_PATH="s3://${S3_BUCKET_NAME}/${BACKUP_PREFIX}/${BACKUP_FILE}"

# Создание директории для временных файлов
mkdir -p "$BACKUP_DIR"

echo "========================================="
echo "PostgreSQL Restore from ps.kz S3"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo "S3 location: $S3_PATH"
echo "Database: $DB_NAME"
echo "========================================="

# Подтверждение
read -p "⚠️  WARNING: This will REPLACE the current database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# 1. Скачивание бэкапа из S3
echo "☁️  Downloading backup from ps.kz S3..."
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
aws s3 cp "$S3_PATH" "$BACKUP_PATH" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    --no-progress

if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ ERROR: Failed to download backup from S3"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "✅ Backup downloaded: $BACKUP_SIZE"

# 2. Остановка всех подключений к БД (опционально)
echo "🔌 Terminating active connections to database..."
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

echo "✅ Connections terminated"

# 3. Восстановление из дампа
echo "📥 Restoring database from backup..."
gunzip -c "$BACKUP_PATH" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --quiet

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully"
else
    echo "❌ ERROR: Failed to restore database"
    exit 1
fi

# 4. Удаление локального файла
echo "🗑️  Removing downloaded backup file..."
rm -f "$BACKUP_PATH"
echo "✅ Local file removed"

echo "========================================="
echo "✅ Restore completed successfully!"
echo "========================================="
echo "Restored from: $BACKUP_FILE"
echo "Database: $DB_NAME"
echo "========================================="

# Логирование в syslog
logger -t postgres-restore "Database restored from backup: $BACKUP_FILE"

exit 0
