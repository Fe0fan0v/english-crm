#!/bin/bash

# Скрипт для обновления паролей студентов на production сервере

set -e  # Выход при любой ошибке

EXCEL_FILE="C:\Users\cypre\Downloads\Telegram Desktop\База ученики.xlsx"
SERVER="jsi"

echo "=================================================="
echo "Обновление паролей студентов на production сервере"
echo "=================================================="
echo ""

# 1. Загружаем Excel файл на сервер
echo "1/4 Загрузка Excel файла на сервер..."
scp "$EXCEL_FILE" ${SERVER}:~/students.xlsx
echo "✓ Файл загружен"
echo ""

# 2. Загружаем Python скрипт на сервер
echo "2/4 Загрузка Python скрипта на сервер..."
scp update_passwords_production.py ${SERVER}:~/update_passwords.py
echo "✓ Скрипт загружен"
echo ""

# 3. Копируем файлы в Docker контейнер
echo "3/4 Копирование файлов в Docker контейнер..."
ssh ${SERVER} "cd ~/english-crm && sudo docker compose cp ~/students.xlsx backend:/app/students.xlsx"
ssh ${SERVER} "cd ~/english-crm && sudo docker compose cp ~/update_passwords.py backend:/app/update_passwords.py"
echo "✓ Файлы скопированы в контейнер"
echo ""

# 4. Запускаем скрипт обновления
echo "4/4 Запуск скрипта обновления паролей..."
echo "=================================================="
ssh ${SERVER} "cd ~/english-crm && sudo docker compose exec backend python /app/update_passwords.py"
echo "=================================================="
echo ""
echo "✓ Обновление завершено!"
echo ""

# 5. Очистка временных файлов на сервере
echo "Очистка временных файлов..."
ssh ${SERVER} "rm -f ~/students.xlsx ~/update_passwords.py"
echo "✓ Временные файлы удалены"
echo ""

echo "=================================================="
echo "Все операции выполнены успешно!"
echo "=================================================="
