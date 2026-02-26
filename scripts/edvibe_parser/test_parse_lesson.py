"""
Тестовый скрипт для проверки парсинга урока
"""
import asyncio
from playwright.async_api import async_playwright
import json
from pathlib import Path

async def test_parse_lesson():
    """Тестовый парсинг одного урока"""

    folder_url = "https://edvibe.com/cabinet/school/materials/books/folder/17223"
    session_file = Path(__file__).parent / "session.json"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()

        # Load session
        if session_file.exists():
            with open(session_file, 'r') as f:
                session_data = json.load(f)
                await context.add_cookies(session_data.get('cookies', []))
            print("[SESSION] Loaded session from session.json")

        page = await context.new_page()
        await page.goto(folder_url, wait_until="domcontentloaded", timeout=60000)
        print(f"[PAGE] Loaded folder: {folder_url}")

        # Wait for content to load
        await asyncio.sleep(5)

        # Find first lesson and click it
        print("\n=== FINDING FIRST LESSON ===")
        # Look for lesson links - they might be in different formats
        # Try to find lesson items
        await asyncio.sleep(2)

        # Try to find and click first lesson
        first_lesson = await page.query_selector('a[href*="/lesson/"]')
        if not first_lesson:
            # Try alternative selectors
            print("Trying alternative selectors...")
            await asyncio.sleep(10)
            await browser.close()
            return

        lesson_href = await first_lesson.get_attribute("href")
        lesson_title_el = await first_lesson.query_selector('.lesson-title, [class*="title"]')
        lesson_title = await lesson_title_el.inner_text() if lesson_title_el else "Unknown"

        print(f"Found first lesson: {lesson_title}")
        print(f"Lesson URL: {lesson_href}")

        # Click on lesson
        await first_lesson.click()
        print("Clicked on lesson, waiting for load...")
        await asyncio.sleep(5)

        # Check sections
        print("\n=== SECTIONS ===")
        sections = await page.query_selector_all('.sections-list_item')
        print(f"Total sections found: {len(sections)}")

        for i, section in enumerate(sections, 1):
            text = await section.inner_text()
            classes = await section.get_attribute("class")
            print(f"{i}. {text.strip()} - Classes: {classes}")

        # Check sections without .medium
        print("\n=== SECTIONS (without .medium) ===")
        sections_no_medium = await page.query_selector_all('.sections-list_item:not(.medium)')
        print(f"Total sections (no medium): {len(sections_no_medium)}")

        for i, section in enumerate(sections_no_medium, 1):
            text = await section.inner_text()
            print(f"{i}. {text.strip()}")

        # Check exercises in current section
        print("\n=== EXERCISES ===")
        exercises = await page.query_selector_all('.exercise_wrapper')
        print(f"Total exercises: {len(exercises)}")

        for i, exercise in enumerate(exercises[:5], 1):  # First 5
            ex_id = await exercise.get_attribute("id")

            # Title
            title_el = await exercise.query_selector('.exercise-wrapper-title-text')
            title = await title_el.inner_text() if title_el else "No title"

            # Check types
            has_image = await exercise.query_selector('.exercise_images_wrapper img')
            has_topic = await exercise.query_selector('.exercise-topic')
            has_note = await exercise.query_selector('.exercise-note-wrapper, .tir-alert.blue')

            print(f"{i}. ID: {ex_id} - Title: {title.strip()}")
            print(f"   Has image: {has_image is not None}")
            print(f"   Has topic: {has_topic is not None}")
            print(f"   Has note: {has_note is not None}")

        print("\nWaiting 10 seconds for inspection...")
        await asyncio.sleep(10)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_parse_lesson())
