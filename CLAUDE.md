
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
├── alembic/versions/  # Миграции (000-032)
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
- **student** — личный кабинет, расписание, баланс, просмотр прикреплённых курсовых материалов, вкладка «Домашнее задание»

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
- Оба endpoint-а (teacher и manager) выполняют полную логику: списание баланса, начисление зарплаты, уведомление о низком балансе, статус COMPLETED

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
- Синхронизация учеников: `sync_group_students_to_lessons()` при добавлении/удалении ученика из группы обновляет `lesson_students` всех уроков группы (кроме CANCELLED). Добавление — во все уроки (включая прошлые), удаление — только если `attendance_status == PENDING`
- **ВАЖНО**: фильтр по `status=SCHEDULED` вместо `datetime.now()` — БД хранит naive local time (UTC+5), а сервер в UTC

### Прямые назначения преподаватель-ученик
- Таблица `teacher_students`. Автосоздание при создании урока/группы
- Ограничивает чаты: teacher ↔ назначенный ученик, student ↔ назначенный teacher/manager

### Личные сообщения
- Teacher ↔ Student, Manager ↔ Student, Student → Manager (поддержка)
- Поддержка файлов (до 10 МБ): jpg, png, pdf, doc, xls, zip и др.
- Email-уведомления при новом сообщении (SMTP Gmail, production активно)
- **Менеджер**: табы "Активные чаты" (ConversationList) и "Все ученики" в `/messages`

### Уведомления
- Типы: `lesson_cancelled`, `low_balance`. Компонент `NotificationBell` (click-to-expand для длинных уведомлений)
- При низком балансе (< 5000 тг) → уведомление + кнопка WhatsApp менеджера

### Проверка баланса при создании уроков
- **Мягкая проверка**: при создании урока, если `student.balance < lesson_type.price` → урок создаётся, преподаватель получает уведомление (`Notification`, тип `LOW_BALANCE`) с перечислением учеников и их балансов
- Работает во всех 4 эндпоинтах: `POST /api/lessons`, `POST /api/lessons/batch`, `POST /api/teacher/lessons`, `POST /api/teacher/lessons/batch`

### Блокировка ссылки на урок при недостаточном балансе
- Если `student.balance < lesson_type.price` — ссылка на урок (`meeting_url`) скрыта от ученика на уровне API (возвращается `null`)
- Поле `balance_insufficient: bool` в схеме `StudentLessonInfo` — frontend показывает оранжевый блок «Пополните баланс для доступа к уроку»
- При пополнении баланса ссылка становится доступной автоматически (проверка при каждом запросе)
- Защита на 2 уровнях: серверная (API не отдаёт URL) + клиентская (UI блокирует кнопку)

### Конструктор курсов
**Курс → Секции → Топики → Уроки → Блоки упражнений**

**Типы блоков (21 шт.):**
| Контентные (11) | Интерактивные (10) |
|-----------------|-------------------|
| text, video, audio, image, article | fill_gaps, test, true_false |
| divider, teaching_guide, remember, table | word_order, matching, image_choice |
| vocabulary, page_break | flashcards, essay, drag_words, sentence_choice |

**Ключевые модели:** Course, CourseSection, CourseTopic, InteractiveLesson, ExerciseBlock, LessonCourseMaterial, MaterialFolder, HomeworkAssignment, HomeworkTemplate, HomeworkTemplateItem

**Права:** admin — полный CRUD; teacher — read-only + прикрепление; student — просмотр прикреплённой части

**Загрузка файлов:** изображения/аудио в S3 (`jsi/courses/`), до 50 МБ

**WYSIWYG:** TipTap для HTML-блоков (text, teaching_guide, remember, article)

