"""
Debug скрипт для анализа страницы lesson-editor
"""
import asyncio
from playwright.async_api import async_playwright
import json
from pathlib import Path

async def debug_lesson():
    """Debug загрузки lesson-editor"""

    lesson_url = "https://edvibe.com/lesson-editor/book/198472/lesson/3076375"
    session_file = Path(__file__).parent / "session.json"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})

        # Load session
        if session_file.exists():
            with open(session_file, 'r') as f:
                session_data = json.load(f)
                await context.add_cookies(session_data.get('cookies', []))
            print("[SESSION] Loaded")

        page = await context.new_page()
        print(f"[PAGE] Going to {lesson_url}")
        await page.goto(lesson_url, wait_until="domcontentloaded", timeout=60000)
        print("[PAGE] Loaded")

        # Wait for dynamic content
        print("[WAIT] Waiting 10 seconds for content...")
        await asyncio.sleep(10)

        # Take screenshot
        await page.screenshot(path="debug_lesson_editor.png", full_page=True)
        print("[SCREENSHOT] Saved to debug_lesson_editor.png")

        # Save HTML
        html = await page.content()
        with open("debug_lesson_editor.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("[HTML] Saved to debug_lesson_editor.html")

        # Check what selectors find
        print("\n=== CHECKING SELECTORS ===")

        selectors_to_check = [
            '.sections-list_item',
            '.sections-list_item:not(.medium)',
            '.exercise_wrapper',
            '.lesson-viewer-header_input',
            '.lesson-description',
            '.lesson-layout',
            '.lesson-viewer-main',
        ]

        for selector in selectors_to_check:
            elements = await page.query_selector_all(selector)
            print(f"{selector:40} -> {len(elements)} elements")

        print("\nWaiting 60 seconds for manual inspection...")
        await asyncio.sleep(60)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_lesson())
