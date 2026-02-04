#!/usr/bin/env python3
"""Extract all images from carousel - direct URL approach"""
import asyncio
import json
from pathlib import Path
from parser import EdvibeParser


async def extract_carousel():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    await edvibe.start(storage_state_path='session.json')

    try:
        # Try direct URL from screenshot (lesson-editor)
        # URL pattern: https://edvibe.com/cabinet/lesson-editor/book/{id}
        print("Trying to find lesson ID...")

        # First go to materials and search
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)
        await edvibe.navigate_to_folder('198472')
        await asyncio.sleep(3)

        # Open 1A cappuccino lesson
        cards = await edvibe.page.query_selector_all('.book-lesson')
        await cards[3].dblclick(force=True)
        await asyncio.sleep(5)

        # Look for nested lessons (sub-sections that open separately)
        print("\n=== Looking for nested lessons ===")

        # Check current URL
        current_url = edvibe.page.url
        print(f"Current URL: {current_url}")

        # Look for clickable elements that might be nested lessons
        lesson_items = await edvibe.page.query_selector_all('[class*="lesson"], [class*="sub-section"], [class*="nested"]')
        print(f"Found {len(lesson_items)} potential nested items")

        # Also look for any text containing "Vocabulary: numbers"
        vocab_elements = await edvibe.page.query_selector_all(':text("Vocabulary")')
        print(f"Found {len(vocab_elements)} elements with 'Vocabulary'")

        # Try searching the page for all images
        print("\n=== Searching entire page for carousel images ===")

        all_images = await edvibe.page.query_selector_all('img[src*="docstorio"], img[src*="LessonExercise"]')
        print(f"Found {len(all_images)} lesson images on page")

        for i, img in enumerate(all_images[:20]):
            src = await img.get_attribute('src')
            print(f"  {i+1}: {src}")

        # Take screenshot
        await edvibe.page.screenshot(path='page_screenshot.png')
        print("\nSaved screenshot to page_screenshot.png")

        # Keep browser open
        print("\n\nPlease manually navigate to the lesson with image carousel.")
        print("The browser will stay open for 60 seconds...")
        print("Look for 'Vocabulary: numbers' sub-lesson")
        await asyncio.sleep(60)

        # After manual navigation, extract images
        print("\n=== Extracting images after manual navigation ===")
        all_images = await edvibe.page.query_selector_all('img[src*="docstorio"], img[src*="LessonExercise"]')
        urls = []
        for img in all_images:
            src = await img.get_attribute('src')
            if src and src not in urls:
                urls.append(src)
                print(f"Found: {src}")

        if urls:
            Path("carousel_images.json").write_text(
                json.dumps({"images": urls}, indent=2),
                encoding='utf-8'
            )
            print(f"\nSaved {len(urls)} images to carousel_images.json")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(extract_carousel())
