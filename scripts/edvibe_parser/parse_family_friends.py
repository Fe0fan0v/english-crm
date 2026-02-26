"""
Парсинг всех уровней Family and Friends for Kids (1-6).

Последовательно парсит каждый уровень (folder) с сохранением в JSI формат.

Запуск:
  cd scripts/edvibe_parser
  python parse_family_friends.py
  python parse_family_friends.py --level 1        # Только Level 1
  python parse_family_friends.py --level 3        # Только Level 3
  python parse_family_friends.py --no-headless    # С видимым браузером
"""
import asyncio
import argparse
import re
from datetime import datetime
from pathlib import Path
from parser import EdvibeParser

# Структура Family and Friends
LEVELS = [
    {"id": "198487", "name": "Family and Friends 1", "level": "Level 1"},
    {"id": "198489", "name": "Family and Friends 2", "level": "Level 2"},
    {"id": "198490", "name": "Family and Friends 3", "level": "Level 3"},
    {"id": "198491", "name": "Family and Friends 4", "level": "Level 4"},
    {"id": "198493", "name": "Family and Friends 5", "level": "Level 5"},
    {"id": "198495", "name": "Family and Friends 6", "level": "Level 6"},
]

COURSE_NAME = "Family and Friends"
PARENT_FOLDER_ID = "17222"


async def navigate_to_book_folder(edvibe: EdvibeParser, folder_id: str) -> bool:
    """
    Навигация к папке книги через прямой URL книги.
    Edvibe использует URL вида: /cabinet/school/materials/book/{folder_id}/content
    """
    book_url = f"https://edvibe.com/cabinet/school/materials/book/{folder_id}/content"
    print(f"   [NAV] Going to book URL: {book_url}")
    await edvibe.page.goto(book_url, wait_until="load")
    await asyncio.sleep(5)

    # Проверяем что уроки загрузились
    cards = await edvibe.page.query_selector_all('.book-lesson')
    if cards:
        print(f"   [NAV] OK - found {len(cards)} lessons")
        return True

    # Fallback: навигация через клики
    print(f"   [NAV] Direct URL failed, trying click navigation...")
    return await edvibe.navigate_to_folder(folder_id)


async def parse_level(edvibe: EdvibeParser, level_info: dict):
    """Парсинг одного уровня."""
    folder_id = level_info["id"]
    level_name = level_info["level"]
    course_url = f"https://edvibe.com/cabinet/school/materials/personal/folder/{folder_id}"

    print(f"\n{'='*70}")
    print(f"  PARSING: {level_info['name']} ({level_name})")
    print(f"  URL: {course_url}")
    print(f"{'='*70}")

    # Шаг 1: Получаем список уроков
    course_data = await edvibe.parse_course(course_url)
    lessons_count = len(course_data.get("lessons", []))

    if lessons_count == 0:
        print(f"\n  [WARN] No lessons found for {level_name}!")
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        edvibe.save_to_file(course_data, f"debug_ff_{level_name}_{timestamp}.json")
        return None

    print(f"\n  Found {lessons_count} lessons")

    # Шаг 2: Парсим каждый урок
    lessons_data = []
    for i, lesson_info in enumerate(course_data["lessons"]):
        lesson_title = lesson_info.get('title', f'Lesson {i+1}')
        print(f"\n--- Lesson {i+1}/{lessons_count}: {lesson_title[:50]} ---")

        if i > 0:
            # Возвращаемся к папке через прямой URL книги
            success = await navigate_to_book_folder(edvibe, folder_id)
            if not success:
                print(f"   [ERROR] Navigation failed for lesson {i+1}, skipping")
                continue

            await asyncio.sleep(2)

        # Открываем и парсим урок
        if await edvibe.open_lesson_from_course(lesson_info["index"]):
            lesson_data = await edvibe.parse_lesson()
            lesson_data["lesson_title"] = lesson_title
            lessons_data.append(lesson_data)

            # Считаем блоки
            total_blocks = sum(len(s.get('exercises', [])) for s in lesson_data.get('sections', []))
            print(f"   [OK] {total_blocks} blocks")
        else:
            print(f"   [ERROR] Could not open lesson")

    # Шаг 3: Конвертируем в JSI формат
    jsi_hierarchy = edvibe.convert_course_to_jsi_hierarchy(
        course_name=COURSE_NAME,
        level_name=level_name,
        lessons_data=lessons_data
    )

    # Шаг 4: Сохраняем
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_level = re.sub(r'[^\w\s-]', '', level_name).replace(' ', '_')
    hierarchy_filename = f"jsi_hierarchy_FF_{safe_level}_{timestamp}.json"
    edvibe.save_to_file(jsi_hierarchy, hierarchy_filename)

    # Также сохраняем raw данные
    course_data["lessons_full"] = lessons_data
    raw_filename = f"raw_course_FF_{safe_level}_{timestamp}.json"
    edvibe.save_to_file(course_data, raw_filename)

    # Статистика
    total_lessons = len(jsi_hierarchy["sections"][0]["lessons"])
    total_blocks = sum(len(l["blocks"]) for l in jsi_hierarchy["sections"][0]["lessons"])
    print(f"\n  [OK] {level_name}: {total_lessons} lessons, {total_blocks} blocks")

    return {
        "level": level_name,
        "lessons": total_lessons,
        "blocks": total_blocks,
        "file": hierarchy_filename,
    }


async def main():
    arg_parser = argparse.ArgumentParser(description="Parse Family and Friends for Kids (1-6)")
    arg_parser.add_argument("--level", type=int, help="Level number (1-6), if not set - all")
    arg_parser.add_argument("--no-headless", action="store_true", help="Show browser window")
    args = arg_parser.parse_args()

    # Определяем какие уровни парсить
    if args.level:
        levels_to_parse = [l for l in LEVELS if l["level"] == f"Level {args.level}"]
        if not levels_to_parse:
            print(f"[ERROR] Level {args.level} not found!")
            return
    else:
        levels_to_parse = LEVELS

    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=not args.no_headless
    )

    session_path = str(Path(__file__).parent / 'session.json')
    await edvibe.start(storage_state_path=session_path)

    try:
        # Проверяем сессию
        print("[SESSION] Checking session validity...")
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)

        if "login" in edvibe.page.url.lower():
            print("[WARN] Session expired, logging in...")
            if not await edvibe.login():
                print("[ERROR] Login failed!")
                return
            await edvibe.save_session()
        else:
            print("[OK] Session is valid")

        # Парсим уровни
        results = []
        for level_info in levels_to_parse:
            result = await parse_level(edvibe, level_info)
            if result:
                results.append(result)

            # Сохраняем сессию после каждого уровня
            await edvibe.save_session()

        # Итоговая статистика
        print(f"\n{'='*70}")
        print(f"  TOTAL: Family and Friends for Kids")
        print(f"{'='*70}")
        total_lessons = 0
        total_blocks = 0
        for r in results:
            print(f"  {r['level']}: {r['lessons']} lessons, {r['blocks']} blocks -> {r['file']}")
            total_lessons += r['lessons']
            total_blocks += r['blocks']
        print(f"{'='*70}")
        print(f"  GRAND TOTAL: {total_lessons} lessons, {total_blocks} blocks")
        print(f"{'='*70}")

    except Exception as e:
        print(f"\n[ERROR] Critical error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(main())
