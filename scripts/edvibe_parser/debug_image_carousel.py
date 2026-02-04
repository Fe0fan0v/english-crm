#!/usr/bin/env python3
"""Debug script to find image carousel in Vocabulary: numbers lesson"""
import asyncio
from pathlib import Path
from parser import EdvibeParser


async def debug_carousel():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    await edvibe.start(storage_state_path='session.json')

    try:
        # Go to materials
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)

        # Navigate to Beginner folder
        await edvibe.navigate_to_folder('198472')
        await asyncio.sleep(3)

        # Open lesson 4 (1A - A cappuccino please)
        cards = await edvibe.page.query_selector_all('.book-lesson')
        await cards[3].dblclick(force=True)
        await asyncio.sleep(5)

        # Look for sub-lessons or nested content
        print("=== Looking for nested lessons ===")

        # Check if there are sub-sections that can be clicked
        all_sections = await edvibe.page.query_selector_all('.sections-list_item')
        print(f"Found {len(all_sections)} section items")

        for i, section in enumerate(all_sections):
            text = await section.inner_text()
            text_clean = text.replace('\n', ' ')[:60]
            classes = await section.get_attribute('class') or ''
            print(f"  {i}: [{classes[:30]}] {text_clean}")

        # Try to find "Vocabulary: numbers" text
        page_text = await edvibe.page.inner_text('body')
        if 'Vocabulary: numbers' in page_text:
            print("\nFound 'Vocabulary: numbers' on page!")

            # Try to click on it
            vocab_link = await edvibe.page.query_selector('text=Vocabulary: numbers')
            if vocab_link:
                print("Clicking on Vocabulary: numbers...")
                await vocab_link.click()
                await asyncio.sleep(3)

        # Also check for "numbers" section
        numbers_section = await edvibe.page.query_selector('.sections-list_item:has-text("numbers")')
        if numbers_section:
            print("\nFound numbers section!")
            await numbers_section.click()
            await asyncio.sleep(3)

        # Now look for images
        print("\n=== Looking for images on current page ===")
        imgs = await edvibe.page.query_selector_all('img')
        for img in imgs:
            src = await img.get_attribute('src') or ''
            if 'docstorio' in src:
                print(f"  Image: {src}")

        # Save page screenshot
        await edvibe.page.screenshot(path='current_page.png')
        print("\nSaved screenshot to current_page.png")

        # Wait for user to see
        print("\nBrowser will stay open for 30 seconds...")
        await asyncio.sleep(30)

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(debug_carousel())
