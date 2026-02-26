"""
Скрипт для просмотра курса через сохранённую сессию
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def check_course():
    session_file = Path(__file__).parent / "session.json"

    if not session_file.exists():
        print("[ERROR] Fayl session.json ne nayden!")
        return

    print("[START] Zapusk brauzera s sohranennoy sessiey...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)

        # Загружаем сессию
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)  # 60 секунд

        # Открываем страницу курса
        course_url = "https://edvibe.com/cabinet/school/materials/books/folder/17221"
        print(f"[OPEN] Otkryvayu stranicu: {course_url}")

        try:
            await page.goto(course_url, wait_until="load", timeout=60000)
            await page.wait_for_timeout(3000)
            print("[INFO] Stranica zagruzilась uspeshno")
        except Exception as e:
            print(f"[ERROR] Oshibka zagruzki: {e}")
            # Делаем скриншот для отладки
            screenshot_path = Path(__file__).parent / "check_course_error.png"
            await page.screenshot(path=str(screenshot_path))
            print(f"[DEBUG] Skrinshot sohranyen: {screenshot_path}")

            # Проверяем, не требуется ли авторизация
            login_form = await page.locator("input[type='password'], input[name='password']").count()
            if login_form > 0:
                print("[WARN] Trebuetsya avtorizaciya! Sessiya istekla.")
                print("[INFO] Zapustite parser s parametrami --email i --password")

            await browser.close()
            return

        # Пытаемся получить название курса
        try:
            # Ищем заголовок курса
            title = await page.text_content("h1, .course-title, .folder-title")
            if title:
                print(f"\n[SUCCESS] Nazvanie kursa: {title.strip()}")
        except Exception as e:
            print(f"[WARN] Ne udalos poluchit nazvanie avtomaticheski")

        # Проверяем, есть ли уроки
        try:
            lessons = await page.locator(".lesson-item, .course-item, a[href*='/lesson/']").count()
            print(f"[INFO] Naydeno elementov (urokov): {lessons}")
        except Exception as e:
            print(f"[WARN] Ne udalos poschitat uroki")

        print("\n" + "="*60)
        print("OSMOTRITE STRANICU V BRAUZERE")
        print("="*60)
        print("Opredelite:")
        print("1. Nazvanie kursa")
        print("2. Strukturu (est li urovni/razdely?)")
        print("3. Skolko urokov v kurse")
        print("\nNazhmite Enter v terminale, kogda zakonchite...")
        print("="*60 + "\n")

        # Ждём, пока пользователь осмотрит страницу
        input()

        await browser.close()
        print("\n[DONE] Gotovo! Teper mozhno zapustit parser s nuzhnymi parametrami.")

if __name__ == "__main__":
    asyncio.run(check_course())
