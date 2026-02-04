#!/usr/bin/env python3
"""
Extract exercise titles from Edvibe course and save to JSON.
Run locally: python extract_titles.py

Output: titles.json with structure:
{
    "1": {  # lesson number
        "sections": {
            "Listening & speaking": [  # sub-section name
                {"position": 1, "title": "Introduce yourself"},
                {"position": 2, "title": ""},  # no title
                ...
            ]
        }
    }
}
"""

import asyncio
import json
import re
from pathlib import Path
from parser import EdvibeParser


BEGINNER_FOLDER_ID = '198472'


async def extract_titles():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    session_path = 'session.json'
    await edvibe.start(storage_state_path=session_path)

    titles_data = {}

    try:
        # Go to materials page
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)

        # Navigate to Beginner folder
        await edvibe.navigate_to_folder(BEGINNER_FOLDER_ID)
        await asyncio.sleep(3)

        # Get all lessons
        cards = await edvibe.page.query_selector_all('.book-lesson')
        total_lessons = len(cards)
        print(f"Found {total_lessons} lessons")

        for lesson_idx in range(total_lessons):
            # Re-navigate to folder (SPA loses state)
            if lesson_idx > 0:
                await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
                await asyncio.sleep(2)
                await edvibe.navigate_to_folder(BEGINNER_FOLDER_ID)
                await asyncio.sleep(2)

            # Re-get cards
            cards = await edvibe.page.query_selector_all('.book-lesson')
            if lesson_idx >= len(cards):
                print(f"Lesson {lesson_idx + 1}: cards not found, skipping")
                continue

            # Open lesson
            await cards[lesson_idx].dblclick(force=True)
            await asyncio.sleep(4)

            # Get lesson title
            title_el = await edvibe.page.query_selector('.book-header-lesson_title, .lesson-title')
            lesson_title = await title_el.inner_text() if title_el else f"Lesson {lesson_idx + 1}"
            safe_title = lesson_title.encode('ascii', 'ignore').decode('ascii')
            print(f"\n=== Lesson {lesson_idx + 1}: {safe_title} ===")

            lesson_titles = {"sections": {}}

            # Get all sections
            sections = await edvibe.page.query_selector_all('.sections-list_item:not(.medium)')

            for section_idx, section in enumerate(sections):
                section_text = await section.inner_text()
                section_name = section_text.strip().split('\n')[0]

                # Click section
                await section.click()
                await asyncio.sleep(2)

                # Find all exercises
                exercises = await edvibe.page.query_selector_all('.exercise_wrapper')
                section_titles = []

                for ex_idx, ex in enumerate(exercises):
                    # Get title
                    title_el = await ex.query_selector('.exercise-wrapper-title-text')
                    title = ""
                    if title_el:
                        title = (await title_el.inner_text()).strip()

                    section_titles.append({
                        "position": ex_idx + 1,
                        "title": title
                    })

                    if title:
                        safe_t = title.encode('ascii', 'ignore').decode('ascii')
                        print(f"  {section_name} #{ex_idx + 1}: {safe_t[:50]}")

                if section_titles:
                    lesson_titles["sections"][section_name] = section_titles

            if lesson_titles["sections"]:
                titles_data[str(lesson_idx + 1)] = lesson_titles

        # Save to file
        output_path = Path(__file__).parent / 'titles.json'
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(titles_data, f, indent=2, ensure_ascii=False)

        print(f"\n\nSaved titles to: {output_path}")
        print(f"Total lessons with titles: {len(titles_data)}")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(extract_titles())
