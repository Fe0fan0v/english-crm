
# Just Speak It - Система управления языковой школой (EngCRM)

## Технологии
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Деплой**: Docker Compose на VPS (ps.kz), CI/CD через GitHub Actions
- **Домен**: lms.jsi.kz (nginx reverse proxy + SSL/Let's Encrypt)
- **Хранилище**: ps.kz Object Storage (S3-совместимое)

## Структура
```
backend/
├── app/
│   ├── api/           # Роуты (lessons, groups, users, teacher_dashboard, student_dashboard, courses)
│   ├── models/        # SQLAlchemy модели (user, lesson, group, course, etc.)
│   ├── schemas/       # Pydantic схемы
│   └── database.py    # Подключение к БД
├── alembic/versions/  # Миграции (000-024)
└── requirements.txt

frontend/
├── src/
│   ├── components/    # UI компоненты
│   │   └── blocks/    # BlockEditor.tsx, BlockRenderer.tsx (конструктор курсов)
│   ├── pages/         # Страницы
│   ├── services/      # API клиенты (api.ts, courseApi.ts)
│   └── types/         # TypeScript типы (index.ts, course.ts)
└── package.json

backup/
├── backup-to-s3.sh    # Скрипт автоматического бэкапа PostgreSQL в S3
├── restore-from-s3.sh # Скрипт восстановления из бэкапа
├── backup-config.env.example # Шаблон конфигурации
├── SETUP.md           # Детальная инструкция по настройке
├── QUICKSTART.md      # Быстрый старт после получения credentials
└── README.md          # Краткое описание

scripts/edvibe_parser/
├── parser.py          # Основной парсер курсов Edvibe (Playwright)
├── parse_missing.py   # Парсинг пропущенных уроков
├── import_to_jsi.py   # Импорт в БД JSI (локальный)
├── extract_audio_urls.py    # Извлечение аудио URL из Edvibe
├── extract_titles.py        # Извлечение заголовков упражнений
├── convert_fillgaps.py      # Конвертация text → fill_gaps
├── fix_fillgaps_format.py   # Исправление формата {gap} → {0},{1}
├── convert_empty_tests_to_text.py  # Конвертация test без options → text
├── session.json       # Сохранённая сессия браузера (cookies)
├── requirements.txt   # Зависимости (playwright)
└── output/            # Распарсенные JSON файлы
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

### Фоновые задачи (Background Scheduler)
- Использует APScheduler для планирования периодических задач
- **Очистка ссылок на занятия**: ежедневно в 00:00 UTC удаляет `meeting_url` у завершённых уроков
  - Проверяет уроки где `scheduled_at + duration_minutes < now`
  - Освобождает ссылки Zoom/Meet после окончания занятия
- Scheduler запускается при старте приложения (`lifespan` в `main.py`)
- Логирование всех задач в стандартный logger

### Уведомления
- Модель `Notification` с типами: `lesson_cancelled`, `low_balance`
- При отмене урока — уведомление всем ученикам
- При низком балансе (< 5000 тг) — уведомление ученику
- Компонент `NotificationBell` в header с badge непрочитанных
- API: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
- **Email-уведомления**: ученики получают письмо при новом личном сообщении
  - Красивое HTML-письмо с превью сообщения и кнопкой перехода
  - Настройки SMTP: Gmail, Yandex, Mail.ru (через environment variables)
  - Включение: `EMAIL_ENABLED=true`, настройка SMTP credentials
  - **Production**: активно на сервере с почты `justspeakit1@gmail.com`
  - Настройки прописаны в `docker-compose.prod.yml` (environment variables)
  - Документация: `EMAIL_SETUP.md`

### Группы и уроки
- Уроки могут быть привязаны к группе (`group_id`)
- При создании урока для группы автоматически подтягиваются все ученики

### Прямые назначения преподаватель-ученик (Teacher-Student Assignments)
- Модель `TeacherStudent` для связи индивидуальных учеников с преподавателями
- Таблица `teacher_students` (teacher_id, student_id, created_at)
- **Автоматическое создание связи:**
  - При создании урока (преподаватель + ученики)
  - При добавлении ученика в группу (если у группы есть преподаватель)
  - При назначении преподавателя группе (для всех учеников группы)
- Преподаватель видит назначенных учеников:
  - Во вкладке "Ученики" (GET /api/teacher/students)
  - При создании урока (GET /api/teacher/my-students-for-lessons)
- Преподаватель может писать назначенным ученикам в личные сообщения
- Скрипт импорта: `python -m scripts.import_individual_assignments`

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
- **Admin/manager/teacher** могут создавать уроки
- Клик по ячейке расписания → открывается модалка с предзаполненными датой/временем
- В TeacherDashboardPage:
  - Преподаватель может создавать уроки в своём расписании
  - Менеджер может создавать уроки при просмотре расписания другого учителя
  - Свободное время преподавателя отображается зелёным фоном

### Изменение баланса с типами занятий
- `BalanceChangeModal` поддерживает выбор типа занятия
- При выборе типа и количества занятий — автоматический расчёт суммы
- Автозаполнение описания: "Оплата за X занятий (Тип)"

### SearchableSelect компонент
- Выпадающий список с нечётким поиском (fuzzy matching)
- Поддержка single/multi select
- Используется в LessonCreateModal для выбора преподавателя, группы и учеников

### Повторяющиеся уроки (Batch Creation)
- В модалке создания урока есть переключатель "Расписание на несколько недель"
- Выбор дней недели (Пн, Вт, Ср, Чт, Пт, Сб, Вс)
- Выбор количества недель (1-12)
- Превью всех дат перед созданием
- API endpoint: `POST /api/lessons/batch`
- Схема: `LessonCreateBatch` (weekdays, time, start_date, weeks)
- Автоматическая проверка конфликтов для каждой даты
- Возвращает список созданных уроков и конфликтов

### Личные сообщения (Direct Messages)
- **Преподаватель ↔ Ученик**: Преподаватель может написать только назначенному ученику
- **Менеджер ↔ Ученик**: Менеджеры могут писать любым ученикам через раздел "Сообщения" (`/messages`)
- **Ученик → Преподаватель**: Ученик может написать только назначенному преподавателю
- **Ученик → Менеджер**: Ученики могут писать менеджерам (для поддержки)
- Ограничения проверяются через таблицу `teacher_students`
- Поддержка прикрепления файлов (изображения, документы)
- API endpoints:
  - `GET /api/messages/conversations` — список диалогов
  - `GET /api/messages/{user_id}` — сообщения с пользователем
  - `POST /api/messages` — отправить сообщение (с file_url)
  - `GET /api/messages/unread/count` — количество непрочитанных
- Компоненты: `DirectChat.tsx`, `ManagerMessagesPage.tsx`

### Загрузка файлов в чат (Chat File Uploads)
- Поддержка файлов в личных сообщениях и групповом чате
- Поле `file_url` в моделях DirectMessage и GroupMessage
- Максимальный размер файла: 10 МБ
- Разрешённые форматы: jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, txt, zip, rar
- API endpoint: `POST /api/uploads/chat` — загрузка файла
- Файлы хранятся в `storage/chat/` и раздаются через `/api/uploads/chat/`
- UI: кнопка прикрепления, превью перед отправкой, отображение в сообщениях
- Изображения показываются inline, остальные файлы — как ссылки для скачивания

### Система новостей (News System)
- Модель `News` с полями: title, content, banner_url, is_published
- API endpoints:
  - `GET /api/news` — список опубликованных новостей (для всех)
  - `GET /api/news?show_unpublished=true` — все новости включая черновики (admin only)
  - `POST /api/news` — создание новости (admin only)
  - `PATCH /api/news/{id}` — редактирование (admin only)
  - `DELETE /api/news/{id}` — удаление (admin only)
- Админ создаёт новости с:
  - Заголовком
  - Текстом (многострочный)
  - Баннером (ссылка URL или загрузка файла)
  - Статусом (опубликовано / черновик)
- Ученики видят опубликованные новости в разделе "Новости"
- Поддержка баннеров: отображение изображения, красивое оформление

### Система настроек (Settings System)
- Модель `Settings` для хранения системных настроек (key-value)
- API endpoints:
  - `GET /api/settings/public` — публичные настройки (WhatsApp номер)
  - `GET /api/settings` — все настройки (admin only)
  - `POST /api/settings` — создание настройки (admin only)
  - `PATCH /api/settings/{key}` — редактирование (admin only)
  - `DELETE /api/settings/{key}` — удаление (admin only)
- Страница `/settings` для админа — редактирование настроек
- Текущие настройки: `whatsapp_manager_phone` — номер WhatsApp менеджера
- Кнопка "Связаться с менеджером в WhatsApp" в sidebar ученика (зелёная кнопка)
- Также отображается при низком балансе (≤ 0) в блокировке доступа

### Отчёты с экспортом в Excel
- Страница `ReportsPage` — отчёт по преподавателям за период
- Данные: ученик, вид занятия, кол-во занятий, оплата преподавателю
- Экспорт в Excel (`openpyxl`):
  - `POST /api/reports/teachers/export` — скачать .xlsx файл
  - Стилизованный файл с заголовками, итогами по преподавателям и общим итогом
- Кнопка "Выгрузить в Excel" появляется после формирования отчёта

### Мобильная версия (Mobile Responsive)
- **Брейкпоинт**: `lg:` (1024px) — до этой ширины показывается мобильная версия
- **Поддерживаемые устройства**: iPhone, iPad, Android-планшеты
- **Мобильная навигация**:
  - Гамбургер-меню в header
  - Выдвижной sidebar слева с анимацией
  - Затемнение фона при открытом меню
- **StudentDashboardPage**:
  - Адаптивный профиль (вертикальный на мобильных)
  - Горизонтальный скролл табов
  - Адаптивные сетки карточек (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
  - Мобильное расписание: day picker + карточки уроков вместо таблицы
- **DirectChat**: полноэкранный режим на мобильных
- **CSS утилиты** в `index.css`:
  - `.scrollbar-hide` — скрытие скроллбара
  - `.touch-target` — минимальный размер 44x44px
  - `.pb-safe`, `.pt-safe` — safe area для iOS

### Материалы урока (Lesson Materials)
- Преподаватели могут прикреплять PDF материалы к урокам
- Материалы выбираются из существующей "Базы PDF" (раздел Материалы)
- Модель `LessonMaterial` — Many-to-Many связь между уроками и материалами
- API endpoints:
  - `GET /api/lessons/{lesson_id}/materials` — список материалов урока
  - `POST /api/lessons/{lesson_id}/materials` — прикрепить материал (teacher/admin/manager)
  - `DELETE /api/lessons/{lesson_id}/materials/{material_id}` — открепить материал
- Ученики видят прикреплённые материалы в LessonDetailModal (вкладка "Материалы")
- Кнопки "Открыть" (для всех) и "Открепить" (только для преподавателя)
- Компонент: `AttachMaterialModal.tsx` с fuzzy поиском по названию
- Фильтр "База PDF" в MaterialsPage — показывает только файлы с расширением .pdf

### Загрузка PDF материалов
- API endpoint: `POST /api/uploads/materials` — загрузка PDF файла (до 50 МБ)
- Файлы хранятся в `storage/materials/` и раздаются через `/api/uploads/materials/`
- UI в MaterialsPage: переключатель "Загрузить файл" / "Указать URL"
- Валидация: только .pdf файлы, максимум 50 МБ
- Автозаполнение названия материала из имени файла

### Конструктор курсов (Course Constructor)
Система создания интерактивных учебных материалов с иерархией:
**Курс → Секции → Топики → Уроки → Блоки упражнений**

**Workflow:**
1. **Администратор создаёт курсы** в разделе "Материалы" → "Каталог курсов"
2. **Курсы публикуются** и становятся доступны для прикрепления к урокам
3. **Преподаватель прикрепляет материалы** к своим урокам через кнопку "Добавить материал":
   - Можно прикрепить **весь курс** (например, "English File 4th")
   - Можно прикрепить **секцию** (например, "Beginner")
   - Можно прикрепить **топик** (например, "1A Hello")
   - Можно прикрепить **конкретный урок** (например, "Warm Up", "Listening")
4. **Ученик видит материалы** только если:
   - Урок прошёл и преподаватель отметил "Был" (present)
   - Если преподаватель поставил "Отмена" или "Неявка" — материал скрывается
5. **Напоминание о посещаемости** — у преподавателя напротив прошедших уроков отображается индикатор "Ожидается отметка"

**Модели:**
- `Course` — курс (title, description, cover_url, is_published, created_by_id)
- `CourseSection` — секция курса (course_id, title, description, position)
- `CourseTopic` — топик в секции (section_id, title, description, position)
- `InteractiveLesson` — интерактивный урок (topic_id/section_id, title, description, position, is_published, is_homework)
- `ExerciseBlock` — блок упражнения (lesson_id, block_type, content JSONB, position, title)
- `LessonCourseMaterial` — связь урока с материалом курса (lesson_id, student_id, course_id/section_id/topic_id/interactive_lesson_id)

**Типы блоков (18 шт.):**

| Контентные (10) | Интерактивные (8) |
|-----------------|-------------------|
| text, video, audio, image, article | fill_gaps, test, true_false |
| divider, teaching_guide, remember, table | word_order, matching, image_choice |
| vocabulary | flashcards, essay |

**API endpoints:**
- `GET/POST /api/courses` — список и создание курсов (только admin)
- `GET/PUT/DELETE /api/courses/{id}` — операции с курсом (только admin)
- `GET /api/courses/tree` — дерево опубликованных курсов для выбора материалов (teacher+)
- `POST /api/courses/{id}/sections` — создать секцию (только admin)
- `PUT/DELETE /api/courses/sections/{id}` — операции с секцией
- `POST /api/courses/{id}/sections/reorder` — изменить порядок секций
- `POST /api/courses/sections/{id}/topics` — создать топик (только admin)
- `PUT/DELETE /api/courses/topics/{id}` — операции с топиком
- `POST /api/courses/sections/{id}/topics/reorder` — изменить порядок топиков
- `POST /api/courses/topics/{id}/lessons` — создать урок в топике (только admin)
- `POST /api/courses/sections/{id}/lessons` — создать урок в секции (только admin, для обратной совместимости)
- `GET/PUT/DELETE /api/courses/lessons/{id}` — операции с уроком
- `POST /api/courses/topics/{id}/lessons/reorder` — изменить порядок уроков в топике
- `POST /api/courses/sections/{id}/lessons/reorder` — изменить порядок уроков в секции
- `POST /api/courses/lessons/{id}/blocks` — создать блок
- `PUT/DELETE /api/courses/blocks/{id}` — операции с блоком
- `POST /api/courses/lessons/{id}/blocks/reorder` — изменить порядок блоков
- `GET /api/lessons/{id}/course-materials` — список прикреплённых материалов курса
- `POST /api/lessons/{id}/course-materials` — прикрепить материал курса к уроку (teacher)
- `DELETE /api/lessons/{id}/course-materials/{material_id}` — открепить материал
- `GET /api/student/course-materials` — материалы курсов для ученика (только где present)
- `POST /api/uploads/courses` — загрузка файлов для курсов (изображения, аудио) в S3
- `GET /api/uploads/courses/{filename}` — получение файлов курсов

**Frontend страницы:**
- `CoursesPage` — список курсов в "Каталог курсов" (`/courses`) — только admin
- `CourseEditorPage` — редактор структуры курса (`/courses/:id/edit`) — только admin
- `LessonEditorPage` — редактор блоков урока (`/courses/lessons/:id/edit`) — только admin
- `LessonPreviewPage` — просмотр урока для студента (`/courses/lessons/:id`)

**Компоненты:**
- `BlockEditor.tsx` — редакторы для всех типов блоков с поддержкой загрузки файлов
- `BlockRenderer.tsx` — рендереры для просмотра блоков с интерактивной проверкой ответов
- `AttachCourseMaterialModal.tsx` — выбор курса/секции/топика/урока для прикрепления (teacher)
- `FileUploadButton` — компонент загрузки файлов в S3 (встроен в BlockEditor)

**Загрузка файлов в курсах:**
- Поддержка изображений: jpg, jpeg, png, gif, webp
- Поддержка аудио: mp3, wav, ogg, m4a
- Максимальный размер: 50 МБ
- Файлы загружаются в S3 бакет `jsi/courses/`
- Редакторы с загрузкой: ImageEditor, AudioEditor, ArticleEditor, ImageChoiceEditor, FlashcardsEditor

**Права доступа:**
- admin — полный CRUD курсов, секций, уроков, блоков
- teacher — прикрепление материалов из курсов к своим урокам
- student — просмотр прикреплённых материалов (только если был на уроке)

### Парсер курсов Edvibe (Edvibe Parser)
Автоматизированный парсер для миграции курсов с платформы Edvibe в JSI LMS.

**Возможности:**
- Парсинг всех курсов из личного кабинета Edvibe
- Парсинг отдельного курса (все уроки)
- Парсинг отдельного урока
- Сохранение сессии браузера (не нужно логиниться каждый раз)
- Конвертация в формат JSI LMS: Course → Level (секция) → Lessons → Blocks
- Различение teaching_guide (скрыт от учеников) и remember (видим ученикам) блоков

**Поддерживаемые типы блоков:**
- image, video, audio — медиа-контент
- text, teaching_guide, remember — текстовые блоки
- fill_gaps, test, matching, true_false, word_order — интерактивные упражнения

**Файлы:**
- `scripts/edvibe_parser/parser.py` — основной парсер
- `scripts/edvibe_parser/session.json` — сохранённая сессия (cookies)
- `scripts/edvibe_parser/output/` — JSON файлы с распарсенными данными
- `scripts/edvibe_parser/update_course_docker.py` — обновление курса в Docker
- `scripts/edvibe_parser/fix_teaching_guide.py` — исправление типов блоков в БД

**Импортированные курсы:**
- English File 4th - Beginner (ID: 10) — 1 секция, 31 урок, 1316 блоков

**Использование:**
```bash
# Парсинг курса с указанием названия и уровня
cd scripts/edvibe_parser
python parser.py -e "email" -p "password" --course-url "URL" --course-name "English File 4th" --level-name "Beginner" --no-headless

# Обновление существующего курса на сервере
scp output/jsi_hierarchy_*.json jsi:~/data.json
scp update_course_docker.py jsi:~/update_course.py
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/data.json backend:/app/data.json"
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/update_course.py backend:/app/update_course.py"
ssh jsi "cd ~/english-crm && sudo docker compose exec backend python /app/update_course.py"
```

### Production Deployment & Безопасность
- **Сервер**: ps.kz VPS (Debian 12)
- **IP**: 78.40.108.93
- **SSH**: debian@78.40.108.93 (ключ id_jsi)
- **Домен**: https://lms.jsi.kz
- **SSL**: Let's Encrypt сертификат (автообновление каждые 90 дней)
- **Nginx**: Reverse proxy с SSL терминацией
- **Безопасность**:
  - Все сервисы привязаны к `127.0.0.1` (недоступны извне)
  - Frontend: `127.0.0.1:3005` (внутри контейнера порт 80)
  - Backend: `127.0.0.1:8005` (внутри контейнера порт 8000)
  - PostgreSQL: `127.0.0.1:5435` (внутри контейнера порт 5432)
  - Публичный доступ только через Nginx (порты 80, 443)
  - SSH только по ключу (пароль отключён)
- **CORS**: Настроен только для `https://lms.jsi.kz`
- **Docker Compose**:
  - `docker-compose.yml` — локальная разработка (порты открыты)
  - `docker-compose.prod.yml` — production (порты на localhost)
  - На сервере используется docker-compose.yml с prod настройками
- **WebSocket**: Поддержка WSS (WebSocket Secure) через Nginx
  - Автоматический выбор протокола (wss на HTTPS, ws на HTTP)
  - URL: `wss://lms.jsi.kz/api/groups/ws/{group_id}/chat?token={jwt}`
  - Nginx передаёт Upgrade заголовки для WebSocket proxying
- **Nginx proxy_redirect**: Исправление HTTPS редиректов
  - FastAPI автоматически добавляет trailing slash к URL (307 redirect)
  - Директива `proxy_redirect http://$host/ https://$host/;` исправляет HTTP редиректы на HTTPS
  - Решает проблему Mixed Content Error в браузере

### S3 Object Storage (ps.kz)
- **Endpoint**: https://object.pscloud.io
- **Бакеты**:
  - `jsi` — хранение файлов (фото, материалы, чат, курсы)
  - `jsi-backups` — бэкапы БД
- **Папки в бакете jsi**:
  - `photos/` — фото профилей пользователей
  - `materials/` — PDF материалы
  - `chat/` — файлы из чатов
  - `news/` — баннеры новостей
  - `courses/` — файлы курсов (изображения, аудио)
- **Public URL**: https://jsi.object.pscloud.io
- **Интеграция**: httpx в backend (с AWS Signature V4), автоматическая загрузка файлов в S3
- **Настройки**: S3_ENABLED, S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME, S3_PUBLIC_URL

### Автоматические бэкапы базы данных
- **Хранилище**: ps.kz S3-совместимый Object Storage (бакет `jsi-backups`)
- **Частота**: Ежедневно в 00:00 UTC (05:00 по Алматы)
- **Ретенция**: Последние 7 дней (автоматическое удаление старых)
- **Сжатие**: gzip (~70-80% экономия места)
- **Скрипты**:
  - `backup/backup-to-s3.sh` — Docker-версия (использует pg_dump через docker exec)
  - `backup/restore-from-s3.sh` — восстановление из бэкапа
- **Конфигурация**: `backup/backup-config.env` (не в git, только на сервере)
  - DB_CONTAINER=engcrm-db
  - DB_HOST=127.0.0.1, DB_PORT=5435
  - S3 credentials (ps.kz Object Storage)
  - BACKUP_RETENTION_DAYS=7
- **Автоматизация**:
  - Cron задача пользователя debian: `0 0 * * * /home/debian/english-crm/backup/backup-to-s3.sh`
  - Логирование в `/var/log/postgres-backup.log`
  - Автоматическая очистка старых бэкапов
- **Зависимости на сервере**:
  - postgresql-client (версия 15, для совместимости используется Docker exec)
  - awscli (для работы с S3)
- **Формат бэкапов**: `postgres-backup-YYYY-MM-DD_HH-MM-SS.sql.gz`
- Подробности: [BACKUP.md](BACKUP.md), [backup/SETUP.md](backup/SETUP.md)

## Миграции (Alembic)
Текущая версия: **024**. Файлы в `backend/alembic/versions/`.
Миграции применяются автоматически при деплое (CI/CD).

## TODO
- [ ] Интеграция с Yandex Telemost (авто-создание ссылок на уроки)
- [ ] Парсинг курсов Edvibe:
  - [ ] English File 4th (все уровни: Elementary, Pre-Intermediate, Intermediate, Upper-Intermediate, Advanced)
  - [ ] Family and Friends for Kids (1-6)
  - [ ] Business English Market Leader

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
ssh jsi                          # Алиас из ~/.ssh/config
# или: ssh debian@78.40.108.93
cd ~/english-crm
sudo docker compose logs -f backend

# Nginx на сервере
sudo nginx -t                    # Проверка конфигурации
sudo systemctl reload nginx      # Перезагрузка nginx
sudo systemctl status nginx      # Статус nginx
sudo cat /etc/nginx/sites-available/lms.jsi.kz  # Просмотр конфигурации

# SSL сертификат
sudo certbot renew --dry-run     # Проверка автообновления
sudo certbot certificates        # Просмотр установленных сертификатов

# Бэкапы БД на сервере
cd ~/english-crm/backup
sudo ./backup-to-s3.sh           # Создать бэкап вручную
# Бэкапы автоматически создаются в 00:00 UTC (cron)
tail -f /var/log/postgres-backup.log     # Просмотр логов бэкапов

# S3 команды
aws s3 ls s3://jsi --endpoint-url https://object.pscloud.io          # Список файлов
aws s3 ls s3://jsi-backups --endpoint-url https://object.pscloud.io  # Список бэкапов

# Edvibe Parser
cd scripts/edvibe_parser
python parser.py -e "email" -p "password" --course-url "URL" --no-headless  # Парсинг курса
python parser.py -e "email" -p "password" --all-courses --no-headless       # Все курсы
python parse_missing.py                                                      # Допарсить пропущенные
# Импорт на сервер:
scp output/*.json jsi:~/lessons/
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/lessons backend:/app/lessons"
ssh jsi "cd ~/english-crm && sudo docker compose exec -T backend python /app/batch_import.py /app/lessons --title 'Course Name'"
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
- Frontend отправляет даты с timezone (локальное время клиента с offset)
- БД хранит datetime без timezone (naive) в UTC
- При создании/обновлении урока: Pydantic валидаторы автоматически конвертируют datetime с timezone в UTC naive
- При запросах с date_from/date_to: используется `normalize_datetime_to_utc()` для конвертации в UTC naive
- Функция `normalize_datetime_to_utc()`: конвертирует timezone-aware datetime в UTC и удаляет timezone info
- Реализовано в: `lessons.py`, `student_dashboard.py`, `teacher_dashboard.py`, `schemas/lesson.py`

### Права доступа к API
- `AdminUser` — только admin
- `ManagerUser` — admin или manager
- `TeacherUser` — admin, manager или teacher
- `CurrentUser` — любой авторизованный
- GET `/api/lesson-types` использует `TeacherUser` (teachers нужен доступ для создания уроков!)

## Ключевые компоненты

### Backend API роуты
- `/api/lessons` — CRUD уроков, batch creation, материалы урока (admin/manager/teacher)
  - `GET /lessons/{id}/materials` — список материалов урока
  - `POST /lessons/{id}/materials` — прикрепить материал (teacher/admin/manager)
  - `DELETE /lessons/{id}/materials/{material_id}` — открепить материал
- `/api/teacher` — кабинет преподавателя (расписание, посещаемость, availability)
  - `GET /teacher/lessons-with-materials` — уроки с материалами для преподавателя (все уроки)
- `/api/student` — кабинет ученика (расписание, группы)
  - `GET /student/lessons-with-materials` — уроки с материалами (только начавшиеся и не старше 30 дней)
- `/api/notifications` — уведомления
- `/api/groups` — группы и групповой чат (WebSocket: `/ws/{group_id}/chat`)
- `/api/messages` — личные сообщения (direct messages)
- `/api/uploads` — загрузка файлов (chat, news banners, materials, photos, courses)
- `/api/reports` — отчёты по преподавателям + экспорт в Excel
- `/api/lesson-types` — типы занятий (ManagerUser для GET)
- `/api/levels` — уровни
- `/api/materials` — материалы (CRUD для admin, список и просмотр для всех авторизованных)
- `/api/settings` — настройки системы (admin CRUD, GET /public для всех)
- `/api/news` — новости (admin CRUD, публичный GET для учеников)
- `/api/users` — пользователи (CRUD для admin/manager, список с фильтрацией по роли: `?role=student`, `?role=teacher` и т.д.)
- `/api/courses` — конструктор курсов (CRUD курсов, секций, уроков, блоков)

### Frontend страницы
- `TeacherDashboardPage` — кабинет преподавателя (или просмотр для менеджера), вкладки: Учитель, Ученики (объединённые группы + ученики), Свободное время, Уроки, Сообщения
- `StudentDashboardPage` — кабинет ученика с кнопкой WhatsApp при низком балансе, вкладки: Моя страница, Уроки, Тесты, Материалы, Сообщения
- `UserProfilePage` — профиль пользователя (admin/manager view)
- `SchedulePage` — общее расписание
- `UsersPage`, `GroupsPage`, `LevelsPage`, `LessonTypesPage` — справочники
- `MaterialsPage` — материалы с 4 папками (База PDF, Каталог курсов, Доска, Методист)
- `SettingsPage` — настройки системы (admin only) для редактирования WhatsApp номера менеджера
- `NewsManagementPage` — управление новостями (admin only) с созданием/редактированием/удалением, загрузкой баннеров
- `NewsPage` — просмотр опубликованных новостей для учеников с баннерами
- `KnowledgeBasePage` — база знаний (заглушка) для преподавателей и учеников
- `CoursesPage` — список курсов (замена MaterialsPage)
- `CourseEditorPage` — редактор структуры курса (секции, уроки)
- `LessonEditorPage` — редактор блоков урока (18 типов блоков)
- `LessonPreviewPage` — просмотр урока для студента с интерактивными упражнениями

### Frontend компоненты
- `LessonCreateModal` — создание урока с SearchableSelect
- `LessonDetailModal` — детали урока, отметка посещаемости, материалы урока
- `AttendanceModal` — отметка посещаемости + добавление ссылки на урок
- `AttachMaterialModal` — выбор PDF материалов для прикрепления к уроку (fuzzy search)
- `BalanceChangeModal` — изменение баланса с типами занятий
- `EditUserModal` — редактирование пользователя (включая level_id)
- `SearchableSelect` — выпадающий список с fuzzy search
- `TeacherAvailabilityEditor` — редактор свободного времени
- `NotificationBell` — колокольчик уведомлений в header
- `GroupChat` — чат группы (с WebSocket)
- `DirectChat` — личные сообщения между пользователями
- `BlockEditor` — редакторы для всех 18 типов блоков упражнений
- `BlockRenderer` — рендереры для просмотра блоков с интерактивной проверкой ответов

## История изменений

Подробная история изменений: [CHANGELOG.md](CHANGELOG.md)
