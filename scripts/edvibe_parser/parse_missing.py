"""Parse missing lessons 13, 19, 23"""
import asyncio
import re
from datetime import datetime
from pathlib import Path
from parser import EdvibeParser

async def parse_missing_lessons():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    session_path = str(Path(__file__).parent / 'session.json')
    await edvibe.start(storage_state_path=session_path)

    try:
        # Warm up - do initial navigation to materials page
        print("[NAV] Initial navigation to materials page...")
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(5)

        # Parse remaining missing lesson #13 only (19 and 23 done)
        missing_indices = [13]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        for idx in missing_indices:
            print(f"\n{'='*50}")
            print(f"Parsing lesson #{idx}")
            print('='*50)

            # Always navigate to folder fresh
            await edvibe.navigate_to_folder('198472')
            await asyncio.sleep(3)
            cards = await edvibe.page.query_selector_all('.book-lesson')
            print(f"Found {len(cards)} lesson cards")

            if idx > len(cards):
                print(f"[ERROR] Lesson #{idx} not found (only {len(cards)} cards)")
                continue

            card = cards[idx - 1]  # 0-indexed

            # Get title
            text = await card.inner_text()
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            title = lines[0] if lines else f"Lesson {idx}"
            # Remove emojis for printing
            safe_print_title = title.encode('ascii', 'ignore').decode('ascii')
            print(f"Title: {safe_print_title or title[:30]}")

            # Open lesson
            await card.scroll_into_view_if_needed()
            await asyncio.sleep(1)

            try:
                await card.dblclick(force=True)
            except:
                await card.click(force=True)

            await asyncio.sleep(5)

            # Check if opened
            lesson_header = await edvibe.page.query_selector('.lesson-viewer-header, .lesson-layout, .lesson-viewer-main')
            if not lesson_header and "/lesson/" not in edvibe.page.url:
                print(f"[ERROR] Could not open lesson #{idx}")
                continue

            print("[OK] Lesson opened")

            # Parse lesson
            lesson_data = await edvibe.parse_lesson()

            # Convert to JSI format
            jsi_data = edvibe.convert_to_jsi_format(lesson_data)

            # Save
            safe_title = re.sub(r'[^\w\s-]', '', title)
            safe_title = re.sub(r'\s+', '_', safe_title)[:40]
            filename = f"jsi_{idx:02d}_{safe_title}_{timestamp}.json"
            edvibe.save_to_file(jsi_data, filename)

        print("\n[DONE] Finished parsing missing lessons")

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(parse_missing_lessons())
