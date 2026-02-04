#!/usr/bin/env python3
"""Debug script to analyze radiobutton/test structure in Edvibe"""
import asyncio
from pathlib import Path
from parser import EdvibeParser


async def debug_radiobutton():
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

        # Click on Vocabulary section
        sections = await edvibe.page.query_selector_all('.sections-list_item:not(.medium)')
        await sections[4].click()
        await asyncio.sleep(3)

        print("=== Looking for all choice/select/quiz widgets on page ===\n")

        # Search the entire page for choice-related elements
        page_html = await edvibe.page.content()

        # Save full page HTML for analysis
        Path("full_page.html").write_text(page_html, encoding='utf-8')
        print("Saved full_page.html")

        # Look for specific selectors
        selectors_to_check = [
            'input[type="radio"]',
            'input[type="checkbox"]',
            '.choice',
            '[class*="choice"]',
            '[class*="quiz"]',
            '[class*="select"]',
            '.answer-variant',
            '[class*="answer-variant"]',
            '[class*="option"]',
            '.exercise-test',
            '[class*="multiple"]',
            '.widget',
            '[class*="widget"]'
        ]

        for selector in selectors_to_check:
            try:
                elements = await edvibe.page.query_selector_all(selector)
                if elements:
                    print(f"\n{selector}: {len(elements)} elements")
                    for i, el in enumerate(elements[:3]):
                        tag = await el.evaluate('el => el.tagName')
                        classes = await el.get_attribute('class') or ''
                        text = await el.inner_text()
                        text_preview = text[:50].replace('\n', ' ') if text else 'N/A'
                        print(f"  {i}: <{tag}> class='{classes[:60]}' text='{text_preview}'")
            except Exception as e:
                pass

        # Also check if there's a specific structure for "Listen and write numbers"
        print("\n\n=== Looking for exercise with '1 2 3' pattern ===")

        # Find all text nodes containing "1" "2" "3" pattern
        elements_with_numbers = await edvibe.page.query_selector_all('div, span, p')
        for el in elements_with_numbers:
            text = await el.inner_text()
            if text and text.strip() in ['1', '2', '3', '1\n2\n3', '1 2 3']:
                parent_html = await el.evaluate('el => el.parentElement?.outerHTML?.substring(0, 500)')
                print(f"Found: '{text.strip()}' -> parent: {parent_html}")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(debug_radiobutton())