**Подсказки ответов:** визуальные подсказки (зелёная пунктирная рамка) + tooltip для admin/manager/teacher до нажатия «Проверить». Студенты НЕ видят:
- Правильные ответы в fill_gaps и drag_words, правильные варианты в test/image_choice
- Правильный ответ true_false, правильное предложение word_order, пары matching
- **Серверная защита**: `strip_answers_from_content()` в `courses.py` удаляет ответы из JSON для студентов
- **Серверная проверка**: `grade_answer_detailed()` в `grading.py` возвращает результаты по каждому элементу
- Frontend использует `serverDetails` от сервера вместо локальной проверки для студентов
- Блоки `teaching_guide` скрыты от студентов на уровне API и фронтенда, но видны преподавателям/админам/менеджерам в превью и live-сессии (красный блок «Заметка для преподавателя»)
- **Подсказки в live session**: учитель видит правильные ответы до нажатия «Проверить» (состояние `correct_hint` — зелёный пунктирный контур)
- **Ответы ученику после проверки**: `grade_answer_detailed()` возвращает `correct_missed` (невыбранные правильные), `correct_answers` (правильные ответы для ошибочных пропусков), `correct_answer` (true_false), `correct_sentence` (word_order), `correct_pairs` (matching)

**Результаты упражнений:**
- API: `POST /api/exercise-results/lessons/{id}/submit` → серверная проверка через `grade_answer()`
- Сохранение ответов студентов + is_correct
- Просмотр результатов: `GET .../my-results` (студент), `GET .../students` (учитель)

**Fill_gaps без gaps:** если массив `gaps` пустой — отображается textarea для свободного ответа

**Навигация по уроку:** sidebar "Содержание" (если >= 3 блока с title), всегда строится по всем блокам урока (не по текущей странице), клик переключает страницу и скроллит к блоку. IntersectionObserver для активного блока, sticky sidebar (`self-start`)

**Разбивка на страницы (page_break):** блок `page_break` разделяет урок на страницы
- В редакторе: оранжевая пунктирная линия с необязательной меткой
- В превью: блоки разделены на страницы, навигация кнопками «Назад»/«Вперёд» + номера страниц
- Нумерация блоков сквозная (глобальная по всему уроку), ответы сохраняются между страницами
- Без page_break — урок отображается как раньше (полная обратная совместимость)

**Авто-пагинация по заголовкам:** если нет блоков `page_break` и >= 3 блоков с title — автоматическая разбивка
- Каждый блок с title начинает новую страницу
- Sidebar показывает все заголовки, клик переключает страницу
- Подсветка активного пункта по текущей странице

**Прикрепление материалов:** `AttachCourseMaterialModal` с поиском, auto-expand дерева, подсветка совпадений. Кнопки прикрепления только на отдельных уроках (без массового прикрепления курса/секции/топика)

**Переименование уроков:** inline-редактирование названия урока в `CourseEditorPage` — двойной клик по названию или кнопка-карандаш в toolbar. API: `PUT /api/courses/lessons/{id}` (уже существующий endpoint)

**Кнопка сброса:** после проверки упражнения — кнопка "Сбросить" для повторной попытки

**Домашнее задание (Homework Assignments):** преподаватель назначает интерактивные уроки как ДЗ ученикам
- Модель `HomeworkAssignment`: lesson_id, interactive_lesson_id, student_id, assigned_by, status, timestamps
- Статусы в БД: `pending`, `submitted`, `accepted`; статус `in_progress` вычисляется на лету (progress > 0 и status=pending)
- Unique constraint: `(lesson_id, interactive_lesson_id, student_id)`
- Прогресс: `COUNT(ExerciseResult)` / `COUNT(ExerciseBlock where type in INTERACTIVE_TYPES)`
- **API преподавателя**: `POST /api/homework/lessons/{id}/assign` (назначить всем ученикам урока), `GET .../lessons/{id}` (список ДЗ), `PUT .../{id}/accept`, `DELETE .../{id}`
- **API ученика**: `GET /api/student/homework-assignments` (мои ДЗ), `PUT .../homework/{id}/submit` (сдать)
- **UI преподавателя** (LessonDetailModal → таб «Курсы»): кнопка «Задать ДЗ» / badge «ДЗ назначено» на каждом lesson-материале, секция «Назначенные ДЗ» с прогрессом и кнопками «Принять»/удалить
- **UI ученика** (StudentDashboardPage): таб «Домашнее задание» (бывший «Тесты») — карточки ДЗ с прогресс-баром, статус-badges, кнопками «Открыть» и «Сдать»
- **Файлы**: `homework.py` (model, schema, api), `homeworkApi` в api.ts
- **Шаблоны ДЗ** (HomeworkTemplate, миграция 032): admin создаёт шаблоны (название + курс + список интерактивных уроков), при прикреплении курсового материала к уроку — ДЗ автоназначается ученикам по шаблонам
  - CRUD API: `/api/homework-templates` (AdminUser)
  - Автоназначение: в `attach_course_material()` (`lessons.py`) после создания attachment
  - UI: страница «Домашние задания» (бывший «Тесты») — конструктор шаблонов с выбором курса и чекбоксами уроков
  - **Файлы**: `homework_templates.py` (api), `homework_template.py` (schema), `homeworkTemplatesApi` в api.ts

