"""
Тестирование раскрытия секции в Market Leader
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def test_expand():
    session_file = Path(__file__).parent / "session.json"

    print("[START] Testing section expansion...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=800)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        # Навигация к Pre-Intermediate
        print("\n[NAV] Going to Pre-Intermediate...")
        await page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="domcontentloaded")
        await asyncio.sleep(5)

        # Ждём загрузки карточек
        await page.wait_for_selector('[id="17221"]', timeout=15000)
        await asyncio.sleep(2)

        # Клик на Business English Market Leader
        parent_card = await page.query_selector('[id="17221"]')
        if not parent_card:
            print("[ERROR] Parent card not found!")
            await browser.close()
            return

        print("[ACTION] Clicking Business English Market Leader...")
        await parent_card.click()
        await asyncio.sleep(5)
        print(f"[INFO] After parent click: {page.url}")

        # Ждём появления карточек уровней
        await page.wait_for_selector('[id="648501"]', timeout=15000)
        await asyncio.sleep(2)

        # Клик на Pre-Intermediate
        level_card = await page.query_selector('[id="648501"]')
        if not level_card:
            print("[ERROR] Level card not found!")
            await browser.close()
            return

        print("[ACTION] Clicking Pre-Intermediate...")
        await level_card.click()
        await asyncio.sleep(7)
        print(f"[INFO] After level click: {page.url}")

        print(f"[INFO] Current URL: {page.url}")

        # Клик на вкладку "Содержание"
        content_tab = await page.query_selector('text="Содержание"')
        if content_tab:
            await content_tab.click()
            await asyncio.sleep(2)

        # Поиск секций
        print("\n[SEARCH] Looking for sections...")
        sections = await page.query_selector_all('.section_accordion_list-item')
        print(f"[FOUND] {len(sections)} sections")

        if len(sections) > 0:
            # Пробуем раскрыть первую секцию (Careers)
            first_section = sections[0]

            # Получаем текст секции
            section_text = await first_section.text_content()
            print(f"\n[TEST] Section 1: {section_text}")

            # Скриншот ДО раскрытия
            await page.screenshot(path=str(Path(__file__).parent / "test_before.png"))

            # Вариант 1: Клик по самой секции
            print("[ACTION] Clicking on section element...")
            await first_section.click()
            await asyncio.sleep(3)

            # Скриншот ПОСЛЕ клика
            await page.screenshot(path=str(Path(__file__).parent / "test_after_v1.png"))

            # Проверяем, появились ли ссылки на уроки
            lesson_links = await page.query_selector_all('a[href*="/lesson/"]')
            print(f"[RESULT] Found {len(lesson_links)} lesson links after click")

            if len(lesson_links) == 0:
                # Вариант 2: Ищем и кликаем по chevron внутри секции
                print("\n[ACTION] Variant 2: Looking for chevron icon...")
                chevron = await first_section.query_selector('i[class*="chevron"], i[class*="arrow"]')
                if chevron:
                    print("[ACTION] Clicking on chevron icon...")
                    await chevron.click()
                    await asyncio.sleep(3)

                    await page.screenshot(path=str(Path(__file__).parent / "test_after_v2.png"))

                    lesson_links = await page.query_selector_all('a[href*="/lesson/"]')
                    print(f"[RESULT] Found {len(lesson_links)} lesson links after chevron click")

            # Если нашли уроки - показываем их
            if len(lesson_links) > 0:
                print("\n[SUCCESS] Section expanded! Lessons:")
                for i, link in enumerate(lesson_links[:10], 1):
                    title = await link.text_content()
                    href = await link.get_attribute('href')
                    print(f"  [{i}] {title.strip()} -> {href}")
            else:
                print("\n[WARN] Section did not expand or has no lessons")

                # Попробуем последний вариант - двойной клик
                print("\n[ACTION] Variant 3: Double click on section...")
                await first_section.dblclick()
                await asyncio.sleep(3)

                await page.screenshot(path=str(Path(__file__).parent / "test_after_v3.png"))

                lesson_links = await page.query_selector_all('a[href*="/lesson/"]')
                print(f"[RESULT] Found {len(lesson_links)} lesson links after double click")

        print("\n[WAIT] Browser will close in 15 seconds...")
        await asyncio.sleep(15)

        await browser.close()
        print("\n[DONE] Test complete!")

if __name__ == "__main__":
    asyncio.run(test_expand())
