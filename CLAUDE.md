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
- Длительность урока для проверки: 60 минут
- Функции: `check_teacher_conflict()`, `check_students_conflict()` в `lessons.py`

### Группы и уроки
- Уроки могут быть привязаны к группе (`group_id`)
- При создании урока для группы автоматически подтягиваются все ученики

### Матрица цен
- Цена урока зависит от уровня ученика и типа занятия
- Таблица `level_lesson_type_prices` (teacher_id, level, lesson_type_id, price)

## Миграции (Alembic)
Текущая версия: **005**
- 001: Начальная схема
- 002: AttendanceStatus enum
- 003: Group messages
- 004: Level-lesson type prices
- 005: group_id в lessons

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

### В процессе / TODO
- [ ] WebSocket для реал-тайм чата
- [ ] Материалы и тесты для учеников
- [ ] Статистика преподавателя (реальные данные вместо заглушек)
- [ ] Уведомления

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
