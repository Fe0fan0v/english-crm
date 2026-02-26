"""
Парсинг Business English Market Leader с прямой навигацией через клики.
"""
import asyncio
import argparse
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


async def navigate_to_level_by_clicks(edvibe: EdvibeParser, level_info: dict) -> bool:
    """
    Навигация к уровню курса через последовательные клики:
    1. Главная страница материалов
    2. Клик на папку Business English Market Leader
    3. Клик на нужный уровень (Pre-Inter/Inter/Upper)
    """
    print(f"   [NAV] Navigating to {level_info['name']}...")

    # Шаг 1: Открываем главную страницу материалов
    materials_url = "https://edvibe.com/cabinet/school/materials/personal"
    await edvibe.page.goto(materials_url, wait_until="domcontentloaded")
    await asyncio.sleep(5)
    print(f"   [NAV] Step 1: On materials page")

    # Ждём загрузки карточек
    try:
        await edvibe.page.wait_for_selector('.avatar-card, .material_card_list', timeout=10000)
    except:
        print(f"   [WARN] Timeout waiting for cards")

    await asyncio.sleep(2)

    # Шаг 2: Кликаем на папку Business English Market Leader (ID: 17221)
    parent_card = await edvibe.page.query_selector(f'[id="{PARENT_FOLDER_ID}"]')
    if not parent_card:
        print(f"   [ERROR] Parent folder {PARENT_FOLDER_ID} not found")
        # Отладка: показываем какие ID есть
        all_ids = await edvibe.page.query_selector_all('[id]')
        print(f"   [DEBUG] Total elements with ID: {len(all_ids)}")
        for i, elem in enumerate(all_ids[:15]):
            elem_id = await elem.get_attribute("id")
            if elem_id and elem_id.strip():
                print(f"       [{i+1}] ID: {elem_id}")
        return False

    await parent_card.click()
    await asyncio.sleep(5)
    print(f"   [NAV] Step 2: Clicked on parent folder")

    # Отладка: делаем скриншот
    screenshot_path = Path(__file__).parent / f"debug_after_parent_click_{level_info['level']}.png"
    await edvibe.page.screenshot(path=str(screenshot_path))
    print(f"   [DEBUG] Screenshot: {screenshot_path}")

    # Проверяем, какие карточки есть на странице
    all_cards = await edvibe.page.query_selector_all('[id]')
    print(f"   [DEBUG] Found {len(all_cards)} elements with [id] attribute")

    # Показываем первые 10 ID
    for i, card in enumerate(all_cards[:10]):
        card_id = await card.get_attribute("id")
        print(f"       [{i+1}] ID: {card_id}")

    # Шаг 3: Кликаем на нужный уровень
    level_card = await edvibe.page.query_selector(f'[id="{level_info["id"]}"]')
    if not level_card:
        print(f"   [ERROR] Level card {level_info['id']} not found")
        return False

    await level_card.click()
    await asyncio.sleep(7)
    print(f"   [NAV] Step 3: Clicked on level card")

    # Отладка: делаем скриншот после клика на уровень
    screenshot_path2 = Path(__file__).parent / f"debug_after_level_click_{level_info['level']}.png"
    await edvibe.page.screenshot(path=str(screenshot_path2))
    print(f"   [DEBUG] Screenshot after level click: {screenshot_path2}")

    # Проверяем текущий URL
    current_url = edvibe.page.url
    print(f"   [DEBUG] Current URL: {current_url}")

    # Проверяем структуру страницы
    # На странице книги Market Leader уроки организованы как раскрывающиеся секции
    # Проверяем наличие контента
    content_tab = await edvibe.page.query_selector('text="Содержание"')
    if content_tab:
        print(f"   [NAV] OK Found content structure - this is a book page")
        return True

    # Альтернативная проверка - есть ли карточки на странице
    cards = await edvibe.page.query_selector_all('.avatar-card, [class*="lesson"]')
    if len(cards) > 0:
        print(f"   [NAV] OK Found {len(cards)} content elements")
        return True

    print(f"   [WARN] No lessons/content found after navigation")
    return False


async def parse_level(edvibe: EdvibeParser, level_info: dict):
    """Парсинг одного уровня."""
    folder_id = level_info["id"]
    level_name = level_info["level"]
    # Используем формат URL как в Family and Friends
    course_url = f"https://edvibe.com/cabinet/school/materials/personal/folder/{folder_id}"

    print(f"\n{'='*70}")
    print(f"  PARSING: {level_info['name']} ({level_name})")
    print(f"  URL: {course_url}")
    print(f"{'='*70}")

    # Шаг 1: Получаем список уроков через parse_course
    # Передаём parent_folder_id, чтобы парсер мог найти вложенную папку
    course_data = await edvibe.parse_course(course_url, parent_folder_id=PARENT_FOLDER_ID)
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
                print(f"       OK - Extracted {blocks_count} blocks")
                lessons_data.append(lesson_data)
            else:
                print(f"       WARN - Failed to parse lesson")

        except Exception as e:
            print(f"       ERROR: {e}")
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
    filename = f"jsi_hierarchy_{level_name.replace(' ', '_').replace('-', '_')}_{timestamp}.json"
    edvibe.save_to_file(jsi_hierarchy, filename)

    print(f"\n  SAVED: {filename}")
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
    edvibe = EdvibeParser(email, password, headless=not args.no_headless, slow_mo=500)

    try:
        # Запуск браузера
        session_file = Path(__file__).parent / "session.json"
        await edvibe.start(storage_state_path=str(session_file) if session_file.exists() else None)

        # Проверка авторизации
        if session_file.exists():
            print(f"[SESSION] Found saved session: {session_file}")
            await edvibe.page.goto(f"{edvibe.base_url}/cabinet/school/materials/personal", wait_until="load")
            await asyncio.sleep(3)
            if "login" not in edvibe.page.url.lower():
                print("[OK] Session is valid")
            else:
                print("[WARN] Session expired, logging in...")
                if not await edvibe.login(manual=False):
                    print("[ERROR] Login failed")
                    return
                await edvibe.save_session()
        else:
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
