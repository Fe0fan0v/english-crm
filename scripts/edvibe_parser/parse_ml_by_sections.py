"""
Парсинг Market Leader по диапазону секций
Использование: python parse_ml_by_sections.py --level 1 --start 0 --end 4
"""
import asyncio
import argparse
from datetime import datetime
from pathlib import Path
from parser import EdvibeParser

LEVELS = [
    {"id": "648501", "name": "MARKET LEADER PRE-INTER", "level": "Pre-Intermediate"},
    {"id": "667903", "name": "MARKET LEADER INTER", "level": "Intermediate"},
    {"id": "683180", "name": "MARKET LEADER UPPER", "level": "Upper-Intermediate"},
]

COURSE_NAME = "Business English Market Leader"


async def parse_section_range(edvibe: EdvibeParser, level_info: dict, start_idx: int, end_idx: int):
    """Парсинг диапазона секций"""
    book_id = level_info["id"]
    level_name = level_info["level"]

    print(f"\n{'='*70}")
    print(f"  PARSING: {level_info['name']} ({level_name})")
    print(f"  Sections: {start_idx} to {end_idx-1}")
    print(f"{'='*70}")

    # Навигация
    book_url = f"https://edvibe.com/cabinet/school/materials/book/{book_id}/content"
    await edvibe.page.goto(book_url, wait_until="domcontentloaded")
    await asyncio.sleep(5)

    # Клик на "Содержание"
    content_tab = await edvibe.page.query_selector('text="Содержание"')
    if content_tab:
        await content_tab.click()
        await asyncio.sleep(3)

    # Ждём секции
    try:
        await edvibe.page.wait_for_selector('.section_accordion_list-item', timeout=10000)
        await asyncio.sleep(2)
    except:
        pass

    # Получаем все секции
    all_sections = await edvibe.page.query_selector_all('.section_accordion_list-item')
    print(f"\n[INFO] Total sections found: {len(all_sections)}")

    if start_idx >= len(all_sections):
        print(f"[ERROR] Start index {start_idx} >= {len(all_sections)}")
        return None

    # Ограничиваем end_idx
    actual_end = min(end_idx, len(all_sections))

    print(f"[INFO] Parsing sections {start_idx} to {actual_end-1}")

    all_lessons = []

    for i in range(start_idx, actual_end):
        try:
            # ВАЖНО: перезагружаем список секций на каждой итерации
            # чтобы избежать stale elements
            sections_fresh = await edvibe.page.query_selector_all('.section_accordion_list-item')
            if i >= len(sections_fresh):
                print(f"      [WARN] Section {i} not found, skipping")
                continue

            section = sections_fresh[i]
            # Название секции
            section_text = await section.text_content()
            section_name = section_text.strip().split('\n')[0] if section_text else f"Section {i}"

            print(f"\n  [{i}/{actual_end-1}] {section_name}")

            # Раскрываем секцию
            await section.click()
            await asyncio.sleep(3)
            await edvibe.page.evaluate("window.scrollBy(0, 200)")
            await asyncio.sleep(1)

            # Ищем уроки
            lessons = await section.query_selector_all('.book-lesson')
            print(f"      Found {len(lessons)} lessons")

            for j, lesson_elem in enumerate(lessons, 1):
                try:
                    # Название
                    title_elem = await lesson_elem.query_selector('p')
                    lesson_title = await title_elem.text_content() if title_elem else f"Lesson {j}"
                    lesson_title = lesson_title.strip()

                    # Открываем
                    open_btn = await lesson_elem.query_selector('button.open_lesson-desc, button.open_lesson-mobile')
                    if not open_btn:
                        continue

                    await open_btn.click(force=True)
                    await asyncio.sleep(5)

                    lesson_url = edvibe.page.url

                    # Парсим урок
                    lesson_data = await edvibe.parse_lesson()

                    if lesson_data:
                        lesson_data["source_url"] = lesson_url
                        if not lesson_data.get("title"):
                            lesson_data["title"] = lesson_title

                        exercise_count = sum(len(s.get("exercises", [])) for s in lesson_data.get("sections", []))
                        print(f"        [{j}] {lesson_title}: {exercise_count} exercises")
                        all_lessons.append(lesson_data)

                    # Возвращаемся к странице книги
                    await edvibe.page.goto(book_url, wait_until="domcontentloaded")
                    await asyncio.sleep(4)

                    # Клик на "Содержание"
                    content_tab_reload = await edvibe.page.query_selector('text="Содержание"')
                    if content_tab_reload:
                        await content_tab_reload.click()
                        await asyncio.sleep(2)

                    # Снова раскрываем текущую секцию
                    sections_reload = await edvibe.page.query_selector_all('.section_accordion_list-item')
                    if i < len(sections_reload):
                        await sections_reload[i].click()
                        await asyncio.sleep(3)

                except Exception as e:
                    print(f"        [ERROR] Lesson {j}: {str(e)[:60]}")
                    continue

        except Exception as e:
            print(f"      [ERROR] Section {i}: {str(e)[:60]}")
            print(f"      Continuing with next section...")
            # НЕ прерываем цикл, продолжаем со следующей секцией
            continue

    # Конвертация в JSI
    if len(all_lessons) > 0:
        jsi_hierarchy = edvibe.convert_course_to_jsi_hierarchy(
            course_name=COURSE_NAME,
            level_name=level_name,
            lessons_data=all_lessons
        )

        # Сохранение
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"jsi_ml_{level_name.replace(' ', '_')}_sec{start_idx}_{actual_end-1}_{timestamp}.json"
        edvibe.save_to_file(jsi_hierarchy, filename)

        total_blocks = sum(len(l.get("blocks", [])) for l in jsi_hierarchy["sections"][0]["lessons"])
        print(f"\n[SAVED] {filename}")
        print(f"[STATS] Lessons: {len(all_lessons)}, Blocks: {total_blocks}")

        return jsi_hierarchy
    else:
        print(f"\n[WARN] No lessons collected in range {start_idx}-{actual_end-1}")
        return None


async def main():
    parser = argparse.ArgumentParser(description="Parse Market Leader by section range")
    parser.add_argument("--level", type=int, required=True, help="Level (1-3)")
    parser.add_argument("--start", type=int, required=True, help="Start section index (0-based)")
    parser.add_argument("--end", type=int, required=True, help="End section index (exclusive)")
    parser.add_argument("--no-headless", action="store_true", help="Visible browser")
    args = parser.parse_args()

    email = "jsi.online.2020@gmail.com"
    password = "Vg9$kR7p!sQ2#Lm8"

    edvibe = EdvibeParser(email, password, headless=not args.no_headless, slow_mo=300)

    try:
        session_file = Path(__file__).parent / "session.json"
        await edvibe.start(storage_state_path=str(session_file) if session_file.exists() else None)

        if session_file.exists():
            print(f"[SESSION] Found saved session")
            await edvibe.page.goto(f"{edvibe.base_url}/cabinet/school/materials/personal", wait_until="load")
            await asyncio.sleep(3)
            if "login" not in edvibe.page.url.lower():
                print("[OK] Session is valid")
            else:
                if not await edvibe.login(manual=False):
                    print("[ERROR] Login failed")
                    return
                await edvibe.save_session()
        else:
            if not await edvibe.login(manual=False):
                print("[ERROR] Login failed")
                return
            await edvibe.save_session()

        level_info = LEVELS[args.level - 1]
        result = await parse_section_range(edvibe, level_info, args.start, args.end)

        if result:
            print(f"\n{'='*70}")
            print(f"  COMPLETED!")
            print(f"{'='*70}\n")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(main())
