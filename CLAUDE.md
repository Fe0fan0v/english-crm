
# Just Speak It - Система управления языковой школой (EngCRM)

## Технологии
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Деплой**: Docker Compose на VPS (ps.kz), CI/CD через GitHub Actions
- **Домен**: lms.jsi.kz (nginx reverse proxy + SSL/Let's Encrypt)
- **Хранилище**: ps.kz Object Storage (S3-совместимое, бакет `jsi`)

## Структура
```
backend/
├── app/
│   ├── api/           # Роуты (lessons, groups, users, courses, exercise_results, etc.)
│   ├── models/        # SQLAlchemy модели
│   ├── schemas/       # Pydantic схемы
│   ├── utils/         # Утилиты (grading.py — серверная проверка ответов)
│   └── database.py    # Подключение к БД
├── alembic/versions/  # Миграции (000-024)
└── requirements.txt

frontend/
├── src/
│   ├── components/    # UI компоненты
│   │   └── blocks/    # BlockEditor.tsx, BlockRenderer.tsx (конструктор курсов)
│   ├── pages/         # Страницы
│   ├── data/          # Статические данные (irregularVerbs.ts)
│   ├── services/      # API клиенты (api.ts, courseApi.ts)
│   └── types/         # TypeScript типы (index.ts, course.ts)
└── package.json

scripts/edvibe_parser/  # Парсер курсов Edvibe (Playwright)
backup/                 # Автобэкапы PostgreSQL в S3
```

## Роли пользователей
- **admin** — полный доступ к CRM, управление курсами
- **manager** — полный доступ к CRM, создание только учеников и преподавателей
- **teacher** — личный кабинет, расписание (только просмотр), посещаемость, свободное время, курсы (read-only), прикрепление материалов
- **student** — личный кабинет, расписание, баланс, просмотр прикреплённых курсовых материалов

## Валюта
Все балансы и цены в **тенге (тг)**.

## Права доступа к API
- `AdminUser` — только admin
- `ManagerUser` — admin или manager
- `TeacherUser` — admin, manager или teacher
- `CurrentUser` — любой авторизованный
- GET `/api/lesson-types` использует `TeacherUser` (teachers нужен доступ для создания уроков!)

## Ключевые фичи

### Посещаемость
- Статусы: `pending`, `present`, `absent_excused`, `absent_unexcused`
- Кнопки: "Не отмечен", "Был", "Отмена", "Неявка"
- `present` или `absent_unexcused` → списание с баланса; `absent_excused` → без списания

### Уроки и расписание
- Проверка конфликтов: `check_teacher_conflict()`, `check_students_conflict()` в `lessons.py`
- Длительность: 30/45/60/90/120 мин. Авто-завершение: `completed` когда `now >= scheduled_at + duration_minutes`
- Создание из расписания: клик по ячейке → модалка с предзаполненной датой/временем
- Batch creation: "Расписание на несколько недель" (1-12 недель, выбор дней)
  - API: `POST /api/lessons/batch`. **ВАЖНО**: передавать `onBatchSubmit` callback в `LessonCreateModal`
- Ссылка на урок (meeting_url): teacher → `PUT /api/teacher/lessons/{id}`, manager → `PUT /api/lessons/{id}`
- Автоочистка meeting_url: APScheduler ежедневно в 00:00 UTC
- Имена учеников отображаются в расписании для индивидуальных уроков (без группы)

### Группы
- Уроки привязываются к группе (`group_id`) → автоподтягивание учеников
- Групповой чат через WebSocket: `wss://lms.jsi.kz/api/groups/ws/{group_id}/chat?token={jwt}`

### Прямые назначения преподаватель-ученик
- Таблица `teacher_students`. Автосоздание при создании урока/группы
- Ограничивает чаты: teacher ↔ назначенный ученик, student ↔ назначенный teacher/manager

### Личные сообщения
- Teacher ↔ Student, Manager ↔ Student, Student → Manager (поддержка)
- Поддержка файлов (до 10 МБ): jpg, png, pdf, doc, xls, zip и др.
- Email-уведомления при новом сообщении (SMTP Gmail, production активно)

### Уведомления
- Типы: `lesson_cancelled`, `low_balance`. Компонент `NotificationBell`
- При низком балансе (< 5000 тг) → уведомление + кнопка WhatsApp менеджера

### Конструктор курсов
**Курс → Секции → Топики → Уроки → Блоки упражнений**

**Типы блоков (18 шт.):**
| Контентные (10) | Интерактивные (8) |
|-----------------|-------------------|
| text, video, audio, image, article | fill_gaps, test, true_false |
| divider, teaching_guide, remember, table | word_order, matching, image_choice |
| vocabulary | flashcards, essay |

**Ключевые модели:** Course, CourseSection, CourseTopic, InteractiveLesson, ExerciseBlock, LessonCourseMaterial

**Права:** admin — полный CRUD; teacher — read-only + прикрепление; student — просмотр прикреплённой части

**Загрузка файлов:** изображения/аудио в S3 (`jsi/courses/`), до 50 МБ

**WYSIWYG:** TipTap для HTML-блоков (text, teaching_guide, remember, article)

**Подсказки ответов:** tooltip при наведении для admin/manager/teacher. Студенты НЕ видят:
- Правильные ответы в fill_gaps, правильные варианты в test/image_choice
- Правильный ответ true_false, правильное предложение word_order, пары matching
- Реализовано через `canSeeAnswers` проверку в `BlockRenderer.tsx`

**Результаты упражнений:**
- API: `POST /api/exercise-results/lessons/{id}/submit` → серверная проверка через `grade_answer()`
- Сохранение ответов студентов + is_correct
- Просмотр результатов: `GET .../my-results` (студент), `GET .../students` (учитель)

**Fill_gaps без gaps:** если массив `gaps` пустой — отображается textarea для свободного ответа

**Навигация по уроку:** sidebar "Содержание" (если >= 3 блока с title), IntersectionObserver для активного блока

**Прикрепление материалов:** `AttachCourseMaterialModal` с поиском, auto-expand дерева, подсветка совпадений, confirmation при прикреплении целого курса/секции

**Кнопка сброса:** после проверки упражнения — кнопка "Сбросить" для повторной попытки

### Импортированные курсы
- English File 4th (ID: 10) — 7 уровней, 292 урока, 10168 блоков
- Family and Friends (ID: 12) — 6 уровней, 166 уроков, 4294 блока
- Business English Market Leader (ID: 15) — 3 уровня, 39 уроков, 980 блоков

### Прочие фичи
- **Матрица цен**: `level_lesson_type_prices` (teacher_id, level, lesson_type_id, price)
- **Teacher Availability**: день недели + время, зелёный фон в расписании
- **Отчёты**: по преподавателям за период + экспорт в Excel (openpyxl)
- **Новости**: admin CRUD, ученики видят опубликованные с баннерами
- **Настройки**: key-value, `whatsapp_manager_phone` → WhatsApp кнопка
- **Неправильные глаголы**: ~137 шт., Web Speech API, student/teacher
- **PDF материалы**: загрузка до 50 МБ, прикрепление к урокам через `AttachMaterialModal`
- **Мобильная версия**: брейкпоинт `lg:` (1024px), гамбургер-меню, адаптивные сетки

## Production
- **Сервер**: ps.kz VPS (Debian 12), IP: 78.40.108.93, SSH: `ssh jsi`
- **Порты**: все на 127.0.0.1 (frontend:3005, backend:8005, postgres:5435), публично только nginx (80, 443)
- **CORS**: только `https://lms.jsi.kz`
- **S3**: endpoint `https://object.pscloud.io`, бакеты `jsi` (файлы) и `jsi-backups` (бэкапы)
- **Бэкапы**: ежедневно 00:00 UTC, ретенция 7 дней, gzip, cron + `backup/backup-to-s3.sh`
- **Nginx**: `proxy_redirect http://$host/ https://$host/;` для исправления FastAPI 307 редиректов

## Известные особенности

### Timezone в датах
- БД хранит datetime без timezone (naive) — фактически **локальное время** (не UTC!)
- **ВАЖНО**: Нельзя использовать `Date.toISOString()` для date_from/date_to — сдвигает дату для UTC+ зон (Казахстан UTC+5/+6). Использовать только локальное форматирование: `getFullYear()/getMonth()/getDate()`

### PostgreSQL Enums
- `values_callable=lambda x: [e.value for e in x]` в SQLAlchemy enum

### Пагинация пользователей
- Backend: `GET /api/users` поддерживает `size` до 10000
- Frontend: загрузка студентов через `usersApi.list(1, 10000, undefined, "student")`

## Миграции (Alembic)
Текущая версия: **024**. Применяются автоматически при деплое.

## Полезные команды
```bash
# Локальный запуск
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev

# Docker
docker compose up -d && docker compose logs -f backend

# Миграции
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# Тесты
cd backend && pytest -v
cd frontend && npm run lint && npm run build

# Production
ssh jsi
cd ~/english-crm && sudo docker compose logs -f backend
sudo nginx -t && sudo systemctl reload nginx
```

## CI/CD
При пуше в `main`: pytest → lint+build → docker build → deploy на VPS + миграции.

## История изменений
Подробная история: [CHANGELOG.md](CHANGELOG.md)
