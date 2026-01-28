# Настройка Email-уведомлений

Email-уведомления отправляются ученикам при получении новых личных сообщений от преподавателей или менеджеров.

## Варианты настройки SMTP

### 1. Gmail (Рекомендуется)

1. Включите двухфакторную аутентификацию в аккаунте Google
2. Перейдите на страницу [App Passwords](https://myaccount.google.com/apppasswords)
3. Создайте новый пароль приложения (выберите "Почта" и "Другое устройство")
4. Скопируйте сгенерированный пароль (16 символов)

**Настройки для `.env`:**
```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=ваш-пароль-приложения-16-символов
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Just Speak It
```

### 2. Yandex Mail

**Настройки для `.env`:**
```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_USERNAME=your-email@yandex.ru
SMTP_PASSWORD=ваш-пароль
SMTP_FROM_EMAIL=your-email@yandex.ru
SMTP_FROM_NAME=Just Speak It
```

### 3. Mail.ru

**Настройки для `.env`:**
```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_USERNAME=your-email@mail.ru
SMTP_PASSWORD=ваш-пароль
SMTP_FROM_EMAIL=your-email@mail.ru
SMTP_FROM_NAME=Just Speak It
```

## Установка на сервере

1. Подключитесь к серверу:
```bash
ssh admin@158.160.141.83
cd /home/admin/english-crm/backend
```

2. Создайте файл `.env` (если его нет):
```bash
cp .env.example .env
```

3. Отредактируйте `.env`:
```bash
nano .env
```

4. Добавьте/измените настройки SMTP (см. примеры выше)

5. Перезапустите backend:
```bash
cd /home/admin/english-crm
docker compose -f docker-compose.prod.yml restart backend
```

6. Проверьте логи:
```bash
docker compose logs -f backend
```

## Проверка работы

1. Войдите как преподаватель или менеджер
2. Отправьте сообщение ученику через раздел "Сообщения"
3. Проверьте email ученика - должно прийти уведомление

## Отключение email-уведомлений

Чтобы временно отключить отправку email:
```bash
EMAIL_ENABLED=false
```

## Формат уведомления

Ученики получают красиво оформленное HTML-письмо с:
- Именем отправителя
- Первыми 100 символами сообщения
- Кнопкой для перехода в личный кабинет

## Логирование

Все попытки отправки email логируются:
- Успешная отправка: `INFO: Email sent successfully to user@example.com`
- Ошибка: `ERROR: Failed to send email to user@example.com: <причина>`
- Email отключен: `INFO: Email sending is disabled. Would send to user@example.com: <тема>`

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте файл `.env` в git
- Используйте пароли приложений (app passwords), а не основные пароли
- Храните `.env` только на сервере
- Добавьте `.env` в `.gitignore` (уже добавлено)

## Решение проблем

### Email не отправляются

1. Проверьте, что `EMAIL_ENABLED=true`
2. Проверьте правильность SMTP настроек
3. Для Gmail убедитесь, что используете пароль приложения, а не основной пароль
4. Проверьте логи backend: `docker compose logs backend | grep -i email`

### Письма попадают в спам

1. Настройте SPF/DKIM записи для вашего домена (если используете свой домен)
2. Используйте профессиональный SMTP сервис (SendGrid, Mailgun)
3. Убедитесь, что SMTP_FROM_EMAIL совпадает с SMTP_USERNAME

### Ограничения Gmail

Gmail имеет лимиты отправки:
- ~500 писем в день для обычных аккаунтов
- ~2000 писем в день для Google Workspace

Если нужно отправлять больше - используйте профессиональный SMTP сервис.
