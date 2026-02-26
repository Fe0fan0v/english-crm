"""
Поиск уроков внутри раскрытой секции Market Leader
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def test_find_lessons():
    session_file = Path(__file__).parent / "session.json"

    print("[START] Testing lesson extraction...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        # Навигация к Pre-Intermediate
        print("\n[NAV] Going to Pre-Intermediate...")
        await page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="domcontentloaded")
        await asyncio.sleep(5)

        await page.wait_for_selector('[id="17221"]', timeout=15000)
        parent_card = await page.query_selector('[id="17221"]')
        await parent_card.click()
        await asyncio.sleep(5)

        await page.wait_for_selector('[id="648501"]', timeout=15000)
        level_card = await page.query_selector('[id="648501"]')
        await level_card.click()
        await asyncio.sleep(7)

        print(f"[INFO] Current URL: {page.url}")

        # Клик на "Содержание"
        content_tab = await page.query_selector('text="Содержание"')
        if content_tab:
            await content_tab.click()
            await asyncio.sleep(2)

        # Найти и раскрыть первую секцию
        print("\n[SECTION] Expanding first section (Careers)...")
        sections = await page.query_selector_all('.section_accordion_list-item')
        print(f"[FOUND] {len(sections)} sections total")

        if len(sections) > 0:
            first_section = sections[0]
            section_text = await first_section.text_content()
            print(f"[INFO] Section: {section_text}")

            # Раскрываем секцию
            await first_section.click()
            await asyncio.sleep(4)

            # Скроллим вниз, чтобы увидеть содержимое
            print("\n[ACTION] Scrolling down to see content...")
            await page.evaluate("window.scrollBy(0, 300)")
            await asyncio.sleep(2)

            # Скриншот после скроллинга
            await page.screenshot(path=str(Path(__file__).parent / "after_scroll.png"), full_page=True)

            # Пробуем разные селекторы для поиска уроков
            print("\n[SEARCH] Trying different selectors for lessons...")

            selectors_to_try = [
                ('a[href*="/lesson/"]', 'Direct lesson links'),
                ('.lesson-item, .book-lesson', 'Lesson items'),
                ('.section_accordion_li-item', 'Accordion lesson items'),
                ('li[class*="lesson"]', 'List items with lesson'),
                ('div[class*="lesson"]', 'Divs with lesson'),
                ('[class*="card"]', 'Cards'),
                ('.tir-drag', 'Draggable items'),
            ]

            found_lessons = False
            for selector, description in selectors_to_try:
                elements = await page.query_selector_all(selector)
                if len(elements) > 0:
                    print(f"\n[FOUND] {description}: {len(elements)} elements")

                    # Показываем первые 5
                    for i, elem in enumerate(elements[:5], 1):
                        text = await elem.text_content()
                        href = await elem.get_attribute('href')
                        classes = await elem.get_attribute('class')

                        if text and len(text.strip()) > 0:
                            print(f"  [{i}] Text: {text.strip()[:60]}")
                            if href:
                                print(f"      Href: {href}")
                            print(f"      Classes: {classes[:80] if classes else 'N/A'}")

                    if selector == 'a[href*="/lesson/"]' and len(elements) > 0:
                        found_lessons = True
                        break

            if not found_lessons:
                print("\n[INFO] No direct lesson links found. Checking HTML structure...")

                # Получаем HTML раскрытой секции
                section_html = await first_section.inner_html()

                # Сохраняем для анализа
                html_path = Path(__file__).parent / "expanded_section.html"
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(section_html)
                print(f"[SAVED] Section HTML: {html_path}")

                # Ищем вложенные элементы внутри секции
                print("\n[SEARCH] Looking for nested elements in section...")
                nested_items = await first_section.query_selector_all('li, div[class*="item"]')
                print(f"[FOUND] {len(nested_items)} nested items in section")

                if len(nested_items) > 0:
                    for i, item in enumerate(nested_items[:10], 1):
                        text = await item.text_content()
                        classes = await item.get_attribute('class')
                        if text and len(text.strip()) > 5:
                            print(f"  [{i}] {text.strip()[:60]}")
                            print(f"      Classes: {classes[:80] if classes else 'N/A'}")

        print("\n[WAIT] Browser will close in 20 seconds...")
        await asyncio.sleep(20)

        await browser.close()
        print("\n[DONE] Test complete!")

if __name__ == "__main__":
    asyncio.run(test_find_lessons())
