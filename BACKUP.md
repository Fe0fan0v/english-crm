# Система бэкапов Just Speak It

## Обзор

Система автоматических бэкапов базы данных PostgreSQL в объектное хранилище ps.kz S3.

## Характеристики

- **Хранилище:** ps.kz S3-совместимый Object Storage
- **Частота:** Ежедневно в 00:00 UTC
- **Ретенция:** 7 дней (автоматическое удаление старых бэкапов)
- **Сжатие:** gzip (экономия ~70-80% места)
- **Автоматизация:** cron + bash скрипты
- **Восстановление:** One-click restore из любого бэкапа

## Структура бэкапов

```
s3://engcrm-backups/
└── postgres-backup/
    ├── postgres-backup-2026-01-27_00-00-00.sql.gz
    ├── postgres-backup-2026-01-26_00-00-00.sql.gz
    ├── postgres-backup-2026-01-25_00-00-00.sql.gz
    └── ... (последние 7 дней)
```

## Компоненты

### 1. Скрипт бэкапа (`backup/backup-to-s3.sh`)
- Создаёт дамп PostgreSQL (`pg_dump`)
- Сжимает с помощью gzip
- Загружает в S3 (`aws s3 cp`)
- Удаляет локальную копию
- Очищает старые бэкапы (> 7 дней)
- Логирует результат

### 2. Скрипт восстановления (`backup/restore-from-s3.sh`)
- Показывает список доступных бэкапов
- Скачивает выбранный бэкап из S3
- Останавливает активные подключения к БД
- Восстанавливает данные
- Удаляет локальную копию

### 3. Конфигурация (`backup/backup-config.env`)
- Database credentials
- S3 credentials
- Retention policy
- Префиксы и пути

### 4. Автоматизация (cron)
```cron
0 0 * * * /home/admin/english-crm/backup/backup-to-s3.sh >> /var/log/postgres-backup.log 2>&1
```

## Настройка

См. подробную инструкцию: [backup/SETUP.md](backup/SETUP.md)

**Краткая версия:**
1. Получить credentials от ps.kz
2. Скопировать `backup-config.env.example` → `backup-config.env`
3. Заполнить credentials
4. Установить AWS CLI
5. Создать bucket
6. Настроить cron
7. Запустить тестовый бэкап

## Использование

### Создание бэкапа вручную
```bash
cd /home/admin/english-crm/backup
./backup-to-s3.sh
```

### Просмотр списка бэкапов
```bash
./restore-from-s3.sh
```

### Восстановление из бэкапа
```bash
./restore-from-s3.sh postgres-backup-2026-01-27_00-00-00.sql.gz
```

⚠️ **ВНИМАНИЕ:** Восстановление полностью заменит текущую базу данных!

## Мониторинг

### Проверка последнего бэкапа
```bash
# Логи
tail -20 /var/log/postgres-backup.log

# S3
source /home/admin/english-crm/backup/backup-config.env
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" | tail -5
```

### Размер бэкапов
```bash
aws s3 ls "s3://${S3_BUCKET_NAME}/postgres-backup/" \
    --endpoint-url "$S3_ENDPOINT_URL" \
    --region "$S3_REGION" \
    --human-readable --summarize
```

## Disaster Recovery

### Сценарий 1: Потеря данных
1. Остановите приложение: `docker compose down`
2. Восстановите из последнего бэкапа: `./restore-from-s3.sh <backup-file>`
3. Запустите приложение: `docker compose up -d`
4. Проверьте работоспособность

### Сценарий 2: Полная потеря сервера
1. Разверните новый сервер
2. Установите Docker, PostgreSQL client, AWS CLI
3. Клонируйте репозиторий
4. Настройте backup credentials
5. Создайте пустую БД
6. Восстановите из бэкапа
7. Запустите приложение

### Сценарий 3: Откат на предыдущую версию
1. Посмотрите список бэкапов: `./restore-from-s3.sh`
2. Выберите нужную дату
3. Восстановите: `./restore-from-s3.sh <backup-file>`

## Безопасность

- ✅ Credentials хранятся только на сервере в `backup-config.env`
- ✅ Файл защищён правами доступа `600` (только owner)
- ✅ Добавлен в `.gitignore` (не попадёт в git)
- ✅ Бэкапы сжаты (gzip)
- ✅ Транспорт через HTTPS
- ✅ Автоматическое удаление старых бэкапов

## Затраты

Примерная оценка для базы 100 МБ:

| Параметр | Значение |
|----------|----------|
| Размер несжатого дампа | 100 МБ |
| Размер сжатого (gzip) | ~20-30 МБ |
| Хранение (7 дней) | ~150-200 МБ |
| Стоимость хранения | ~0.3₽/мес |
| Трафик исходящий | ~0 (только при restore) |

**Итого:** ~0.3-1₽ в месяц для небольшой базы.

## Рекомендации

1. **Тестируйте восстановление** раз в месяц
2. **Мониторьте размер бэкапов** - резкий рост может указывать на проблемы
3. **Проверяйте логи** после каждого бэкапа
4. **Документируйте изменения** в конфигурации
5. **Рассмотрите увеличение retention** до 30 дней для критичных данных
6. **Настройте алерты** при ошибках бэкапа

## Troubleshooting

См. раздел "Устранение неполадок" в [backup/SETUP.md](backup/SETUP.md)

## Дополнительные возможности

### Бэкап конкретной таблицы
```bash
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h localhost -p 5432 -U engcrm_user -d engcrm \
    -t users \
    | gzip > users-backup.sql.gz
```

### Бэкап только схемы (без данных)
```bash
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h localhost -p 5432 -U engcrm_user -d engcrm \
    --schema-only \
    | gzip > schema-backup.sql.gz
```

### Point-in-time recovery (PITR)
Для продвинутого PITR рассмотрите использование WAL archiving:
- [PostgreSQL WAL Documentation](https://www.postgresql.org/docs/current/continuous-archiving.html)

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-01-27 | Первичная настройка системы бэкапов |

## Контакты

При возникновении проблем с системой бэкапов обращайтесь к DevOps команде.