**Конструктор ДЗ (standalone уроки):** admin и teacher создают интерактивные уроки для домашних работ
- Модель: `InteractiveLesson` с `is_standalone=true`, `topic_id=null`
- API: `POST/GET/PUT/DELETE /api/homework-lessons/` (TeacherUser). GET: admin/manager видят все, teacher — только свои
- Frontend: `/homework/editor` — список, создание, редактирование (переиспользование LessonEditorPage). Доступен для admin и teacher
- Назначение: в LessonDetailModal → «Свои задания» → «Задать ДЗ»
- **Файлы**: `homework_lessons.py` (api), `HomeworkEditorPage.tsx`, миграция 034

**Авто-транскрипция в словаре:** при вводе слова — debounced запрос к Free Dictionary API
- Backend: `GET /api/vocabulary/lookup?word=` → `app/utils/dictionary.py` → `dictionaryapi.dev`
- Frontend: автозаполнение транскрипции в VocabularyBlockEditor, подсказка определения

**Курсовые материалы (legacy «Уроки»):** вкладка на дашборде студента с постоянным доступом ко всем курсовым материалам (без лимита 30 дней). Endpoint: `GET /api/student/homework`. Вкладка «Материалы» показывает PDF-файлы (30 дней), «Уроки» — курсовые материалы (всё время)

**Карусель изображений:** блок `image` поддерживает несколько изображений
- Поле `images: CarouselImage[]` (url + caption) в JSONB content
- Обратная совместимость: если `images` пуст — рендерится старое поле `url`
- Редактор: кнопка «Карусель (несколько)» / «Одно изображение» для переключения режимов
- Рендерер: стрелки, точки-индикаторы, счётчик; при 1 изображении — без карусели

**Блок drag_words (перетаскивание слов):** текст с пропусками + пул слов для перетаскивания
- Формат: `text` с плейсхолдерами `{0}`, `{1}`, массив `words` [{index, word}], массив `distractors`
- Click-based взаимодействие: клик по слову → клик по пропуску (мобильная поддержка)
- Серверная проверка: `_grade_drag_words()`, `drag_results` в details
- Защита: `strip_answers_from_content()` убирает `word` из массива, оставляет только `index`

**Блок sentence_choice (выбор варианта из dropdown в тексте):** текст с inline dropdown'ами по паттерну fill_gaps
- Формат: `text` с плейсхолдерами `{0}`, `{1}`, массив `questions: [{id, options: string[], correct_index: number}]`
- Редактор: textarea для текста + секция пропусков с вариантами и radio для правильного ответа
- Рендерер: inline `<select>` в тексте, подсветка результатов (зелёный/красный), teacher hint (dashed green border)
- Backward compat: если `text` пуст — рендерится как нумерованный список dropdown'ов (legacy)
- Серверная проверка: `_grade_sentence_choice()`, `question_results` в details
- Защита: `strip_answers_from_content()` удаляет `correct_index` из каждого вопроса

