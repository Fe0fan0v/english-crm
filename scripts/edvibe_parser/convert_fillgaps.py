#!/usr/bin/env python3
"""
Convert Edvibe fill_gaps HTML format to JSI LMS format.
Run inside Docker: docker compose exec backend python /app/convert_fillgaps.py

Edvibe format:
- HTML with <div rightanswers="pen"> elements containing contenteditable divs
- Text before gap contains first letters in <b> tags

JSI LMS format:
{
    "text": "1. O{gap} your books.\n2. S{gap} I'm late.",
    "gaps": [{"answer": "pen"}, {"answer": "orry"}]
}
"""

import asyncio
import json
import re
from html.parser import HTMLParser

import asyncpg


DATABASE_URL = "postgresql://postgres:postgres@db:5432/engcrm"


class EdvibeFillGapsParser(HTMLParser):
    """Parse Edvibe HTML and extract text with gaps"""

    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.gaps = []
        self.current_text = ""
        self.in_rightanswers = False
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        # Skip contenteditable elements and their children
        if attrs_dict.get('contenteditable') == 'true' or self.skip_depth > 0:
            self.skip_depth += 1
            return

        # Check for rightanswers attribute
        if 'rightanswers' in attrs_dict:
            # Save current text
            if self.current_text:
                self.text_parts.append(self.current_text.rstrip())
                self.current_text = ""

            # Add gap marker with index {0}, {1}, {2}, etc.
            gap_index = len(self.gaps)
            self.text_parts.append(f"{{{gap_index}}}")

            # Parse answer (may have multiple options separated by comma)
            answer = attrs_dict['rightanswers']
            # Handle multiple answers like "at's,at is"
            answers = [a.strip() for a in answer.split(',')]
            self.gaps.append({
                "index": gap_index,
                "answer": answers[0],
                "alternatives": answers[1:] if len(answers) > 1 else []
            })

            self.in_rightanswers = True
            self.skip_depth += 1
            return

        # Handle line breaks
        if tag == 'br':
            self.current_text += "\n"

    def handle_endtag(self, tag):
        if self.skip_depth > 0:
            self.skip_depth -= 1
            if self.skip_depth == 0:
                self.in_rightanswers = False

    def handle_data(self, data):
        if self.skip_depth > 0:
            return

        # Clean up text
        text = data.replace('\xa0', ' ')  # Replace &nbsp;
        self.current_text += text

    def get_result(self):
        # Add remaining text
        if self.current_text:
            self.text_parts.append(self.current_text)

        # Join text parts
        full_text = "".join(self.text_parts)

        # Clean up extra whitespace
        full_text = re.sub(r'\n\s*\n', '\n', full_text)  # Multiple newlines -> single
        full_text = re.sub(r' +', ' ', full_text)  # Multiple spaces -> single
        full_text = full_text.strip()

        return full_text, self.gaps


def convert_edvibe_to_fillgaps(html_content):
    """Convert Edvibe HTML to JSI fill_gaps format"""
    parser = EdvibeFillGapsParser()
    parser.feed(html_content)
    text, gaps = parser.get_result()

    return {
        "text": text,
        "gaps": gaps
    }


def has_edvibe_gaps(content):
    """Check if content has Edvibe gap format"""
    html = content.get('html', '') or content.get('text', '')
    return 'rightanswers=' in html or 'rightanswers=\"' in html


async def convert_fillgaps_blocks(course_id: int, dry_run: bool = False):
    """Find and convert text blocks that are actually fill_gaps"""

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Get all text blocks from the course
        blocks = await conn.fetch("""
            SELECT eb.id, eb.block_type, eb.content, eb.title
            FROM exercise_blocks eb
            JOIN interactive_lessons il ON eb.lesson_id = il.id
            JOIN course_sections cs ON il.section_id = cs.id
            WHERE cs.course_id = $1
            AND eb.block_type = 'text'
        """, course_id)

        print(f"Found {len(blocks)} text blocks in course {course_id}")

        converted_count = 0
        for block in blocks:
            content = block['content']
            if isinstance(content, str):
                content = json.loads(content)

            if not has_edvibe_gaps(content):
                continue

            # This is a fill_gaps block
            html = content.get('html', '') or content.get('text', '')
            new_content = convert_edvibe_to_fillgaps(html)

            if not new_content['gaps']:
                print(f"  Block {block['id']}: no gaps found, skipping")
                continue

            print(f"\n  Block {block['id']} ({block['title'][:30] if block['title'] else 'no title'}...):")
            print(f"    Gaps: {len(new_content['gaps'])}")
            print(f"    First gap answer: {new_content['gaps'][0]['answer']}")
            print(f"    Text preview: {new_content['text'][:100]}...")

            if not dry_run:
                await conn.execute("""
                    UPDATE exercise_blocks
                    SET block_type = 'fill_gaps', content = $1::jsonb
                    WHERE id = $2
                """, json.dumps(new_content), block['id'])

            converted_count += 1

        print(f"\n\n{'='*50}")
        print(f"Summary:")
        print(f"  Converted: {converted_count} blocks")
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

    await convert_fillgaps_blocks(args.course_id, args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
