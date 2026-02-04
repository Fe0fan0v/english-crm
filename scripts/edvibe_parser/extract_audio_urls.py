#!/usr/bin/env python3
"""
Extract audio URLs from Edvibe course and save to JSON for database update.
Run locally (requires browser): python extract_audio_urls.py

Output: audio_urls.json with structure:
{
    "1": {  # section position (lesson number in Edvibe)
        "Listening & speaking": [  # sub-section name
            {"position": 1, "url": "https://...mp3"},
            ...
        ]
    }
}
"""

import asyncio
import json
import re
from pathlib import Path
from parser import EdvibeParser


BEGINNER_FOLDER_ID = '198472'


async def extract_audio_urls():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    session_path = str(Path(__file__).parent / 'session.json')
    await edvibe.start(storage_state_path=session_path)

    audio_data = {}

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

            lesson_audio = {}

            # Get all sections
            sections = await edvibe.page.query_selector_all('.sections-list_item:not(.medium)')

            for section_idx, section in enumerate(sections):
                section_text = await section.inner_text()
                section_name = section_text.strip().split('\n')[0]

                # Click section
                await section.click()
                await asyncio.sleep(2)

                # Find audio elements
                exercises = await edvibe.page.query_selector_all('.exercise_wrapper')
                section_audios = []

                for ex_idx, ex in enumerate(exercises):
                    # Check for audio
                    audio_tag = await ex.query_selector('audio')
                    if audio_tag:
                        src = await audio_tag.get_attribute('src')
                        if not src:
                            source_tag = await audio_tag.query_selector('source')
                            if source_tag:
                                src = await source_tag.get_attribute('src')

                        if src:
                            section_audios.append({
                                "position": ex_idx + 1,
                                "url": src
                            })
                            print(f"  Section '{section_name}' pos {ex_idx + 1}: {src[:60]}...")

                    # Fallback: check for MP3 in HTML
                    if not audio_tag:
                        audio_wrapper = await ex.query_selector('[class*="audio"]')
                        if audio_wrapper:
                            html = await audio_wrapper.inner_html()
                            mp3_match = re.search(r'https?://[^\s"\'<>]+\.mp3', html)
                            if mp3_match:
                                section_audios.append({
                                    "position": ex_idx + 1,
                                    "url": mp3_match.group(0)
                                })
                                print(f"  Section '{section_name}' pos {ex_idx + 1}: {mp3_match.group(0)[:60]}...")

                if section_audios:
                    lesson_audio[section_name] = section_audios

            if lesson_audio:
                audio_data[str(lesson_idx + 1)] = {
                    "title": lesson_title,
                    "sections": lesson_audio
                }

        # Save to file
        output_path = Path(__file__).parent / 'audio_urls.json'
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audio_data, f, indent=2, ensure_ascii=False)

        print(f"\n\nSaved audio URLs to: {output_path}")
        print(f"Total lessons with audio: {len(audio_data)}")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(extract_audio_urls())
