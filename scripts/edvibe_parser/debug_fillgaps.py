#!/usr/bin/env python3
"""Debug script to analyze fill_gaps structure in Edvibe"""
import asyncio
import re
from parser import EdvibeParser

async def debug_fillgaps():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    await edvibe.start(storage_state_path='session.json')

    try:
        # Go to the specific lesson with fill_gaps
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)

        # Navigate to Beginner folder
        await edvibe.navigate_to_folder('198472')
        await asyncio.sleep(3)

        # Open lesson 4 (2B-That's my bus)
        cards = await edvibe.page.query_selector_all('.book-lesson')
        if len(cards) >= 4:
            await cards[3].dblclick(force=True)
            await asyncio.sleep(5)

            # Click on "Vocabulary" section
            sections = await edvibe.page.query_selector_all('.sections-list_item:not(.medium)')
            for section in sections:
                text = await section.inner_text()
                if 'Vocab' in text:
                    print(f"Clicking section: {text}")
                    await section.click()
                    await asyncio.sleep(3)
                    break

            # Find all exercises
            exercises = await edvibe.page.query_selector_all('.exercise_wrapper')
            print(f"\nFound {len(exercises)} exercises\n")

            for i, ex in enumerate(exercises[:5]):
                print(f"=== Exercise {i+1} ===")

                # Get full outer HTML
                outer_html = await ex.evaluate('el => el.outerHTML')

                # Check for fill-gaps indicators
                has_gap = 'gap' in outer_html.lower()
                has_input = '<input' in outer_html.lower()
                has_blank = '___' in outer_html or '...' in outer_html
                has_contenteditable = 'contenteditable' in outer_html.lower()

                print(f"  Has 'gap': {has_gap}")
                print(f"  Has '<input': {has_input}")
                print(f"  Has blanks (___): {has_blank}")
                print(f"  Has contenteditable: {has_contenteditable}")

                # Show HTML snippet if it looks like fill_gaps
                if has_gap or has_input or has_blank or has_contenteditable:
                    print(f"\n  HTML snippet (first 1000 chars):")
                    # Clean up for readability
                    clean = re.sub(r'\s+', ' ', outer_html[:1500])
                    print(f"  {clean[:1000]}")

                # Try to find text with gaps
                inner_text = await ex.inner_text()
                if '___' in inner_text or any(c.isupper() and len(c) == 1 for word in inner_text.split() for c in word):
                    print(f"\n  Inner text:")
                    print(f"  {inner_text[:300]}")

                print()

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(debug_fillgaps())
