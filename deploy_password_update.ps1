# Скрипт для обновления паролей студентов на production сервере

$EXCEL_FILE = "C:\Users\cypre\Downloads\Telegram Desktop\База ученики.xlsx"
$SERVER = "jsi"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Обновление паролей студентов на production сервере" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Загружаем Excel файл на сервер
Write-Host "1/4 Загрузка Excel файла на сервер..." -ForegroundColor Yellow
scp "$EXCEL_FILE" "${SERVER}:~/students.xlsx"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Файл загружен" -ForegroundColor Green
} else {
    Write-Host "✗ Ошибка загрузки файла" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Загружаем Python скрипт на сервер
Write-Host "2/4 Загрузка Python скрипта на сервер..." -ForegroundColor Yellow
scp update_passwords_production.py "${SERVER}:~/update_passwords.py"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Скрипт загружен" -ForegroundColor Green
} else {
    Write-Host "✗ Ошибка загрузки скрипта" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Копируем файлы в Docker контейнер
Write-Host "3/4 Копирование файлов в Docker контейнер..." -ForegroundColor Yellow
ssh ${SERVER} "cd ~/english-crm && sudo docker compose cp ~/students.xlsx backend:/app/students.xlsx"
ssh ${SERVER} "cd ~/english-crm && sudo docker compose cp ~/update_passwords.py backend:/app/update_passwords.py"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Файлы скопированы в контейнер" -ForegroundColor Green
} else {
    Write-Host "✗ Ошибка копирования файлов" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Запускаем скрипт обновления
Write-Host "4/4 Запуск скрипта обновления паролей..." -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
ssh ${SERVER} "cd ~/english-crm && sudo docker compose exec backend python /app/update_passwords.py"
if ($LASTEXITCODE -eq 0) {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✓ Обновление завершено!" -ForegroundColor Green
} else {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✗ Ошибка при обновлении" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 5. Очистка временных файлов на сервере
Write-Host "Очистка временных файлов..." -ForegroundColor Yellow
ssh ${SERVER} "rm -f ~/students.xlsx ~/update_passwords.py"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Временные файлы удалены" -ForegroundColor Green
} else {
    Write-Host "⚠ Предупреждение: не удалось удалить временные файлы" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Все операции выполнены успешно!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
