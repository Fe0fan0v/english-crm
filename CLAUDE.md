# EngCRM - Система управления языковой школой

## Технологии
- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Деплой**: Docker Compose на VPS (158.160.141.83), CI/CD через GitHub Actions
- **Домен**: justspeak.heliad.ru (nginx reverse proxy + SSL/Let's Encrypt)

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
- Преподаватель может написать ученику из вкладки "Ученики"
- Ученик может написать преподавателю из вкладки "Сообщения" (раздел "Мои преподаватели")
- Поддержка прикрепления файлов (изображения, документы)
- API endpoints:
  - `GET /api/messages/conversations` — список диалогов
  - `GET /api/messages/{user_id}` — сообщения с пользователем
  - `POST /api/messages` — отправить сообщение (с file_url)
  - `GET /api/messages/unread/count` — количество непрочитанных
- Компонент: `DirectChat.tsx`

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

### Production Deployment & Безопасность
- **Домен**: https://justspeak.heliad.ru
- **SSL**: Let's Encrypt сертификат (автообновление каждые 90 дней)
- **Nginx**: Reverse proxy с SSL терминацией
- **Безопасность**:
  - Все сервисы привязаны к `127.0.0.1` (недоступны извне)
  - Frontend: `127.0.0.1:3005` (внутри контейнера порт 80)
  - Backend: `127.0.0.1:8005` (внутри контейнера порт 8000)
  - PostgreSQL: `127.0.0.1:5435` (внутри контейнера порт 5432)
  - Публичный доступ только через Nginx (порты 80, 443)
- **CORS**: Настроен только для `https://justspeak.heliad.ru`
- **Docker Compose**:
  - `docker-compose.yml` — локальная разработка (порты открыты)
  - `docker-compose.prod.yml` — production (порты на localhost)
  - CI/CD автоматически копирует prod-конфиг при деплое
- **WebSocket**: Поддержка WSS (WebSocket Secure) через Nginx
  - Автоматический выбор протокола (wss на HTTPS, ws на HTTP)
  - URL: `wss://justspeak.heliad.ru/api/groups/ws/{group_id}/chat?token={jwt}`
  - Nginx передаёт Upgrade заголовки для WebSocket proxying
- Подробности: [ARCHITECTURE.md](ARCHITECTURE.md), [WEBSOCKET.md](WEBSOCKET.md), [DEPLOYMENT.md](DEPLOYMENT.md)

## Миграции (Alembic)
Текущая версия: **016**
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
- 011: Add direct_messages table
- 012: Add file_url to messages (group_messages, direct_messages)
- 013: Add settings table (для хранения настроек системы, включая WhatsApp номер)
- 014: Add news table (title, content, banner_url, is_published)
- 015: Add lesson_materials table (Many-to-Many для урок ↔ материалы)
- 016: Add default whatsapp_manager_phone setting (начальное значение +77001234567)

Миграции применяются автоматически при деплое (CI/CD).

## Текущий статус

### Реализовано
- [x] Кабинет преподавателя с расписанием (только просмотр)
- [x] Кабинет ученика
- [x] Система посещаемости с автосписанием баланса
- [x] Проверка конфликтов расписания
- [x] Интеграция уроков с группами
- [x] Матрица цен (уровень × тип урока)
- [x] Групповой чат (REST API, готов к WebSocket)
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
- [x] Dashboard с реальными данными (баланс, ученики, учителя, уроки, графики)
- [x] Повторяющиеся уроки (batch creation на несколько недель)
- [x] Личные сообщения между преподавателями и учениками
- [x] Экспорт отчётов в Excel (.xlsx)
- [x] Загрузка файлов в чат (Direct Messages и Group Chat)
- [x] Мобильная версия для раздела ученика (iPhone, iPad)
- [x] Система привязки PDF материалов к урокам (LessonMaterial)
- [x] Production deployment с доменом и SSL сертификатом
- [x] WebSocket поддержка (WSS через Nginx с автоматическим выбором протокола)
- [x] Безопасная конфигурация (все сервисы на localhost, доступ только через Nginx)

### В процессе / TODO
- [ ] Тесты для учеников в разделе "Материалы"
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

# Nginx на сервере
sudo nginx -t                    # Проверка конфигурации
sudo systemctl reload nginx      # Перезагрузка nginx
sudo systemctl status nginx      # Статус nginx
sudo cat /etc/nginx/sites-available/justspeak.heliad.ru  # Просмотр конфигурации

# SSL сертификат (после настройки DNS)
~/setup-ssl.sh                   # Автоматическая установка SSL
sudo certbot renew --dry-run     # Проверка автообновления
sudo certbot certificates        # Просмотр установленных сертификатов
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
- `/api/lessons` — CRUD уроков, batch creation, материалы урока (admin/manager/teacher)
  - `GET /lessons/{id}/materials` — список материалов урока
  - `POST /lessons/{id}/materials` — прикрепить материал (teacher/admin/manager)
  - `DELETE /lessons/{id}/materials/{material_id}` — открепить материал
- `/api/teacher` — кабинет преподавателя (расписание, посещаемость, availability)
- `/api/student` — кабинет ученика (расписание, группы)
- `/api/notifications` — уведомления
- `/api/groups` — группы и групповой чат (WebSocket: `/ws/{group_id}/chat`)
- `/api/messages` — личные сообщения (direct messages)
- `/api/uploads` — загрузка файлов (chat, news banners)
- `/api/reports` — отчёты по преподавателям + экспорт в Excel
- `/api/lesson-types` — типы занятий (ManagerUser для GET)
- `/api/levels` — уровни
- `/api/materials` — материалы (CRUD для admin, список для всех)
- `/api/settings` — настройки системы (admin CRUD, GET /public для всех)
- `/api/news` — новости (admin CRUD, публичный GET для учеников)

### Frontend страницы
- `TeacherDashboardPage` — кабинет преподавателя (или просмотр для менеджера), вкладки: Учитель, Ученики (объединённые группы + ученики), Свободное время, Уроки, Сообщения
- `StudentDashboardPage` — кабинет ученика с кнопкой WhatsApp при низком балансе
- `UserProfilePage` — профиль пользователя (admin/manager view)
- `SchedulePage` — общее расписание
- `UsersPage`, `GroupsPage`, `LevelsPage`, `LessonTypesPage` — справочники
- `MaterialsPage` — материалы с 4 папками (База PDF, Каталог курсов, Доска, Методист)
- `SettingsPage` — настройки системы (admin only) для редактирования WhatsApp номера менеджера
- `NewsManagementPage` — управление новостями (admin only) с созданием/редактированием/удалением, загрузкой баннеров
- `NewsPage` — просмотр опубликованных новостей для учеников с баннерами
- `KnowledgeBasePage` — база знаний (заглушка) для преподавателей и учеников

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
14. **Исправлены графики на Dashboard** — теперь включают сегодняшний день (было `range(30)`, стало `range(31)`)
15. **SearchableSelect для преподавателя** — в LessonCreateModal выбор преподавателя теперь с fuzzy search
16. **Повторяющиеся уроки** — batch creation на несколько недель с выбором дней недели
17. **Личные сообщения** — преподаватель↔ученик, раздел "Мои преподаватели" в кабинете ученика
18. **Экспорт отчётов в Excel** — кнопка "Выгрузить в Excel" на странице отчётов
19. **Словарь и Неправильные глаголы** — перенесены из вкладок в пункты меню sidebar
20. **Загрузка файлов в чат** — прикрепление файлов в личных сообщениях и групповом чате (до 10 МБ)
21. **Фото профиля в sidebar** — отображается в левом нижнем углу если загружено
22. **nginx client_max_body_size** — увеличен до 20MB для загрузки файлов
23. **Мобильная версия для учеников** — адаптивный дизайн для iPhone/iPad с гамбургер-меню, мобильным расписанием (day picker + карточки), полноэкранным чатом
24. **Система настроек с WhatsApp** — модель Settings, миграция 013, API endpoints для управления настройками (включая номер WhatsApp менеджера), кнопка "Связаться с менеджером в WhatsApp" при балансе <= 0
25. **Объединены вкладки у преподавателя** — вкладки "Ученики" и "Группы" объединены в одну вкладку "Ученики", отображающую группы и всех учеников
26. **Переименована вкладка у преподавателя** — "Личные материалы" → "Уроки"
27. **База знаний** — новая кнопка в sidebar для преподавателей и учеников (страница-заглушка)
28. **Новости** — новая кнопка в sidebar для учеников (страница-заглушка)
29. **Кнопки "Чат" и "Уроки"** — добавлены напротив групп и индивидуальных учеников у преподавателя
30. **4 папки в разделе Материалы** — "База PDF", "Каталог курсов", "Доска", "Методист" (заглушки)
31. **Страница настроек для админа** — новый раздел /settings в админке для редактирования системных настроек (номер WhatsApp менеджера и др.)
32. **Автоматический логаут при 401** — при невалидном токене автоматически очищается localStorage и перенаправление на /login
33. **Кнопка WhatsApp для студентов** — зелёная кнопка "Связаться с менеджером" в нижней части sidebar (над кнопкой "Выйти")
34. **Полноценная система новостей** — админ создаёт новости с заголовком, текстом, баннером (ссылка или загрузка файла), статусом публикации; ученики видят опубликованные новости
35. **Загрузка баннера для новости** — поддержка как ссылки на изображение, так и загрузки файла (JPG, PNG, GIF, WebP, до 10MB)
36. **Уникальные иконки в меню** — заменена повторяющаяся иконка "графики" для новостей на уникальную иконку "газета"
37. **Система привязки PDF к урокам** — модель LessonMaterial (миграция 015), API endpoints для прикрепления/открепления материалов, компонент AttachMaterialModal с fuzzy search, вкладка "Материалы" в LessonDetailModal, фильтр "База PDF" в MaterialsPage
38. **Production deployment с доменом** — домен justspeak.heliad.ru, SSL сертификат Let's Encrypt (автообновление), nginx reverse proxy с SSL терминацией
39. **Безопасная конфигурация портов** — все сервисы привязаны к 127.0.0.1 (frontend:3005, backend:8005, db:5435), публичный доступ только через nginx (80, 443), CORS настроен только для justspeak.heliad.ru
40. **WebSocket через WSS** — поддержка WebSocket Secure (wss://) через nginx, автоматический выбор протокола (ws/wss) в зависимости от окружения, проксирование Upgrade заголовков
41. **Документация архитектуры** — создана полная документация: ARCHITECTURE.md (роутинг, адресация), WEBSOCKET.md (WebSocket конфигурация), DEPLOYMENT.md (деплой и безопасность), DNS-SSL-SETUP.md (настройка SSL)
42. **CI/CD с production config** — автоматическое копирование docker-compose.prod.yml при деплое, применение миграций, проверка health endpoints
43. **Начальное значение настройки WhatsApp** — миграция 016 автоматически создаёт запись с номером менеджера при первом запуске
44. **Загрузка PDF материалов** — админ может загружать PDF файлы в "База PDF" (до 50 МБ), альтернатива указанию URL
45. **Исправлен баг со списком учеников** — индивидуальные ученики (без группы) теперь отображаются у преподавателя во вкладке "Ученики"