**Несколько предложений в word_order:** поле `sentences: WordOrderSentence[]`
- Обратная совместимость: если `sentences` пуст — используются старые `correct_sentence`/`shuffled_words`/`hint`
- Ответ: `string[][]` (массив массивов слов) для multi-sentence, `string[]` для single
- Серверная проверка: `sentence_results` в details для multi-sentence

**Смена типа блока с сохранением контента:** при смене типа блока сохраняются совместимые поля:
- HTML-группа (text, teaching_guide, remember, article) → сохраняет `html`
- Медиа-группа (video, audio) → сохраняет `url`, `title`
- Тесты-группа (test, true_false, image_choice) → сохраняет `explanation`

### Live Session (совместная работа)
- Учитель и ученики работают вместе над курсовым материалом в реальном времени (1:1 и групповые)
- **Модель (1:1)**: ученик — источник правды, учитель видит read-only зеркало (answer sync, state snapshot)
- **Модель (группа)**: учитель ведёт класс (навигация, доска, рисование, медиа), каждый ученик работает с упражнениями самостоятельно (ответы НЕ синхронизируются)
- **Multi-peer**: `student_ids: set[int]` + `student_wss: dict[int, WebSocket]` — все ученики урока участвуют
  - Учитель → broadcast всем ученикам: whiteboard, drawing, scroll/page, media, cursor
  - Ученик → teacher (relay): только в 1:1 (answer_change, check, reset, state_snapshot, page_change)
  - В группе student messages НЕ пересылаются (backend `is_group` flag)
  - `peersConnected` counter на фронтенде — отслеживает количество подключённых
