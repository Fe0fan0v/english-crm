"""
Финальная версия парсера Business English Market Leader
Интегрирован с EdvibeParser для полного парсинга блоков
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


async def navigate_to_book_page(edvibe: EdvibeParser, book_id: str):
    """Переход на страницу книги"""
    book_url = f"https://edvibe.com/cabinet/school/materials/book/{book_id}/content"
    await edvibe.page.goto(book_url, wait_until="domcontentloaded")
    await asyncio.sleep(5)

    # Клик на вкладку "Содержание"
    content_tab = await edvibe.page.query_selector('text="Содержание"')
    if content_tab:
        await content_tab.click()
        await asyncio.sleep(3)

    # Ждём загрузки секций
    try:
        await edvibe.page.wait_for_selector('.section_accordion_list-item', timeout=10000)
        await asyncio.sleep(2)
    except:
        pass  # Секции могут не загрузиться


async def get_lesson_urls_from_section(edvibe: EdvibeParser, section_elem):
    """Получить URL всех уроков из секции"""
    lessons_info = []

    # Получаем название секции
    section_text = await section_elem.text_content()
    section_name = section_text.strip().split('\n')[0] if section_text else "Unknown"

    # Раскрываем секцию
    await section_elem.click()
    await asyncio.sleep(3)

    # Прокручиваем
    await edvibe.page.evaluate("window.scrollBy(0, 200)")
    await asyncio.sleep(1)

    # Ищем уроки
    lessons = await section_elem.query_selector_all('.book-lesson')

    for lesson_elem in lessons:
        try:
            # Название урока
            title_elem = await lesson_elem.query_selector('p')
            lesson_title = await title_elem.text_content() if title_elem else "Untitled"
            lesson_title = lesson_title.strip()

            # Кнопка открытия
            open_btn = await lesson_elem.query_selector('button.open_lesson-desc, button.open_lesson-mobile')
            if not open_btn:
                continue

            # Кликаем
            await open_btn.click(force=True)
            await asyncio.sleep(4)

            # Получаем URL
            lesson_url = edvibe.page.url

            lessons_info.append({
                "title": lesson_title,
                "url": lesson_url
            })

            # Возвращаемся
            await edvibe.page.go_back()
            await asyncio.sleep(3)

            # Снова раскрываем секцию
            sections = await edvibe.page.query_selector_all('.section_accordion_list-item')
            for s in sections:
                text = await s.text_content()
                if section_name in text:
                    await s.click()
                    await asyncio.sleep(2)
                    break

        except Exception as e:
            print(f"        [WARN] Error getting lesson URL: {e}")
            continue

    return section_name, lessons_info


async def parse_level(edvibe: EdvibeParser, level_info: dict):
    """Парсинг одного уровня"""
    book_id = level_info["id"]
    level_name = level_info["level"]

    print(f"\n{'='*70}")
    print(f"  PARSING: {level_info['name']} ({level_name})")
    print(f"{'='*70}")

    # Шаг 1: Навигация к книге
    await navigate_to_book_page(edvibe, book_id)

    # Шаг 2: Получить все секции
    sections = await edvibe.page.query_selector_all('.section_accordion_list-item')
    print(f"\n[INFO] Found {len(sections)} sections")

    # Шаг 3: Для каждой секции получить URL уроков
    all_sections_data = []

    # Парсим все секции
    for i in range(len(sections)):
        try:
            # Перезагружаем список секций после каждой итерации
            await navigate_to_book_page(edvibe, book_id)
            sections = await edvibe.page.query_selector_all('.section_accordion_list-item')

            if i >= len(sections):
                break

            section = sections[i]
            section_name, lessons_info = await get_lesson_urls_from_section(edvibe, section)

            print(f"\n  [{i+1}/{len(sections)}] {section_name}: {len(lessons_info)} lessons")

            if len(lessons_info) == 0:
                print(f"      No lessons found in section, skipping...")
                continue

            # Шаг 4: Парсим каждый урок
            lessons_data = []
            for j, lesson_info in enumerate(lessons_info, 1):
                print(f"    [{j}/{len(lessons_info)}] Parsing: {lesson_info['title']}")

                try:
                    # Переходим на страницу урока явно
                    await edvibe.page.goto(lesson_info['url'], wait_until="domcontentloaded", timeout=60000)
                    await asyncio.sleep(8)

                    # Парсим текущую открытую страницу (БЕЗ передачи URL)
                    lesson_data = await edvibe.parse_lesson()

                    if lesson_data:
                        # Устанавливаем правильный URL и title
                        lesson_data["source_url"] = lesson_info['url']
                        if not lesson_data.get("title") or lesson_data["title"] == "":
                            lesson_data["title"] = lesson_info['title']

                        exercise_count = sum(len(s.get("exercises", [])) for s in lesson_data.get("sections", []))
                        print(f"        OK - {exercise_count} exercises")
                        lessons_data.append(lesson_data)
                    else:
                        print(f"        WARN - No data")

                except Exception as e:
                    print(f"        ERROR - {str(e)[:60]}")
                    continue

                # Пауза между уроками
                await asyncio.sleep(1)

            all_sections_data.append({
                "title": section_name,
                "description": f"{section_name} section",
                "position": i,
                "lessons": lessons_data
            })

            # Возвращаемся к книге после каждой секции
            await navigate_to_book_page(edvibe, book_id)

        except Exception as e:
            print(f"\n  [ERROR] Section {i+1}: {str(e)[:80]}")
            print(f"      Skipping section and continuing...")
            # Пытаемся вернуться к книге
            try:
                await navigate_to_book_page(edvibe, book_id)
            except:
                pass
            continue  # Продолжаем со следующей секции

    # Шаг 5: Собираем все уроки в один список для конвертации
    all_lessons = []
    for section_data in all_sections_data:
        all_lessons.extend(section_data["lessons"])

    print(f"\n[INFO] Total collected: {len(all_sections_data)} sections, {len(all_lessons)} lessons")

    if len(all_lessons) == 0:
        print("[WARN] No lessons collected! Saving empty hierarchy...")

    # Используем метод EdvibeParser для конвертации в JSI формат
    jsi_hierarchy = edvibe.convert_course_to_jsi_hierarchy(
        course_name=COURSE_NAME,
        level_name=level_name,
        lessons_data=all_lessons
    )

    # Сохраняем
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"jsi_hierarchy_{level_name.replace(' ', '_').replace('-', '_')}_{timestamp}.json"
    edvibe.save_to_file(jsi_hierarchy, filename)

    print(f"\n[SAVED] {filename}")

    # Статистика из jsi_hierarchy
    total_lessons = len(jsi_hierarchy["sections"][0]["lessons"])
    total_blocks = sum(len(l.get("blocks", [])) for l in jsi_hierarchy["sections"][0]["lessons"])

    print(f"[STATS] Lessons: {total_lessons}, Blocks: {total_blocks}")

    return jsi_hierarchy


async def main():
    parser = argparse.ArgumentParser(description="Parse Market Leader courses")
    parser.add_argument("--level", type=int, help="Parse only specific level (1-3)")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in visible mode")
    args = parser.parse_args()

    # Credentials
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
            print(f"[SESSION] Found saved session")
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
            print("[LOGIN] Logging in...")
            if not await edvibe.login(manual=False):
                print("[ERROR] Login failed")
                return
            await edvibe.save_session()

        # Определяем уровни для парсинга
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
                print("\n[WAIT] Pause 5 seconds before next level...")
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
