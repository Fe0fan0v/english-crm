"""
Скрипт для детального осмотра курса
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
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        course_url = "https://edvibe.com/cabinet/school/materials/books/folder/17221"
        print(f"[OPEN] Otkryvayu: {course_url}")

        await page.goto(course_url, wait_until="load", timeout=60000)
        await page.wait_for_timeout(3000)

        # Название курса
        try:
            title = await page.text_content("h1")
            print(f"\n[COURSE] Nazvanie: {title.strip() if title else 'N/A'}")
        except:
            print("[WARN] Ne udalos poluchit nazvanie")

        # Ищем подпапки / уровни
        print("\n[INFO] Ishchu urovni/papki...")
        try:
            # Ищем ссылки на папки
            folders = await page.locator("a[href*='/folder/']").all()
            if folders:
                print(f"[INFO] Naydeno papok/urovney: {len(folders)}")
                for i, folder in enumerate(folders[:10], 1):  # Первые 10
                    try:
                        folder_title = await folder.text_content()
                        folder_href = await folder.get_attribute("href")
                        print(f"  {i}. {folder_title.strip()} -> {folder_href}")
                    except:
                        pass
            else:
                print("[INFO] Papki ne naydeny")
        except Exception as e:
            print(f"[ERROR] {e}")

        # Ищем уроки напрямую
        print("\n[INFO] Ishchu uroki...")
        try:
            lessons = await page.locator("a[href*='/lesson/']").all()
            if lessons:
                print(f"[INFO] Naydeno urokov: {len(lessons)}")
                for i, lesson in enumerate(lessons[:5], 1):  # Первые 5
                    try:
                        lesson_title = await lesson.text_content()
                        print(f"  {i}. {lesson_title.strip()}")
                    except:
                        pass
            else:
                print("[INFO] Uroki ne naydeny na etom urovne")
        except Exception as e:
            print(f"[ERROR] {e}")

        # Скриншот
        screenshot_path = Path(__file__).parent / "course_structure.png"
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"\n[SCREENSHOT] Sohranyen: {screenshot_path}")

        # Держим браузер открытым 10 секунд
        print("\n[WAIT] Brauser zakroetsya cherez 10 sekund...")
        await page.wait_for_timeout(10000)

        await browser.close()
        print("\n[DONE] Gotovo!")

if __name__ == "__main__":
    asyncio.run(inspect_course())
