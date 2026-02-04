#!/usr/bin/env python3
"""
Extract test/radiobutton answers from Edvibe.
Parses lesson exercises and extracts correct answers for test blocks.

Run locally with Playwright:
    python extract_test_answers.py --lesson-id 198472
"""
import asyncio
import json
import re
import argparse
from pathlib import Path
from parser import EdvibeParser


async def extract_test_answers(folder_id: str, lesson_indices: list[int] = None):
    """Extract test answers from Edvibe lessons"""

    edvibe = EdvibeParser(
        email='jsi.online.2020@gmail.com',
        password='Vg9$kR7p!sQ2#Lm8',
        headless=False
    )

    await edvibe.start(storage_state_path='session.json')

    results = []

    try:
        # Go to materials
        await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
        await asyncio.sleep(3)

        # Navigate to folder
        await edvibe.navigate_to_folder(folder_id)
        await asyncio.sleep(3)

        # Get all lesson cards
        cards = await edvibe.page.query_selector_all('.book-lesson')
        print(f"Found {len(cards)} lessons")

        # Process specified lessons or all
        indices = lesson_indices if lesson_indices else range(len(cards))

        for idx in indices:
            if idx >= len(cards):
                print(f"Lesson index {idx} out of range")
                continue

            # Reload cards in case DOM changed
            cards = await edvibe.page.query_selector_all('.book-lesson')
            card = cards[idx]

            # Get lesson title
            title_el = await card.query_selector('.book-lesson_title')
            lesson_title = await title_el.inner_text() if title_el else f"Lesson {idx}"
            print(f"\n=== Processing: {lesson_title} ===")

            # Open lesson
            await card.dblclick(force=True)
            await asyncio.sleep(5)

            lesson_data = {
                "lesson_title": lesson_title,
                "lesson_index": idx,
                "tests": []
            }

            # Find all exercises
            exercises = await edvibe.page.query_selector_all('.exercise_wrapper')
            print(f"Found {len(exercises)} exercises")

            for ex_idx, ex in enumerate(exercises):
                outer_html = await ex.evaluate('el => el.outerHTML')

                # Look for radio buttons or test questions
                radio_inputs = await ex.query_selector_all('input[type="radio"]')

                if len(radio_inputs) > 0:
                    print(f"  Exercise {ex_idx + 1}: Found {len(radio_inputs)} radio inputs")

                    test_data = {
                        "exercise_index": ex_idx,
                        "questions": []
                    }

                    # Try to find question groups
                    # Look for question wrappers
                    question_wrappers = await ex.query_selector_all('.question-wrapper, .question-group, [class*="question"]')

                    if not question_wrappers:
                        # Try to extract from HTML structure
                        # Look for selected/correct answers
                        for radio in radio_inputs:
                            is_checked = await radio.get_attribute('checked')
                            is_correct = await radio.evaluate('el => el.closest("label")?.classList.contains("correct") || el.closest(".answer")?.classList.contains("correct")')
                            value = await radio.get_attribute('value')
                            name = await radio.get_attribute('name')

                            label = await radio.evaluate('el => el.closest("label")?.innerText || el.nextSibling?.textContent || ""')

                            print(f"    Radio: name={name}, value={value}, checked={is_checked}, correct={is_correct}, label={label[:30] if label else 'N/A'}")

                    # Alternative: look for answer options with correct markers
                    answer_options = await ex.query_selector_all('[class*="answer"], [class*="option"]')
                    for opt in answer_options:
                        opt_class = await opt.get_attribute('class') or ''
                        opt_text = await opt.inner_text()
                        is_correct = 'correct' in opt_class.lower() or 'right' in opt_class.lower()

                        if opt_text.strip():
                            test_data["questions"].append({
                                "text": opt_text.strip()[:50],
                                "is_correct": is_correct,
                                "class": opt_class
                            })

                    if test_data["questions"]:
                        lesson_data["tests"].append(test_data)

                    # Also save raw HTML for analysis
                    html_file = Path(f"test_html_{idx}_{ex_idx}.html")
                    html_file.write_text(outer_html, encoding='utf-8')
                    print(f"    Saved HTML to {html_file}")

            results.append(lesson_data)

            # Go back to folder
            await edvibe.page.goto("https://edvibe.com/cabinet/school/materials/personal", wait_until="load")
            await asyncio.sleep(2)
            await edvibe.navigate_to_folder(folder_id)
            await asyncio.sleep(2)

        # Save results
        output_file = Path("test_answers.json")
        output_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"\n\nSaved results to {output_file}")

    finally:
        await edvibe.close()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder-id", "-f", default="198472", help="Edvibe folder ID")
    parser.add_argument("--lessons", "-l", type=str, help="Comma-separated lesson indices (0-based)")

    args = parser.parse_args()

    lesson_indices = None
    if args.lessons:
        lesson_indices = [int(x.strip()) for x in args.lessons.split(',')]

    await extract_test_answers(args.folder_id, lesson_indices)


if __name__ == "__main__":
    asyncio.run(main())
