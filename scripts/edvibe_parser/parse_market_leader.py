"""
Парсинг всех уровней Business English Market Leader.

Последовательно парсит каждый уровень (book) с сохранением в JSI формат.

Запуск:
  cd scripts/edvibe_parser
  python parse_market_leader.py
  python parse_market_leader.py --level 1        # Только Pre-Intermediate
  python parse_market_leader.py --level 2        # Только Intermediate
  python parse_market_leader.py --no-headless    # С видимым браузером
"""
import asyncio
import argparse
import re
from datetime import datetime
from pathlib import Path
from parser import EdvibeParser

# Структура Market Leader
LEVELS = [
    {"id": "648501", "name": "MARKET LEADER PRE-INTER", "level": "Pre-Intermediate"},
    {"id": "667903", "name": "MARKET LEADER INTER", "level": "Intermediate"},
    {"id": "683180", "name": "MARKET LEADER UPPER", "level": "Upper-Intermediate"},
]

COURSE_NAME = "Business English Market Leader"
PARENT_FOLDER_ID = "17221"


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

    # Fallback: навигация через клики с указанием родительской папки
    print(f"   [NAV] Direct URL failed, trying click navigation...")
    return await edvibe.navigate_to_folder(folder_id, parent_folder_id=PARENT_FOLDER_ID)


async def parse_level(edvibe: EdvibeParser, level_info: dict):
    """Парсинг одного уровня."""
    folder_id = level_info["id"]
    level_name = level_info["level"]
    course_url = f"https://edvibe.com/cabinet/school/materials/personal/folder/{folder_id}"

    print(f"\n{'='*70}")
    print(f"  PARSING: {level_info['name']} ({level_name})")
    print(f"  URL: {course_url}")
    print(f"{'='*70}")

    # Навигация к книге
    success = await navigate_to_book_folder(edvibe, folder_id)
    if not success:
        print(f"\n  [ERROR] Failed to navigate to {level_name}")
        return None

    # Шаг 1: Получаем список уроков
    course_data = await edvibe.parse_course(course_url)
    lessons_count = len(course_data.get("lessons", []))

    if lessons_count == 0:
        print(f"\n  [WARN] No lessons found for {level_name}!")
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        edvibe.save_to_file(course_data, f"debug_ml_{level_name}_{timestamp}.json")
        return None

    print(f"\n  Found {lessons_count} lessons")

    # Шаг 2: Парсим каждый урок
    lessons_data = []
    for i, lesson_info in enumerate(course_data["lessons"]):
        lesson_title = lesson_info.get("title", f"Lesson {i+1}")
        lesson_url = lesson_info["url"]

        print(f"\n  [{i+1}/{lessons_count}] Parsing: {lesson_title}")

        try:
            # Парсим урок
            lesson_data = await edvibe.parse_lesson(lesson_url)

            if lesson_data:
                blocks_count = len(lesson_data.get("blocks", []))
                print(f"       ✓ Extracted {blocks_count} blocks")
                lessons_data.append(lesson_data)
            else:
                print(f"       ✗ Failed to parse lesson")

        except Exception as e:
            print(f"       ✗ ERROR: {e}")
            continue

    # Шаг 3: Формируем иерархию JSI
    jsi_hierarchy = {
        "course_name": COURSE_NAME,
        "sections": [
            {
                "title": level_name,
                "description": f"{COURSE_NAME} - {level_name}",
                "position": LEVELS.index(level_info) + 1,
                "lessons": lessons_data
            }
        ]
    }

    # Сохраняем
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"jsi_hierarchy_{level_name.replace(' ', '_')}_{timestamp}.json"
    edvibe.save_to_file(jsi_hierarchy, filename)

    print(f"\n  ✓ SAVED: {filename}")
    print(f"  Lessons: {len(lessons_data)}")

    total_blocks = sum(len(l.get("blocks", [])) for l in lessons_data)
    print(f"  Blocks: {total_blocks}")

    return jsi_hierarchy


async def main():
    parser = argparse.ArgumentParser(description="Parse Market Leader courses")
    parser.add_argument("--level", type=int, help="Parse only specific level (1-3)")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in visible mode")
    args = parser.parse_args()

    # Email и пароль
    email = "jsi.online.2020@gmail.com"
    password = "Vg9$kR7p!sQ2#Lm8"

    # Инициализация парсера
    edvibe = EdvibeParser(email, password, headless=not args.no_headless, slow_mo=300)

    try:
        # Запуск браузера
        session_file = Path(__file__).parent / "session.json"
        await edvibe.start(storage_state_path=str(session_file) if session_file.exists() else None)

        # Проверка авторизации
        if session_file.exists():
            print(f"[SESSION] Found saved session: {session_file}")
            # Проверяем что сессия валидна
            await edvibe.page.goto(f"{edvibe.base_url}/cabinet/school/materials/personal", wait_until="load")
            await asyncio.sleep(3)
            if "login" not in edvibe.page.url.lower():
                print("[OK] Session is valid, skipping login")
            else:
                print("[WARN] Session expired, need to login again")
                if not await edvibe.login(manual=False):
                    print("[ERROR] Login failed")
                    return
                await edvibe.save_session()
        else:
            # Нет сохранённой сессии - логинимся
            print("[LOGIN] Logging in to Edvibe...")
            if not await edvibe.login(manual=False):
                print("[ERROR] Login failed")
                return
            await edvibe.save_session()

        # Определяем какие уровни парсить
        if args.level:
            levels_to_parse = [LEVELS[args.level - 1]]
        else:
            levels_to_parse = LEVELS

        print(f"\n{'='*70}")
        print(f"  COURSE: {COURSE_NAME}")
        print(f"  Levels to parse: {len(levels_to_parse)}")
        print(f"{'='*70}")

        # Парсим уровни
        results = []
        for level_info in levels_to_parse:
            result = await parse_level(edvibe, level_info)
            if result:
                results.append(result)

            # Пауза между уровнями
            if level_info != levels_to_parse[-1]:
                print("\n  [WAIT] Pause 5 seconds before next level...")
                await asyncio.sleep(5)

        # Итоги
        print(f"\n{'='*70}")
        print(f"  FINISHED!")
        print(f"  Successfully parsed: {len(results)}/{len(levels_to_parse)} levels")
        print(f"{'='*70}\n")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(main())
