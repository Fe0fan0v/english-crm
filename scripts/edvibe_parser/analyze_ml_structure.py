"""
Анализ HTML структуры Market Leader для понимания раскрывающихся секций
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def analyze_structure():
    session_file = Path(__file__).parent / "session.json"

    print("[START] Analyzing Market Leader structure...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        # Переходим на страницу Pre-Intermediate
        print("\n[STEP 1] Navigating to Pre-Intermediate...")

        # Главная страница
        await page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="domcontentloaded")
        await asyncio.sleep(5)

        # Ждём загрузки карточек
        try:
            await page.wait_for_selector('.avatar-card', timeout=10000)
        except:
            pass

        await asyncio.sleep(2)

        # Клик на Business English Market Leader
        parent_card = await page.query_selector('[id="17221"]')
        if parent_card:
            print("[ACTION] Clicking on Business English Market Leader...")
            await parent_card.click()
            await asyncio.sleep(5)
            print(f"[OK] Clicked, URL: {page.url}")
        else:
            print("[ERROR] Parent card not found")
            await browser.close()
            return

        # Клик на Pre-Intermediate
        level_card = await page.query_selector('[id="648501"]')
        if level_card:
            print("[ACTION] Clicking on Pre-Intermediate...")
            await level_card.click()
            await asyncio.sleep(7)
            print(f"[OK] Clicked, URL: {page.url}")
        else:
            print("[ERROR] Level card not found")
            await browser.close()
            return

        print(f"\n[INFO] Current URL: {page.url}")

        # Анализ структуры
        print("\n[STEP 2] Analyzing page structure...")

        # Ищем вкладку "Содержание"
        content_tab = await page.query_selector('text="Содержание"')
        if content_tab:
            print("[FOUND] Tab 'Soderzhanie' exists")
            await content_tab.click()
            await asyncio.sleep(2)

        # Ищем все секции (раскрывающиеся элементы)
        print("\n[STEP 3] Looking for sections...")

        # Пробуем разные селекторы
        selectors_to_try = [
            ('.avatar-card', 'avatar-card'),
            ('[class*="collapse"]', 'collapse elements'),
            ('[class*="accordion"]', 'accordion elements'),
            ('[class*="expandable"]', 'expandable elements'),
            ('button[class*="expand"]', 'expand buttons'),
            ('.book-chapter, .chapter', 'chapters'),
        ]

        for selector, description in selectors_to_try:
            elements = await page.query_selector_all(selector)
            if elements:
                print(f"\n[FOUND] {description}: {len(elements)} elements")

                # Показываем первые 3
                for i, elem in enumerate(elements[:3], 1):
                    text = await elem.text_content()
                    classes = await elem.get_attribute('class')
                    print(f"  [{i}] Text: {text[:60] if text else 'N/A'}")
                    print(f"      Classes: {classes}")

        # Получаем все элементы с chevron (стрелка вправо/вниз)
        print("\n[STEP 4] Looking for chevron icons (expand indicators)...")
        chevrons = await page.query_selector_all('i[class*="chevron"], i[class*="arrow"], i[class*="expand"]')
        print(f"[FOUND] {len(chevrons)} chevron/arrow icons")

        # Пробуем раскрыть первую секцию
        print("\n[STEP 5] Trying to expand first section...")

        # Ищем элементы которые можно кликнуть
        clickable = await page.query_selector_all('.avatar-card')
        if clickable and len(clickable) > 0:
            first_section = clickable[0]
            section_text = await first_section.text_content()
            print(f"[ACTION] Clicking on: {section_text[:50]}")

            # Делаем скриншот ДО клика
            await page.screenshot(path=str(Path(__file__).parent / "ml_before_expand.png"))

            await first_section.click()
            await asyncio.sleep(3)

            # Делаем скриншот ПОСЛЕ клика
            await page.screenshot(path=str(Path(__file__).parent / "ml_after_expand.png"))
            print("[OK] Section expanded, screenshots saved")

            # Ищем уроки внутри раскрытой секции
            print("\n[STEP 6] Looking for lessons inside expanded section...")
            lessons = await page.query_selector_all('a[href*="/lesson/"]')
            print(f"[FOUND] {len(lessons)} lesson links")

            if lessons:
                for i, lesson in enumerate(lessons[:5], 1):
                    title = await lesson.text_content()
                    href = await lesson.get_attribute('href')
                    print(f"  [{i}] {title[:60]} -> {href}")

        # Сохраняем HTML для детального анализа
        html_content = await page.content()
        html_path = Path(__file__).parent / "ml_structure_analysis.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"\n[SAVED] HTML: {html_path}")

        print("\n[WAIT] Browser will close in 10 seconds...")
        await asyncio.sleep(10)

        await browser.close()
        print("\n[DONE] Analysis complete!")

if __name__ == "__main__":
    asyncio.run(analyze_structure())
