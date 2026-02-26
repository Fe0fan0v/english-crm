"""Parse missing FF Level 6 lessons: 17, 24, 25, 26, 28."""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from parser import EdvibeParser


BOOK_ID = "198495"  # Family and Friends 6
BOOK_URL = f"https://edvibe.com/cabinet/school/materials/book/{BOOK_ID}/content"
EXISTING_FILE = "jsi_hierarchy_FF_Level_6_20260206_103956.json"

# Missing lesson indices (1-based) and their expected titles
MISSING = [17, 24, 25, 26, 28]


async def main():
    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    session_path = str(Path(__file__).parent / 'session.json')
    await edvibe.start(storage_state_path=session_path)

    try:
        # Check session
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)
        if "login" in edvibe.page.url.lower():
            await edvibe.login()
            await edvibe.save_session()

        lessons_data = []

        for idx in MISSING:
            print(f"\n{'='*50}")
            print(f"Parsing lesson #{idx}")
            print('='*50)

            await edvibe.page.goto(BOOK_URL, wait_until="load")
            await asyncio.sleep(5)

            cards = await edvibe.page.query_selector_all('.book-lesson')
            print(f"Found {len(cards)} lesson cards")

            if idx > len(cards):
                print(f"[ERROR] Lesson #{idx} not found (only {len(cards)} cards)")
                continue

            card = cards[idx - 1]
            text = await card.inner_text()
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            title = lines[0] if lines else f"Lesson {idx}"
            print(f"Title: {title}")

            # Open lesson
            await card.scroll_into_view_if_needed()
            await asyncio.sleep(1)
            try:
                await card.dblclick(force=True)
            except Exception:
                await card.click(force=True)
            await asyncio.sleep(5)

            lesson_data = await edvibe.parse_lesson()
            lesson_data["lesson_title"] = title
            lesson_data["original_index"] = idx
            lessons_data.append(lesson_data)

            total_blocks = sum(len(s.get('exercises', [])) for s in lesson_data.get('sections', []))
            print(f"[OK] {total_blocks} blocks")

        # Load existing hierarchy
        existing_file = Path(__file__).parent / "output" / EXISTING_FILE
        with open(existing_file, 'r', encoding='utf-8') as f:
            hierarchy = json.load(f)

        existing_titles = [l["title"] for l in hierarchy["sections"][0]["lessons"]]
        print(f"\nExisting lessons: {len(existing_titles)}")

        # Convert and insert missing lessons at correct positions
        new_lessons = []
        for lesson_data in lessons_data:
            flat = edvibe.convert_lesson_to_jsi_flat(
                lesson_data,
                lesson_data.get("lesson_title", "")
            )
            flat["_orig_idx"] = lesson_data["original_index"]
            new_lessons.append(flat)
            print(f"Parsed: {flat['title']} ({len(flat['blocks'])} blocks) [idx={flat['_orig_idx']}]")

        # Merge: add existing lessons with their index, add new, sort by index
        all_lessons = []
        # Existing lessons already have titles with numbers like "17. ..."
        for lesson in hierarchy["sections"][0]["lessons"]:
            # Extract number from title like "17. Explorers for a day 1.2"
            title = lesson["title"]
            try:
                num = int(title.split('.')[0].strip())
            except (ValueError, IndexError):
                num = 999
            lesson["_orig_idx"] = num
            all_lessons.append(lesson)

        for lesson in new_lessons:
            all_lessons.append(lesson)

        # Sort by original index
        all_lessons.sort(key=lambda x: x.get("_orig_idx", 999))

        # Remove temp field
        for lesson in all_lessons:
            lesson.pop("_orig_idx", None)

        hierarchy["sections"][0]["lessons"] = all_lessons

        # Save updated hierarchy
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = Path(__file__).parent / "output" / f"jsi_hierarchy_FF_Level_6_{timestamp}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(hierarchy, f, ensure_ascii=False, indent=2)

        total = sum(len(l["blocks"]) for l in hierarchy["sections"][0]["lessons"])
        print(f"\n[OK] Level 6 complete: {len(hierarchy['sections'][0]['lessons'])} lessons, {total} blocks")
        print(f"Saved: {output_file}")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(main())
