# EngCRM - Система управления языковой школой

## Технологии
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Деплой**: Docker Compose на VPS, CI/CD через GitHub Actions

## Структура
```
backend/
├── app/
│   ├── api/           # Роуты (lessons, groups, users, teacher_dashboard, student_dashboard)
│   ├── models/        # SQLAlchemy модели
│   ├── schemas/       # Pydantic схемы
│   └── database.py    # Подключение к БД
├── alembic/versions/  # Миграции
└── requirements.txt

frontend/
├── src/
│   ├── components/    # UI компоненты
│   ├── pages/         # Страницы
│   ├── services/api.ts # API клиент
│   └── types/index.ts # TypeScript типы
└── package.json
```

## Роли пользователей
- **admin** / **manager** — полный доступ к CRM
- **teacher** — личный кабинет, расписание, отметка посещаемости
- **student** — личный кабинет, расписание, баланс

## Валюта
Все балансы и цены отображаются в **тенге (тг)**.

## Ключевые фичи

### Система посещаемости
- Статусы: `pending`, `present`, `absent_excused`, `absent_unexcused`
- При `present` или `absent_unexcused` — списание с баланса
- При `absent_excused` — без списания (возврат если уже списано)

### Проверка конфликтов расписания
- При создании/редактировании урока проверяется:
  - Занятость преподавателя
  - Занятость учеников
- Функции: `check_teacher_conflict()`, `check_students_conflict()` в `lessons.py`

### Длительность уроков
- Поле `duration_minutes` в таблице lessons (по умолчанию 60 мин)
- Выбор при создании: 30 / 45 / 60 / 90 / 120 минут
- **Авто-завершение**: урок автоматически переходит в статус `completed` когда `now >= scheduled_at + duration_minutes`

### Уведомления
- Модель `Notification` с типами: `lesson_cancelled`, `low_balance`
- При отмене урока — уведомление всем ученикам
- При низком балансе (< 5000 тг) — уведомление ученику
- Компонент `NotificationBell` в header с badge непрочитанных
- API: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`

### Группы и уроки
- Уроки могут быть привязаны к группе (`group_id`)
- При создании урока для группы автоматически подтягиваются все ученики

### Матрица цен
- Цена урока зависит от уровня ученика и типа занятия
- Таблица `level_lesson_type_prices` (teacher_id, level, lesson_type_id, price)

## Миграции (Alembic)
Текущая версия: **009**
- 001: Начальная схема
- 002: AttendanceStatus enum
- 003: Group messages
- 004: Level-lesson type prices
- 005: group_id в lessons
- 006: Notifications table
- 007: Fix lessonstatus enum (UPPERCASE → lowercase)
- 008: Fix userrole enum (UPPERCASE → lowercase)
- 009: Add duration_minutes to lessons

Миграции применяются автоматически при деплое (CI/CD).

## Текущий статус

### Реализовано
- [x] Кабинет преподавателя с расписанием
- [x] Кабинет ученика
- [x] Система посещаемости с автосписанием баланса
- [x] Проверка конфликтов расписания
- [x] Интеграция уроков с группами
- [x] Матрица цен (уровень × тип урока)
- [x] Групповой чат (REST API, без WebSocket)
- [x] Уведомления (отмена урока, низкий баланс)
- [x] Длительность уроков с авто-завершением
- [x] Модальное окно деталей урока с посещаемостью (LessonDetailModal)
- [x] Валидация при создании урока (обязательно учитель + ученики)

### В процессе / TODO
- [ ] WebSocket для реал-тайм чата
- [ ] Материалы и тесты для учеников
- [ ] Статистика преподавателя (реальные данные вместо заглушек)
- [ ] Интеграция с Yandex Telemost (авто-создание ссылок на уроки)
- [ ] Чат для преподавателя (открытие чата из вкладки "Группы")

## Полезные команды

```bash
# Локальный запуск
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev

# Docker
docker compose up -d
docker compose logs -f backend

# Миграции
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# Тесты
cd backend && pytest -v
cd frontend && npm run lint && npm run build
```

## CI/CD
При пуше в `main`:
1. Тесты backend (pytest)
2. Lint + build frontend
3. Docker build test
4. Deploy на VPS + применение миграций

## Известные особенности

### PostgreSQL Enums
- PostgreSQL хранит enum values как строки
- SQLAlchemy enum должен использовать `values_callable=lambda x: [e.value for e in x]`
- Миграции 007-008 исправили регистр enum значений (были UPPERCASE, стали lowercase)

### Timezone в датах
- Frontend отправляет даты с timezone (UTC, суффикс `Z`)
- БД хранит datetime без timezone (naive)
- В API endpoints нужно нормализовать: `date.replace(tzinfo=None)`
- Исправлено в: `student_dashboard.py`, `teacher_dashboard.py`, `lessons.py`

## Ключевые компоненты

### Backend API роуты
- `/api/lessons` — CRUD уроков (admin/manager)
- `/api/teacher` — кабинет преподавателя (создание уроков, посещаемость)
- `/api/student` — кабинет ученика (расписание, группы)
- `/api/notifications` — уведомления
- `/api/groups` — группы и чат

### Frontend компоненты
- `LessonCreateModal` — создание урока с выбором учеников/группы
- `LessonDetailModal` — детали урока, отметка посещаемости
- `NotificationBell` — колокольчик уведомлений в header
- `GroupChat` — чат группы