- **Транспорт**: WebSocket (`/api/live-sessions/ws/{lesson_id}?token=`), паттерн из `group_messages.py`
- **Хранение**: in-memory dict (`active_sessions`, `user_session_map`), без миграции БД
- **Запуск**: кнопка «Открыть» в `LessonDetailModal` → таб «Курсы», для уроков с >= 1 учеником и `material_type === "lesson"`. Используется `navigate()` (не `window.open`) для избежания блокировки popup. Кнопка «Предпросмотр» — просмотр урока без live-режима
- **Баннер**: `LiveSessionBanner` для студентов, polling `GET /api/live-sessions/active` каждые 5 сек
- **URL**: `/courses/lessons/{interactiveLessonId}?session={lessonId}` — query-param `session` активирует live-режим, `&group=1` для группового режима
- **Синхронизация**: answer_change, answer_check, answer_reset, page_change, state_snapshot, media_control, cursor_move, scroll_to, drawing_stroke, drawing_clear, wb_open, wb_close, wb_add, wb_delete, wb_clear, wb_snapshot
- **Курсор**: `RemoteCursor` — SVG стрелка (#8B5CF6), `position: fixed`, координаты в % viewport, throttle через rAF
- **Медиа**: `onMediaControl`/`mediaCommand` пропсы в `BlockRenderer` → `VideoRenderer`/`AudioRenderer` (play/pause/seeked), флаг `isRemoteAction` предотвращает цикл обратной связи
- **Скролл «За мной»**: кнопка в баннере live-сессии — преподаватель отправляет scroll-позицию + номер страницы, все ученики переключаются на нужную страницу и прокручиваются к позиции. Баннер sticky (`top-14 lg:top-0`, закреплён вверху при скролле), вынесен за пределы `max-w-5xl` контейнера для корректной работы sticky
- **Graceful 409**: повторное нажатие «Открыть» при активной сессии — просто открывает сессию без ошибки
- **Reconnect**: exponential backoff (1s→10s, max 10 попыток), heartbeat ping каждые 30 сек
- **Cleanup**: 60-сек таймаут после отключения всех участников, `_delayed_cleanup` через asyncio.Task
- **REST API**: `POST /api/live-sessions/` (TeacherUser, без student_id — все ученики урока), `GET /active` (CurrentUser), `DELETE /{id}` (TeacherUser)
- **Рисование поверх урока**: `DrawingOverlay.tsx` — Canvas 2D overlay, преподаватель рисует (4 цвета, 3 толщины, очистка), все ученики видят в реальном времени. WebSocket сообщения `drawing_stroke` (points, color, width) и `drawing_clear`
- **Интерактивная доска (Whiteboard)**: полноэкранная страница `/whiteboard` для рисования во время live-сессии
  - Инструменты: Pen, Line, Arrow, Rect, Circle, Text, Image, Eraser
  - Виртуальная система координат 1920×1080 — одинаковое отображение на любых экранах
  - Undo/Redo (Ctrl+Z/Y), очистка всей доски, экспорт в PNG
  - Учитель рисует — все ученики видят read-only в реальном времени через WebSocket (wb_* сообщения)
  - Загрузка изображений на S3 через `courseUploadApi.upload()`
  - Кнопка «Доска» в баннере live-сессии (для учителя), авто-переход всех учеников через `wb_open`
  - При возврате учитель отправляет `wb_close` → все ученики автоматически возвращаются к уроку
  - Snapshot при подключении: учитель отправляет `wb_open` + `wb_snapshot` при `onPeerJoined`
  - Эфемерная (без БД) — состояние в памяти фронтенда
  - URL: `/whiteboard?session={lessonId}&lesson={interactiveLessonId}`
  - `ProtectedFullscreenRoute` — аутентификация без Layout-обёртки
  - **Файлы**: `useWhiteboard.ts`, `WhiteboardCanvas.tsx`, `WhiteboardPage.tsx`
- **Файлы**: `live_sessions.py`, `live_session.py` (schema), `liveSessionApi.ts`, `useLiveSession.ts`, `RemoteCursor.tsx`, `LiveSessionBanner.tsx`, `DrawingOverlay.tsx`, `useWhiteboard.ts`, `WhiteboardCanvas.tsx`, `WhiteboardPage.tsx`

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
- **Материалы с папками**: `MaterialFolder` модель, динамические папки (CRUD API), фильтрация по `folder_id`
- **PDF материалы**: загрузка до 50 МБ, прикрепление к урокам через `AttachMaterialModal`
- **Нормализация email**: `.strip().lower()` при логине, создании и обновлении пользователя + очистка невидимых Unicode-символов на фронтенде
- **Видеоблок**: поддержка YouTube (watch, shorts, live, embed, si-param), Vimeo, прямые .mp4/.webm/.ogg, fallback для любых `/embed/` URL
- **Мобильная версия**: брейкпоинт `lg:` (1024px), гамбургер-меню, адаптивные сетки
- **Фильтр по балансу**: `GET /api/users` поддерживает `balance_from`, `balance_to`, `sort_by` (name, balance_asc, balance_desc). UI: поля «Баланс от/до» + сортировка на странице пользователей
- **Профиль ученика (admin/manager)**: назначенный преподаватель (`GET /api/users/{id}/assigned-teachers`), остаток уроков по типам (`GET /api/users/{id}/remaining-lessons`)
- **Скрытый баланс студента**: временно скрыты баланс в шапке, карточка баланса, секция «Остаток уроков» на дашборде. Флаг `HIDE_BALANCE` в `StudentDashboardPage.tsx`
- **Layout overflow fix**: корневой div — `overflow-x: clip` (не `overflow-x: hidden`!, hidden создаёт scroll-контейнер и ломает sticky). `<main>` — `min-w-0` (позволяет flex-item сжиматься, не блокирует горизонтальный скролл вложенных контейнеров)
- **Расписание**: таблица `min-w-[900px]` для гарантированного горизонтального скролла на узких экранах. Настраиваемый диапазон часов (по умолчанию 8-20), сохраняется в localStorage
- **Удаление ученика**: при soft-delete студента автоматически удаляются его индивидуальные SCHEDULED уроки (без группы, один студент), из групповых — студент удаляется из `lesson_students`
- **Удаление будущих уроков**: кнопка в LessonDetailModal (admin/manager) — вызывает `DELETE /api/lessons/batch-scheduled?student_id=` для удаления всех запланированных уроков ученика

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
Текущая версия: **034**. Применяются автоматически при деплое.

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
