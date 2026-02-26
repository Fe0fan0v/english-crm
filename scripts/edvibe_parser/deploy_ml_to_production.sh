#!/bin/bash
# Деплой Market Leader на production сервер

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

# Находим последний файл Market Leader
ML_FILE=$(ls -t "$OUTPUT_DIR"/jsi_hierarchy_Market_Leader_ALL_LEVELS_*.json | head -1)

if [ -z "$ML_FILE" ]; then
    echo "ERROR: Market Leader JSON file not found!"
    exit 1
fi

echo "========================================================================"
echo "ДЕПЛОЙ MARKET LEADER НА PRODUCTION"
echo "========================================================================"
echo "Файл: $(basename "$ML_FILE")"
echo "Размер: $(du -h "$ML_FILE" | cut -f1)"
echo ""

# Проверяем статистику
echo "Проверка JSON..."
python3 -c "
import json
with open('$ML_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)
    sections = data.get('sections', [])
    total_lessons = sum(len(s.get('lessons', [])) for s in sections)
    total_blocks = sum(
        len(l.get('blocks', []))
        for s in sections
        for l in s.get('lessons', [])
    )
    print(f'Секций: {len(sections)}')
    print(f'Уроков: {total_lessons}')
    print(f'Блоков: {total_blocks}')
"
echo ""

read -p "Продолжить деплой на production? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 0
fi

echo ""
echo "1/5 Копирование JSON на сервер..."
scp "$ML_FILE" jsi:~/ml_data.json

echo ""
echo "2/5 Копирование скрипта импорта..."
scp "$SCRIPT_DIR/import_ml_to_production.py" jsi:~/import_ml.py

echo ""
echo "3/5 Копирование файлов в Docker контейнер..."
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/ml_data.json backend:/app/ml_data.json"
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/import_ml.py backend:/app/import_ml.py"

echo ""
echo "4/5 Запуск импорта в Docker..."
ssh jsi "cd ~/english-crm && sudo docker compose exec -T backend python /app/import_ml.py"

echo ""
echo "5/5 Очистка временных файлов..."
ssh jsi "rm -f ~/ml_data.json ~/import_ml.py"

echo ""
echo "========================================================================"
echo "ДЕПЛОЙ ЗАВЕРШЕН!"
echo "========================================================================"
echo "Откройте: https://lms.jsi.kz/courses"
echo ""
