#!/usr/bin/env python3
"""
Fix fill_gaps format: convert {gap} markers to {0}, {1}, etc.
and add index field to gaps array.

Run inside Docker: docker compose exec backend python /app/fix_fillgaps_format.py
"""

import asyncio
import json
import re

import asyncpg


DATABASE_URL = "postgresql://postgres:postgres@db:5432/engcrm"


def fix_fillgaps_content(content: dict) -> dict:
    """Convert {gap} markers to indexed format {0}, {1}, etc."""
    text = content.get('text', '')
    gaps = content.get('gaps', [])

    # Check if already in correct format
    if re.search(r'\{\d+\}', text):
        # Already has indexed markers, just ensure gaps have index
        for i, gap in enumerate(gaps):
            if 'index' not in gap:
                gap['index'] = i
        return content

    # Convert {gap} markers to indexed format
    gap_index = 0
    new_text = ''
    i = 0
    while i < len(text):
        if text[i:i+5] == '{gap}':
            new_text += f'{{{gap_index}}}'
            gap_index += 1
            i += 5
        else:
            new_text += text[i]
            i += 1

    # Add index to gaps
    for i, gap in enumerate(gaps):
        gap['index'] = i

    return {
        'text': new_text,
        'gaps': gaps
    }


async def fix_fillgaps_blocks(course_id: int, dry_run: bool = False):
    """Fix all fill_gaps blocks in the course"""

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Get all fill_gaps blocks from the course
        blocks = await conn.fetch("""
            SELECT eb.id, eb.content, eb.title
            FROM exercise_blocks eb
            JOIN interactive_lessons il ON eb.lesson_id = il.id
            JOIN course_sections cs ON il.section_id = cs.id
            WHERE cs.course_id = $1
            AND eb.block_type = 'fill_gaps'
        """, course_id)

        print(f"Found {len(blocks)} fill_gaps blocks in course {course_id}")

        fixed_count = 0
        for block in blocks:
            content = block['content']
            if isinstance(content, str):
                content = json.loads(content)

            text = content.get('text', '')

            # Check if needs fixing
            if '{gap}' not in text:
                # Check if gaps have index
                gaps = content.get('gaps', [])
                if all('index' in g for g in gaps):
                    continue

            # Fix the content
            new_content = fix_fillgaps_content(content)

            print(f"\n  Block {block['id']} ({block['title'][:30] if block['title'] else 'no title'}...):")
            print(f"    Before: {text[:60]}...")
            print(f"    After: {new_content['text'][:60]}...")
            print(f"    Gaps: {len(new_content['gaps'])}")

            if not dry_run:
                await conn.execute("""
                    UPDATE exercise_blocks
                    SET content = $1::jsonb
                    WHERE id = $2
                """, json.dumps(new_content), block['id'])

            fixed_count += 1

        print(f"\n\n{'='*50}")
        print(f"Summary:")
        print(f"  Fixed: {fixed_count} blocks")
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

    await fix_fillgaps_blocks(args.course_id, args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
