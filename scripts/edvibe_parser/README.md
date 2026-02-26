# Edvibe Course Parser

Скрипт для парсинга курсов с платформы Edvibe и конвертации в формат JSI LMS.

## Структура Edvibe

```
Все курсы (personal/)
├── Beginner (ID: 198472)
│   ├── 1. 1A- A capuccino, please
│   │   ├── Warm-up (раздел)
│   │   │   ├── Упражнение 1 (изображение)
│   │   │   ├── Упражнение 2 (текст)
│   │   │   └── ...
│   │   ├── Listening & speaking (раздел)
│   │   └── ...
│   ├── 2. 1B- World Music
│   └── ... (38 уроков)
├── Elementary (ID: 198474)
├── Pre-intermediate (ID: 198475)
├── Intermediate (ID: 198477)
├── Intermediate Plus (ID: 198478)
├── Upper-intermediate (ID: 198480)
└── Advanced (ID: 198481)
```

## Установка

```bash
cd scripts/edvibe_parser

# Установка зависимостей
pip install playwright
playwright install chromium
```

## Использование

### 1. Парсинг всех курсов

```bash
python parser.py -e "your@email.com" -p "password" --all-courses
```

Это спарсит:
- Список всех курсов
- Все уроки в каждом курсе
- Все разделы и упражнения каждого урока

⚠️ **Внимание**: Полный парсинг занимает много времени (7 курсов × ~38 уроков × ~10 разделов)

### 2. Парсинг одного курса (рекомендуется)

```bash
# По URL курса
python parser.py -e "email" -p "pass" --course-url "https://edvibe.com/cabinet/school/materials/personal/folder/198472"

# Ограничить количество уроков (для теста)
python parser.py -e "email" -p "pass" --course-url "URL" --max-lessons 3
```

### 3. Парсинг одного урока

```bash
python parser.py -e "email" -p "pass" --lesson-url "https://edvibe.com/cabinet/school/materials/personal/lesson/123456"
```

### 4. Режим отладки (с браузером)

```bash
# Показать браузер
python parser.py -e "email" -p "pass" --course-url "URL" --no-headless

# С замедлением (500мс между действиями)
python parser.py -e "email" -p "pass" --course-url "URL" --no-headless --slow 500
```

## Параметры

| Параметр | Описание |
|----------|----------|
| `-e, --email` | Email для входа в Edvibe |
| `-p, --password` | Пароль |
| `--all-courses` | Парсить все курсы |
| `--course-url URL` | URL одного курса |
| `--lesson-url URL` | URL одного урока |
| `--no-headless` | Показывать браузер |
| `--slow N` | Замедление в мс |
| `--max-lessons N` | Макс. уроков (0 = все) |
| `-o, --output` | Имя выходного файла |

## Выходные файлы

Файлы сохраняются в `output/`:

```
output/
├── courses_list_20260203_120000.json    # Список курсов
├── course_Beginner_20260203_120000.json # Полные данные курса
├── raw_lesson_Warmup_20260203_120000.json   # Сырые данные урока
├── jsi_lesson_Warmup_20260203_120000.json   # Формат JSI LMS
└── full_export_20260203_120000.json     # Полный экспорт всех курсов
```

## Формат JSI LMS

```json
{
  "title": "Warm-up",
  "description": "Импортировано из Edvibe",
  "sections": [
    {
      "title": "Warm-up",
      "lessons": [
        {
          "title": "Warm-up",
          "blocks": [
            {
              "block_type": "image",
              "position": 1,
              "content": {
                "url": "https://media.docstorio.com/...",
                "caption": "Introduce yourself"
              }
            },
            {
              "block_type": "teaching_guide",
              "position": 2,
              "content": {
                "text": "<p>1. What's your name?...</p>"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Поддерживаемые типы упражнений

| Edvibe | JSI LMS | Описание |
|--------|---------|----------|
| Изображение | `image` | ✅ Полная поддержка |
| Topic | `teaching_guide` | ✅ Заметки преподавателя |
| Note | `remember` | ✅ Подсказки (синий блок) |
| Видео | `video` | ✅ YouTube, Vimeo, прямые ссылки |
| Аудио | `audio` | ✅ MP3 и др. |
| Fill gaps | `fill_gaps` | ⚠️ Без правильных ответов |
| Test | `test` | ⚠️ Без правильных ответов |
| Matching | `matching` | ⚠️ Без правильных ответов |
| True/False | `true_false` | ⚠️ Без правильных ответов |
| Word order | `word_order` | ⚠️ Без правильного порядка |
| Dialogue | `text` | ✅ Как HTML текст |

> ⚠️ Правильные ответы для интерактивных упражнений хранятся в API Edvibe и недоступны через HTML.

## ID курсов

| Курс | ID | URL |
|------|-----|-----|
| Beginner | 198472 | /folder/198472 |
| Elementary | 198474 | /folder/198474 |
| Pre-intermediate | 198475 | /folder/198475 |
| Intermediate | 198477 | /folder/198477 |
| Intermediate Plus | 198478 | /folder/198478 |
| Upper-intermediate | 198480 | /folder/198480 |
| Advanced | 198481 | /folder/198481 |

## Импорт в JSI LMS

После парсинга:

```bash
cd backend
python -m scripts.edvibe_parser.import_to_jsi ../scripts/edvibe_parser/output/jsi_*.json
```

## Troubleshooting

### Ошибка авторизации
- Проверьте email и пароль
- Запустите с `--no-headless` чтобы увидеть процесс

### Не находит уроки/упражнения
- Edvibe использует динамическую загрузку
- Попробуйте добавить `--slow 1000` для замедления

### Таймаут
- Увеличьте интернет-соединение
- Edvibe может быть медленным

### Браузер закрывается сразу
- Добавьте `--no-headless` и `--slow 500` для отладки
