# EngCRM - Система управления языковой школой

## Технологии
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Деплой**: Docker Compose на VPS (158.160.141.83), CI/CD через GitHub Actions

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
- **admin** / **manager** — полный доступ к CRM, создание уроков
- **teacher** — личный кабинет, расписание (только просмотр), отметка посещаемости, указание свободного времени
- **student** — личный кабинет, расписание, баланс

## Валюта
Все балансы и цены отображаются в **тенге (тг)**.

## Ключевые фичи

### Система посещаемости
- Статусы: `pending`, `present`, `absent_excused`, `absent_unexcused`
- Названия кнопок: "Не отмечен", "Был", "Отмена", "Неявка"
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

### Свободное время преподавателя (Teacher Availability)
- Модель `TeacherAvailability` с полями: `teacher_id`, `day_of_week`, `start_time`, `end_time`
- Преподаватель указывает когда он свободен для занятий
- Отображается в расписании зелёным фоном (`bg-green-50`)
- API endpoints:
  - `GET /api/teacher/availability` — своя доступность
  - `POST /api/teacher/availability` — добавить слот
  - `DELETE /api/teacher/availability/{id}` — удалить слот
  - `GET /api/teacher/availability/{teacher_id}` — для менеджера
- Компонент: `TeacherAvailabilityEditor.tsx`

### Создание уроков из расписания
- **Только admin/manager** могут создавать уроки
- Клик по ячейке расписания → открывается модалка с предзаполненными датой/временем
- В TeacherDashboardPage (просмотр расписания учителя) менеджер видит:
  - Свободное время преподавателя (зелёный фон)
  - Может создать урок кликом на ячейку
- Преподаватель **не может** создавать уроки, только просматривать назначенные

### Изменение баланса с типами занятий
- `BalanceChangeModal` поддерживает выбор типа занятия
- При выборе типа и количества занятий — автоматический расчёт суммы
- Автозаполнение описания: "Оплата за X занятий (Тип)"

### SearchableSelect компонент
- Выпадающий список с нечётким поиском (fuzzy matching)
- Поддержка single/multi select
- Используется в LessonCreateModal для выбора группы и учеников

## Миграции (Alembic)
Текущая версия: **010**
- 001: Начальная схема
- 002: AttendanceStatus enum
- 003: Group messages
- 004: Level-lesson type prices
- 005: group_id в lessons
- 006: Notifications table
- 007: Fix lessonstatus enum (UPPERCASE → lowercase)
- 008: Fix userrole enum (UPPERCASE → lowercase)
- 009: Add duration_minutes to lessons
- 010: Add teacher_availability table

Миграции применяются автоматически при деплое (CI/CD).

## Текущий статус

### Реализовано
- [x] Кабинет преподавателя с расписанием (только просмотр)
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
- [x] Свободное время преподавателя (Teacher Availability)
- [x] Создание уроков из расписания (admin/manager)
- [x] Отображение доступности в расписании (зелёный фон)
- [x] SearchableSelect с fuzzy search
- [x] BalanceChangeModal с типами занятий и авторасчётом
- [x] Реальная статистика преподавателя в UserProfilePage
- [x] Рабочие вкладки "Ученики" и "Классы" в профиле преподавателя
- [x] Назначение уровня преподавателю (EditUserModal)
- [x] Ссылка на урок (meeting_url) — добавляется учителем в AttendanceModal

### В процессе / TODO
- [ ] WebSocket для реал-тайм чата
- [ ] Материалы и тесты для учеников (вкладка "Личные материалы")
- [ ] Интеграция с Yandex Telemost (авто-создание ссылок на уроки)

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

# SSH на сервер
ssh admin@158.160.141.83
cd /home/admin/english-crm
docker compose logs -f backend
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

### Права доступа к API
- `AdminUser` — только admin
- `ManagerUser` — admin или manager
- `TeacherUser` — admin, manager или teacher
- `CurrentUser` — любой авторизованный
- GET `/api/lesson-types` использует `ManagerUser` (не AdminUser!)

## Ключевые компоненты

### Backend API роуты
- `/api/lessons` — CRUD уроков (admin/manager)
- `/api/teacher` — кабинет преподавателя (расписание, посещаемость, availability)
- `/api/student` — кабинет ученика (расписание, группы)
- `/api/notifications` — уведомления
- `/api/groups` — группы и чат
- `/api/lesson-types` — типы занятий (ManagerUser для GET)
- `/api/levels` — уровни

### Frontend страницы
- `TeacherDashboardPage` — кабинет преподавателя (или просмотр для менеджера)
- `StudentDashboardPage` — кабинет ученика
- `UserProfilePage` — профиль пользователя (admin/manager view)
- `SchedulePage` — общее расписание
- `UsersPage`, `GroupsPage`, `LevelsPage`, `LessonTypesPage` — справочники

### Frontend компоненты
- `LessonCreateModal` — создание урока с SearchableSelect
- `LessonDetailModal` — детали урока, отметка посещаемости
- `AttendanceModal` — отметка посещаемости + добавление ссылки на урок
- `BalanceChangeModal` — изменение баланса с типами занятий
- `EditUserModal` — редактирование пользователя (включая level_id)
- `SearchableSelect` — выпадающий список с fuzzy search
- `TeacherAvailabilityEditor` — редактор свободного времени
- `NotificationBell` — колокольчик уведомлений в header
- `GroupChat` — чат группы

## Последние изменения (январь 2026)

1. **Убрана колонка "% преподавателю"** из LevelsPage
2. **Переименованы кнопки посещаемости**: "Был", "Отмена", "Неявка"
3. **Убран баланс ученика** из вкладки "Ученики" в TeacherDashboardPage
4. **Переименованы статусы** в LessonDetailModal
5. **SearchableSelect** — новый компонент с fuzzy search
6. **BalanceChangeModal** — добавлен выбор типа занятий с авторасчётом
7. **Teacher Availability** — полный стек (модель, миграция, API, UI)
8. **Создание уроков из расписания** — только для admin/manager
9. **Отображение доступности** в расписании (зелёный фон)
10. **Убрана ссылка Telemost** при создании урока, добавлена возможность учителю добавить в AttendanceModal
11. **Реальная статистика** преподавателя вместо заглушек (308 → реальные данные)
12. **Рабочие вкладки** в профиле преподавателя: "Ученики", "Классы"
13. **Преподаватель не может создавать уроки** — только просмотр расписания
