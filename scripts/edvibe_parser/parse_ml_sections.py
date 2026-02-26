"""
Парсинг Market Leader с раскрывающимися секциями
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

async def navigate_to_level(page, level_id: str):
    """Навигация к уровню курса"""
    print(f"[NAV] Going to level {level_id}...")

    await page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="domcontentloaded")
    await asyncio.sleep(5)

    # Business English Market Leader
    await page.wait_for_selector('[id="17221"]', timeout=15000)
    parent_card = await page.query_selector('[id="17221"]')
    await parent_card.click()
    await asyncio.sleep(5)

    # Уровень (Pre-Inter/Inter/Upper)
    await page.wait_for_selector(f'[id="{level_id}"]', timeout=15000)
    level_card = await page.query_selector(f'[id="{level_id}"]')
    await level_card.click()
    await asyncio.sleep(7)

    # Клик на вкладку "Содержание"
    content_tab = await page.query_selector('text="Содержание"')
    if content_tab:
        await content_tab.click()
        await asyncio.sleep(2)

    print(f"[OK] At URL: {page.url}")
    return True


async def parse_lesson_page(page):
    """Парсинг страницы урока - извлечение блоков"""
    lesson_url = page.url

    print(f"        [PARSE] URL: {lesson_url}")

    # Ждём загрузки страницы урока
    await asyncio.sleep(5)

    # Получаем название урока
    try:
        title_elem = await page.query_selector('h1, .lesson-title')
        title = await title_elem.text_content() if title_elem else "Untitled"
        title = title.strip()
    except:
        title = "Untitled"

    print(f"        [PARSE] Title: {title}")

    # Здесь должна быть логика парсинга блоков
    # Пока возвращаем заглушку
    lesson_data = {
        "title": title,
        "url": lesson_url,
        "blocks": []  # TODO: parse blocks
    }

    return lesson_data


async def parse_section(page, section_elem, section_index: int):
    """Парсинг одной секции"""
    # Получаем название секции
    section_text = await section_elem.text_content()
    section_name = section_text.strip().split('\n')[0] if section_text else f"Section {section_index}"

    print(f"\n  [SECTION {section_index}] {section_name}")

    # Раскрываем секцию
    await section_elem.click()
    await asyncio.sleep(4)

    # Прокручиваем для видимости
    await page.evaluate("window.scrollBy(0, 200)")
    await asyncio.sleep(1)

    # Ищем уроки внутри секции
    lessons = await section_elem.query_selector_all('.book-lesson')
    print(f"  [FOUND] {len(lessons)} lessons in section")

    lessons_data = []

    for i, lesson_elem in enumerate(lessons, 1):
        try:
            # Получаем название урока
            lesson_title_elem = await lesson_elem.query_selector('p')
            lesson_title = await lesson_title_elem.text_content() if lesson_title_elem else f"Lesson {i}"
            lesson_title = lesson_title.strip()

            print(f"    [{i}/{len(lessons)}] {lesson_title}")

            # Ищем кнопку "Открыть урок"
            open_btn = await lesson_elem.query_selector('button.open_lesson-desc, button.open_lesson-mobile')
            if not open_btn:
                print(f"        [WARN] No open button found")
                continue

            # Кликаем на кнопку (force=True чтобы обойти перекрытие)
            await open_btn.click(force=True)
            await asyncio.sleep(5)

            # Парсим урок
            lesson_data = await parse_lesson_page(page)
            lessons_data.append(lesson_data)

            # Возвращаемся назад
            await page.go_back()
            await asyncio.sleep(4)

            # Снова раскрываем секцию после возврата
            # Ищем секцию по названию
            sections = await page.query_selector_all('.section_accordion_list-item')
            target_section = None
            for section in sections:
                text = await section.text_content()
                if section_name in text:
                    target_section = section
                    break

            if target_section:
                await target_section.click()
                await asyncio.sleep(3)
            else:
                print(f"        [WARN] Could not find section {section_name} after going back")

        except Exception as e:
            print(f"        [ERROR] Failed to parse lesson")
            continue

    return {
        "title": section_name,
        "lessons": lessons_data
    }


async def parse_market_leader_level(level_id: str, level_name: str):
    """Парсинг одного уровня Market Leader"""
    session_file = Path(__file__).parent / "session.json"

    print(f"\n{'='*70}")
    print(f"  PARSING: Market Leader - {level_name}")
    print(f"{'='*70}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        try:
            # Навигация
            await navigate_to_level(page, level_id)

            # Находим все секции
            sections = await page.query_selector_all('.section_accordion_list-item')
            print(f"\n[FOUND] {len(sections)} sections total")

            # Парсим каждую секцию (TEST: только первые 2)
            sections_data = []
            for i, section in enumerate(sections[:2], 1):  # TEST: only first 2 sections
                section_data = await parse_section(page, section, i)
                if section_data:
                    sections_data.append(section_data)

                # Пауза между секциями
                if i < len(sections[:2]):
                    await asyncio.sleep(2)

            # Формируем результат
            result = {
                "course_name": "Business English Market Leader",
                "level": level_name,
                "sections": sections_data,
                "parsed_at": datetime.now().isoformat()
            }

            # Сохраняем
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"ml_{level_name.replace(' ', '_').replace('-', '_')}_{timestamp}.json"
            output_path = Path(__file__).parent / "output" / filename

            output_path.parent.mkdir(exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"\n[SAVED] {output_path}")

            total_lessons = sum(len(s["lessons"]) for s in sections_data)
            print(f"[STATS] Sections: {len(sections_data)}, Lessons: {total_lessons}")

            return result

        finally:
            await browser.close()


async def main():
    # Парсинг Pre-Intermediate
    result = await parse_market_leader_level("648501", "Pre-Intermediate")

    print(f"\n{'='*70}")
    print(f"  DONE!")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    asyncio.run(main())
