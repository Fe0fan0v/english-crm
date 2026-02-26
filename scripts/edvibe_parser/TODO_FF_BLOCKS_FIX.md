# TODO: Исправление интерактивных блоков Family and Friends

## Статус: В ПРОЦЕССЕ (6 февраля 2026)

## Что уже сделано

### 1. parser.py — ОБНОВЛЁН
- Добавлен `_parse_fillgaps_html(html)` — извлекает text + gaps из HTML (rightanswers)
- Добавлен `_extract_test_options(exercise_el, slot_el)` — извлекает опции теста через Playwright
- `_parse_exercise` модифицирован: fill_gaps извлекает gaps из HTML, test извлекает options через Playwright
- `_convert_exercise_to_block` сохраняет HTML для всех интерактивных типов (fill_gaps, test, matching, true_false, word_order)

### 2. fix_ff_blocks.py — ОБНОВЛЁН
- Добавлен `parse_test_options_from_html(html)` — извлечение опций из HTML через BeautifulSoup
- Добавлен `parse_true_false_from_text(text)` — парсинг утверждений из текста (T/F маркеры)
- `fix_test()` теперь пробует извлечь options из HTML
- `fix_true_false()` теперь пробует парсить statements из текста
- Фильтрация мусора "1 / 4" в true_false

### 3. update_ff_docker.py — СОЗДАН (новый файл)
- Обновляет курс ID=12 (Family and Friends) на сервере
- Аналог update_course_docker.py

### 4. Текущий merged JSON пересобран
- Файл: `output/jsi_merged_FF_all_levels_fixed.json`
- 166 уроков, 4292 блока
- Результат БЕЗ перепарсивания (из старых raw данных):

| Тип | Количество | Статус |
|-----|-----------|--------|
| matching | 62 с парами | ГОТОВО |
| true_false | 53 с statements | ГОТОВО |
| essay | 23 с prompt | ГОТОВО |
| image_choice | 14 с options | ГОТОВО |
| fill_gaps | 290 → text | НУЖЕН ПЕРЕПАРСИНГ |
| test | 96 → text | НУЖЕН ПЕРЕПАРСИНГ |

## Что осталось сделать

### Шаг 1: Перепарсить все 6 уровней FF (60-90 мин)

Старые raw файлы не содержат HTML для fill_gaps и test.
Обновлённый парсер теперь сохраняет HTML — нужно заново спарсить.

```bash
cd scripts/edvibe_parser
python parse_family_friends.py --no-headless
# Или по одному уровню:
python parse_family_friends.py --level 1 --no-headless
python parse_family_friends.py --level 2 --no-headless
python parse_family_friends.py --level 3 --no-headless
python parse_family_friends.py --level 4 --no-headless
python parse_family_friends.py --level 5 --no-headless
python parse_family_friends.py --level 6 --no-headless
```

**ВАЖНО:** После перепарсивания нужно обновить имена файлов в `fix_ff_blocks.py`:
- Переменная `RAW_FILES` (строка ~19) — заменить на новые имена raw файлов с новыми timestamp
- Переменная `HIERARCHY_FILES` (строка ~29) — оставить как есть (для missing lessons)

### Шаг 2: Пересобрать merged JSON

```bash
cd scripts/edvibe_parser
python fix_ff_blocks.py
```

Ожидаемый результат: fill_gaps ~280+ с gaps, test ~80+ с options.

### Шаг 3: Обновить курс на сервере

```bash
# Копируем на сервер
scp scripts/edvibe_parser/output/jsi_merged_FF_all_levels_fixed.json jsi:~/ff_data.json
scp scripts/edvibe_parser/update_ff_docker.py jsi:~/update_ff.py

# Копируем в контейнер
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/ff_data.json backend:/app/ff_data.json"
ssh jsi "cd ~/english-crm && sudo docker compose cp ~/update_ff.py backend:/app/update_ff.py"

# Запускаем обновление
ssh jsi "cd ~/english-crm && sudo docker compose exec backend python /app/update_ff.py"
```

### Шаг 4: Верификация

1. SQL запрос на сервере:
```sql
SELECT eb.block_type, COUNT(*)
FROM exercise_blocks eb
JOIN interactive_lessons il ON eb.lesson_id = il.id
JOIN course_sections cs ON il.section_id = cs.id
WHERE cs.course_id = 12
GROUP BY eb.block_type
ORDER BY COUNT(*) DESC;
```

2. Визуально: открыть несколько уроков на https://lms.jsi.kz и проверить:
   - fill_gaps показывают поля ввода
   - test показывают radio buttons
   - matching показывают пары (текст + картинка)
   - true_false показывают утверждения с кнопками

## Файлы проекта

```
scripts/edvibe_parser/
├── parser.py                  # ОБНОВЛЁН — парсер с извлечением данных
├── parse_family_friends.py    # Скрипт запуска парсинга FF (без изменений)
├── fix_ff_blocks.py           # ОБНОВЛЁН — пересборка + исправление блоков
├── update_ff_docker.py        # СОЗДАН — обновление курса ID=12 на сервере
└── output/
    ├── raw_course_FF_Level_*.json         # Старые raw данные (будут перезаписаны)
    ├── jsi_hierarchy_FF_*.json            # Hierarchy файлы (для missing lessons)
    └── jsi_merged_FF_all_levels_fixed.json # Итоговый файл для импорта
```

## Ключевые детали

- Курс Family and Friends на сервере: **ID = 12**
- Edvibe credentials: `jsi.online.2020@gmail.com` / `Vg9$kR7p!sQ2#Lm8`
- Уровни FF: 6 штук (folder IDs: 198487, 198489, 198490, 198491, 198493, 198495)
- Parent folder: 17222
- BeautifulSoup нужен для парсинга: `pip install beautifulsoup4`
- Playwright нужен для парсинга: `pip install playwright && playwright install chromium`
