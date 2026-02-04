#!/usr/bin/env python3
"""
Convert test blocks with empty options to text blocks.
These are blocks where the parser couldn't extract proper test structure.

Run inside Docker: docker compose exec backend python /app/convert_empty_tests_to_text.py
"""

import asyncio
import json

import asyncpg


DATABASE_URL = "postgresql://postgres:postgres@db:5432/engcrm"


async def convert_empty_tests(course_id: int, dry_run: bool = False):
    """Convert test blocks with empty options to text blocks"""

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Get all test blocks with empty options from the course
        blocks = await conn.fetch("""
            SELECT eb.id, eb.content, eb.title, il.title as lesson_title
            FROM exercise_blocks eb
            JOIN interactive_lessons il ON eb.lesson_id = il.id
            JOIN course_sections cs ON il.section_id = cs.id
            WHERE cs.course_id = $1
            AND eb.block_type = 'test'
        """, course_id)

        print(f"Found {len(blocks)} test blocks in course {course_id}")

        converted_count = 0
        for block in blocks:
            content = block['content']
            if isinstance(content, str):
                content = json.loads(content)

            options = content.get('options', [])
            question = content.get('question', '')

            # Only convert if options is empty and question has content
            if options and len(options) > 0:
                print(f"  Block {block['id']}: has {len(options)} options, skipping")
                continue

            if not question.strip():
                print(f"  Block {block['id']}: empty question, skipping")
                continue

            # Convert to text block
            # Format the question text nicely
            lines = question.strip().split('\n')
            html_lines = [f"<p>{line}</p>" if line.strip() else "<br>" for line in lines]
            html_content = "\n".join(html_lines)

            new_content = {
                "html": f"<div>{html_content}</div>",
                "text": question
            }

            print(f"\n  Block {block['id']} ({block['lesson_title']}):")
            print(f"    Title: {block['title'] or 'N/A'}")
            print(f"    Question preview: {question[:50]}...")
            print(f"    -> Converting to text block")

            if not dry_run:
                await conn.execute("""
                    UPDATE exercise_blocks
                    SET block_type = 'text', content = $1::jsonb
                    WHERE id = $2
                """, json.dumps(new_content), block['id'])

            converted_count += 1

        print(f"\n\n{'='*50}")
        print(f"Summary:")
        print(f"  Converted: {converted_count} blocks (test -> text)")
        if dry_run:
            print("  (DRY RUN - no changes made)")

    finally:
        await conn.close()


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--course-id", "-c", type=int, default=10)
    parser.add_argument("--dry-run", "-n", action="store_true")

    args = parser.parse_args()

    await convert_empty_tests(args.course_id, args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
