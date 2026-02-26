"""
Улучшенный скрипт для осмотра курса с ожиданием загрузки контента
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def inspect_course():
    session_file = Path(__file__).parent / "session.json"

    if not session_file.exists():
        print("[ERROR] Fayl session.json ne nayden!")
        return

    print("[START] Zapusk brauzera...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(90000)

        course_url = "https://edvibe.com/cabinet/school/materials/books/folder/17221"
        print(f"[OPEN] Otkryvayu: {course_url}")

        await page.goto(course_url, wait_until="domcontentloaded", timeout=60000)
        print("[INFO] DOM zagruzhen, zhdu dinamichesky kontent...")

        # Ждём загрузки контента (Vue.js рендеринг)
        await page.wait_for_timeout(5000)

        # Пробуем разные варианты ожидания
        try:
            # Ждём появления любого контента
            await page.wait_for_selector("main, .content, .folder-content, .lesson-list, article", timeout=15000)
            print("[INFO] Kontent poyavilsya")
        except:
            print("[WARN] Ne udalos dojdatsya kontenta, prodolzhayu...")

        # Дополнительное время на рендеринг
        await page.wait_for_timeout(3000)

        # Название курса
        try:
            title = await page.text_content("h1")
            print(f"\n[COURSE] Nazvanie: {title.strip() if title else 'N/A'}")
        except:
            print("[WARN] Ne udalos poluchit nazvanie")

        # Получаем весь HTML для анализа
        html_content = await page.content()

        # Ищем карточки/элементы
        print("\n[INFO] Analiziruyu strukturu...")

        # Различные варианты селекторов
        selectors_to_try = [
            ("a[href*='/folder/']", "Papki/Urovni"),
            ("a[href*='/lesson/']", "Uroki"),
            (".card", "Kartochki"),
            (".folder-item", "Elementy papok"),
            (".lesson-item", "Elementy urokov"),
            ("article", "Statyi"),
            ("[class*='folder']", "Elementy s 'folder'"),
            ("[class*='lesson']", "Elementy s 'lesson'"),
            ("[class*='card']", "Elementy s 'card'"),
        ]

        found_something = False
        for selector, description in selectors_to_try:
            try:
                elements = await page.locator(selector).all()
                if elements:
                    print(f"[FOUND] {description}: {len(elements)}")
                    found_something = True
                    # Показываем первые 5
                    for i, elem in enumerate(elements[:5], 1):
                        try:
                            text = await elem.text_content()
                            href = await elem.get_attribute("href")
                            if text and text.strip():
                                print(f"  {i}. {text.strip()[:60]}" + (f" -> {href}" if href else ""))
                        except:
                            pass
            except:
                pass

        if not found_something:
            print("[WARN] Ne naydeno elementov, proveryu HTML...")
            # Проверяем, есть ли текст курса в HTML
            if "Market Leader" in html_content:
                print("[INFO] Nazvanie kursa est v HTML")
            if "folder" in html_content.lower():
                print("[INFO] Slovo 'folder' est v HTML")
            if "lesson" in html_content.lower():
                print("[INFO] Slovo 'lesson' est v HTML")

        # Скриншот после загрузки
        screenshot_path = Path(__file__).parent / "course_structure_v2.png"
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"\n[SCREENSHOT] Sohranyen: {screenshot_path}")

        # Сохраняем HTML
        html_path = Path(__file__).parent / "course_page.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"[HTML] Sohranyen: {html_path}")

        # Держим браузер открытым 15 секунд
        print("\n[WAIT] Osmotr brauzera - zakroetsya cherez 15 sekund...")
        await page.wait_for_timeout(15000)

        await browser.close()
        print("\n[DONE] Gotovo!")

if __name__ == "__main__":
    asyncio.run(inspect_course())
