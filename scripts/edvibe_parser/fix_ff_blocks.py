"""
Rebuild Family and Friends merged JSON from raw data with HTML preserved,
then fix all interactive block types.

Run:
    cd scripts/edvibe_parser
    python fix_ff_blocks.py
"""
import json
import re
import html as html_module
from pathlib import Path
from collections import Counter
from bs4 import BeautifulSoup


OUTPUT_DIR = Path(__file__).parent / "output"

RAW_FILES = {
    1: "raw_course_FF_Level_1_20260207_102419.json",
    2: "raw_course_FF_Level_2_20260207_103247.json",
    3: "raw_course_FF_Level_3_20260207_104425.json",
    4: "raw_course_FF_Level_4_20260207_105513.json",
    5: "raw_course_FF_Level_5_20260207_111054.json",
    6: "raw_course_FF_Level_6_20260207_112429.json",
}

# Fixed hierarchy files (with missing lessons added)
HIERARCHY_FILES = {
    1: "jsi_hierarchy_FF_Level_1_20260206_093923.json",
    2: "jsi_hierarchy_FF_Level_2_20260206_094829.json",
    5: "jsi_hierarchy_FF_Level_5_20260206_104943.json",
    6: "jsi_hierarchy_FF_Level_6_20260206_104349.json",
}

LEVEL_NAMES = {
    1: "Level 1", 2: "Level 2", 3: "Level 3",
    4: "Level 4", 5: "Level 5", 6: "Level 6",
}


# ==================== CLEAN HTML ====================

def clean_html(html: str) -> str:
    """Remove Vue.js attributes and Edvibe-specific clutter."""
    if not html:
        return ""
    html = re.sub(r'\s*data-v-[a-z0-9]+(?:-s)?="[^"]*"', '', html)
    html = re.sub(r'\s*data-v-[a-z0-9]+(?:-s)?', '', html)
    html = re.sub(r'<!--.*?-->', '', html)
    html = re.sub(r'\s*class=""', '', html)
    html = re.sub(r'\s*dir="ltr"', '', html)
    html = re.sub(r'<span>\s*<span>([^<]*)</span>\s*</span>', r'<span>\1</span>', html)
    return html.strip()


# ==================== FIX FILL_GAPS ====================

def fix_fill_gaps(content: dict) -> tuple:
    """Parse fill_gaps from HTML or text. Returns (block_type, content)."""
    html = content.get("html", "")
    text = content.get("text", "")

    # If HTML has rightanswers, parse properly
    if html and "rightanswers" in html:
        return "fill_gaps", parse_fillgaps_from_html(html)

    # No HTML with answers - convert to text to at least show content
    if text:
        html_text = text.replace('\n\n', '</p><p>').replace('\n', '<br>')
        return "text", {"html": f"<p>{html_text}</p>", "text": text}

    return "text", {"html": "<p>(Fill in the gaps exercise)</p>", "text": ""}


def parse_fillgaps_from_html(html_content: str) -> dict:
    """Parse HTML fill_gaps and extract text + gaps."""
    html_content = html_module.unescape(html_content)
    soup = BeautifulSoup(html_content, 'html.parser')

    # Move gap divs out of listofintputs spans
    for span in soup.find_all('span', attrs={'listofintputs': True}):
        gap_div = span.find('div', attrs={'rightanswers': True})
        if gap_div:
            span.replace_with(gap_div)
        else:
            span.decompose()

    # Remove UI noise
    for elem in soup.find_all(attrs={'data-testid': True}):
        elem.decompose()
    for div in soup.find_all('div', class_=['tir-popover_element', 'indicators_wrapper',
                                             'emoji-animation', 'comment-icon']):
        div.decompose()

    gap_elements = soup.find_all('div', attrs={'rightanswers': True})
    gaps = []

    for i, elem in enumerate(gap_elements):
        answer = elem.get('rightanswers', '').strip()
        if not answer:
            continue
        elem.replace_with(f"{{{i}}}")
        gaps.append({"index": i, "answer": answer, "alternatives": []})

    text = soup.get_text(separator=' ', strip=True)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)

    return {"text": text, "gaps": gaps}


# ==================== FIX MATCHING ====================

def classify_matching_html(html: str) -> str:
    if 'exercise_wrapper_images' in html:
        return 'matching_images'
    if 'exercise_sentences_in_correct_order' in html:
        return 'word_order'
    if 'draggable_container_wrapper' in html:
        return 'fill_gaps_draggable'
    return 'unknown'


def parse_matching_pairs(html: str) -> list:
    words_section = html.split('image_block_wrappper')[0] if 'image_block_wrappper' in html else html
    # Flexible regex to handle data-v-xxx attributes
    left_texts = re.findall(r'<span[^>]*class="word-block_value"[^>]*>([^<]+)</span>', words_section)
    left_texts = [t.strip() for t in left_texts if t.strip()]

    # Extract image blocks with index - flexible for Vue.js attributes
    image_blocks = re.findall(
        r'image_block_wrappper[^"]*"\s+index="(\d+)".*?<img[^>]*class="question_image"[^>]*src="([^"]+)"',
        html, re.DOTALL
    )
    if image_blocks:
        image_blocks.sort(key=lambda x: int(x[0]))
        right_urls = [url for _, url in image_blocks]
    else:
        right_urls = re.findall(r'<img[^>]*class="question_image"[^>]*src="([^"]+)"', html)

    pairs = []
    for i in range(min(len(left_texts), len(right_urls))):
        pairs.append({"left": left_texts[i], "right": right_urls[i]})
    return pairs


def extract_readable_text(html: str) -> str:
    words = re.findall(r'<span[^>]*class="word-block_value"[^>]*>([^<]+)</span>', html)
    words = [w.strip() for w in words if w.strip()]
    text = re.sub(r'<[^>]+>', ' ', html).replace('&nbsp;', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    if words:
        word_bank = ', '.join(dict.fromkeys(words))
        return f"<p><strong>Word bank:</strong> {word_bank}</p><p>{text}</p>"
    return f"<p>{text}</p>"


def extract_word_order_text(html: str) -> str:
    sentences = re.findall(r'class="sentence"[^>]*>([^<]+)', html)
    if sentences:
        items = [s.strip() for s in sentences if s.strip()]
        return '<ol>' + ''.join(f'<li>{s}</li>' for s in items) + '</ol>'
    text = re.sub(r'<[^>]+>', ' ', html).replace('&nbsp;', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    return f"<p>{text}</p>"


def fix_matching(content: dict) -> tuple:
    """Fix matching block. Returns (block_type, content)."""
    html = content.get("html", "") or content.get("text", "")

    if not html:
        # No HTML - convert to text with whatever we have
        return "text", {"html": "<p>(Matching exercise)</p>", "text": "(Matching exercise)"}

    block_subtype = classify_matching_html(html)

    if block_subtype == 'matching_images':
        pairs = parse_matching_pairs(html)
        if pairs:
            return "matching", {"pairs": pairs, "shuffle_right": True}
        # Can't extract pairs - convert to text
        cleaned = clean_html(html)
        return "text", {"html": cleaned, "text": cleaned}

    elif block_subtype == 'fill_gaps_draggable':
        readable = extract_readable_text(html)
        return "text", {"html": readable, "text": readable}

    elif block_subtype == 'word_order':
        readable = extract_word_order_text(html)
        return "text", {"html": readable, "text": readable}

    else:
        cleaned = clean_html(html)
        return "text", {"html": cleaned, "text": cleaned}


# ==================== FIX WORD ORDER ====================

def fix_word_order(content: dict) -> tuple:
    """Fix word_order block. Returns (block_type, content)."""
    html = content.get("html", "") or content.get("text", "")

    if not html:
        return "text", {"html": "<p>(Word order exercise)</p>", "text": "(Word order exercise)"}

    if 'exercise_sentences_in_correct_order' in html:
        # Real sentence order
        items = re.findall(
            r'<div class="number">(\d+)</div>.*?<div class="sentence_text">([^<]+)',
            html, re.DOTALL
        )
        if items:
            sorted_items = sorted(items, key=lambda x: int(x[0]))
            result_html = '\n'.join(f'<p><strong>{num}.</strong> {text.strip()}</p>' for num, text in sorted_items)
            return "text", {"html": result_html, "text": result_html}

    if 'draggable_container_wrapper' in html:
        readable = extract_readable_text(html)
        return "text", {"html": readable, "text": readable}

    cleaned = clean_html(html)
    return "text", {"html": cleaned, "text": cleaned}


# ==================== FIX TEST ====================

def parse_test_options_from_html(html: str) -> list:
    """Extract test options from HTML with tir-radio elements."""
    if not html:
        return []

    soup = BeautifulSoup(html, 'html.parser')
    options = []

    # Try multiple selectors
    selectors = [
        {'class_': re.compile(r'tir-radio(?!-group)')},
        {'class_': 'radio-option'},
        {'class_': 'answer-option'},
        {'class_': 'exercise-select-item'},
        {'class_': 'option-item'},
    ]

    option_elements = []
    for sel in selectors:
        option_elements = soup.find_all(['div', 'label', 'span'], **sel)
        if len(option_elements) >= 2:
            break

    for elem in option_elements:
        text = elem.get_text(strip=True)
        if not text:
            continue

        is_correct = False
        class_str = ' '.join(elem.get('class', []))
        if 'correct' in class_str.lower() or 'right' in class_str.lower():
            is_correct = True
        if elem.get('data-correct') == 'true':
            is_correct = True

        options.append({"text": text, "is_correct": is_correct})

    return options


def fix_test(content: dict) -> tuple:
    """Fix test block. Returns (block_type, content)."""
    question = content.get("question", "")
    options = content.get("options", [])
    html = content.get("html", "")

    if options and len(options) > 0:
        # Already has options - clean up html field
        return "test", {"question": question, "options": options}

    # Try to parse options from HTML
    if html:
        parsed_options = parse_test_options_from_html(html)
        if parsed_options:
            return "test", {"question": question, "options": parsed_options}

    # No data - convert to text
    text = question or "(Test exercise)"
    return "text", {"html": f"<p>{text}</p>", "text": text}


# ==================== FIX TRUE/FALSE ====================

def parse_true_false_from_text(text: str) -> list:
    """Try to extract true/false statements from text."""
    statements = []
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    for line in lines:
        # Skip numbering prefixes
        clean_line = re.sub(r'^\d+[\.\)]\s*', '', line).strip()
        if not clean_line or len(clean_line) < 5:
            continue
        # Skip pagination markers like "1 / 4", "2/5" etc
        if re.match(r'^\d+\s*/\s*\d+$', clean_line):
            continue

        # Check for True/False markers
        is_true = None
        # English markers
        if re.search(r'\b(True|T)\s*$', clean_line, re.IGNORECASE):
            is_true = True
            clean_line = re.sub(r'\s*\b(True|T)\s*$', '', clean_line, flags=re.IGNORECASE).strip()
        elif re.search(r'\b(False|F)\s*$', clean_line, re.IGNORECASE):
            is_true = False
            clean_line = re.sub(r'\s*\b(False|F)\s*$', '', clean_line, flags=re.IGNORECASE).strip()
        # Russian markers
        elif re.search(r'\b(Верно|Правда)\s*$', clean_line, re.IGNORECASE):
            is_true = True
            clean_line = re.sub(r'\s*\b(Верно|Правда)\s*$', '', clean_line, flags=re.IGNORECASE).strip()
        elif re.search(r'\b(Неверно|Ложь)\s*$', clean_line, re.IGNORECASE):
            is_true = False
            clean_line = re.sub(r'\s*\b(Неверно|Ложь)\s*$', '', clean_line, flags=re.IGNORECASE).strip()

        if clean_line and len(clean_line) >= 5:
            statements.append({
                "statement": clean_line,
                "is_true": is_true if is_true is not None else True,
            })

    return statements


def fix_true_false(content: dict) -> tuple:
    """Fix true_false block. Returns (block_type, content)."""
    text = content.get("text", "")
    statements = content.get("statements", [])

    if statements and len(statements) > 0:
        return "true_false", content

    # Try to parse statements from text
    if text:
        parsed = parse_true_false_from_text(text)
        if parsed:
            return "true_false", {"statements": parsed}

        # Has text content but can't parse - display as text block
        html_text = text.replace('\n', '<br>')
        return "text", {"html": f"<p>{html_text}</p>", "text": text}

    return "text", {"html": "<p>(True/False exercise)</p>", "text": "(True/False exercise)"}


# ==================== FIX ESSAY ====================

def fix_essay(content: dict) -> tuple:
    """Fix essay block. Returns (block_type, content)."""
    html = content.get("html", "")
    text = content.get("text", "")
    prompt = content.get("prompt", "")

    if prompt:
        return "essay", content

    if html and 'exercise-essay' in html:
        # Extract prompt from HTML
        prompt_match = re.search(r'exercise-essay-text[^>]*>([^<]+)', html)
        if prompt_match:
            return "essay", {"prompt": prompt_match.group(1).strip()}

    if text:
        return "essay", {"prompt": text}

    return "essay", {"prompt": "Write your answer"}


# ==================== FIX IMAGE CHOICE ====================

def fix_image_choice(content: dict) -> tuple:
    """Fix image_choice block. Returns (block_type, content)."""
    html = content.get("html", "")
    question = content.get("question", "")

    if content.get("options") and len(content["options"]) > 0:
        return "image_choice", content

    if html and 'question_image' in html:
        # Try to extract images
        images = re.findall(r'<img[^>]+class="question_image"[^>]+src="([^"]+)"', html)
        if not images:
            images = re.findall(r'src="([^"]+)"', html)

        if images:
            options = [{"image_url": url, "is_correct": i == 0} for i, url in enumerate(images)]
            return "image_choice", {"question": question or "", "options": options}

    # Fallback to text
    if html:
        cleaned = clean_html(html)
        return "text", {"html": cleaned, "text": cleaned}

    return "text", {"html": f"<p>{question or '(Image choice exercise)'}</p>",
                     "text": question or "(Image choice exercise)"}


# ==================== MAIN REBUILD ====================

def convert_exercise_to_block_with_html(exercise: dict) -> dict:
    """Convert raw exercise to JSI block, preserving HTML for interactive types."""
    block_type = exercise.get("block_type", "text")
    content = exercise.get("content", {})

    block = {
        "block_type": block_type,
        "position": exercise.get("position", 0),
        "content": {},
    }

    if block_type in ("image", "video", "audio"):
        block["content"] = {"url": content.get("url", "")}
        if content.get("caption"):
            block["content"]["caption"] = content["caption"]

    elif block_type in ("text", "teaching_guide", "remember"):
        raw_html = content.get("html", content.get("text", ""))
        cleaned = clean_html(raw_html)
        block["content"] = {"html": cleaned, "text": cleaned}

    elif block_type == "fill_gaps":
        # Preserve HTML for later fixing
        block["content"] = {
            "text": content.get("text", ""),
            "gaps": content.get("gaps", []),
            "html": content.get("html", ""),
        }

    elif block_type == "matching":
        # Preserve HTML for later fixing
        block["content"] = {
            "pairs": content.get("pairs", []),
            "html": content.get("html", ""),
            "text": content.get("text", ""),
        }

    elif block_type == "test":
        block["content"] = {
            "question": content.get("question", ""),
            "options": content.get("options", []),
            "html": content.get("html", ""),
        }

    elif block_type == "true_false":
        block["content"] = {
            "text": content.get("text", ""),
            "statements": content.get("statements", []),
            "html": content.get("html", ""),
        }

    elif block_type == "word_order":
        block["content"] = {
            "sentences": content.get("sentences", []),
            "html": content.get("html", ""),
            "text": content.get("text", ""),
        }

    elif block_type == "essay":
        block["content"] = {
            "html": content.get("html", ""),
            "text": content.get("text", ""),
        }

    elif block_type == "image_choice":
        block["content"] = {
            "html": content.get("html", ""),
            "question": content.get("question", ""),
            "options": content.get("options", []),
        }

    else:
        block["content"] = content

    if exercise.get("title"):
        block["title"] = exercise["title"]

    return block


def apply_fixes(block: dict) -> dict:
    """Apply type-specific fixes to a block."""
    bt = block["block_type"]
    c = block["content"]

    if bt == "fill_gaps":
        if not c.get("gaps"):
            new_type, new_content = fix_fill_gaps(c)
            block["block_type"] = new_type
            block["content"] = new_content
        else:
            # Already has gaps - just clean up
            block["content"].pop("html", None)

    elif bt == "matching":
        if not c.get("pairs"):
            new_type, new_content = fix_matching(c)
            block["block_type"] = new_type
            block["content"] = new_content
        else:
            block["content"] = {"pairs": c["pairs"]}
            if c.get("shuffle_right"):
                block["content"]["shuffle_right"] = True

    elif bt == "word_order":
        sentences = c.get("sentences", [])
        has_data = sentences and any(s.get("words") for s in sentences)
        if not has_data:
            new_type, new_content = fix_word_order(c)
            block["block_type"] = new_type
            block["content"] = new_content

    elif bt == "test":
        if not c.get("options"):
            new_type, new_content = fix_test(c)
            block["block_type"] = new_type
            block["content"] = new_content
        else:
            # Already has options - clean up
            block["content"] = {"question": c.get("question", ""), "options": c["options"]}

    elif bt == "true_false":
        if not c.get("statements") and not c.get("options"):
            new_type, new_content = fix_true_false(c)
            block["block_type"] = new_type
            block["content"] = new_content
        else:
            # Already has statements - clean up
            block["content"].pop("html", None)

    elif bt == "essay":
        if not c.get("prompt") and not c.get("question"):
            new_type, new_content = fix_essay(c)
            block["block_type"] = new_type
            block["content"] = new_content

    elif bt == "image_choice":
        if not c.get("options"):
            new_type, new_content = fix_image_choice(c)
            block["block_type"] = new_type
            block["content"] = new_content

    # Clean up leftover html/text fields for non-text blocks
    if block["block_type"] not in ("text", "teaching_guide", "remember"):
        block["content"].pop("html", None)
        if block["block_type"] != "fill_gaps":
            block["content"].pop("text", None)

    return block


def rebuild_from_raw(level: int) -> list:
    """Rebuild lessons from raw data with HTML preserved.
    Adds section title headers (h2) before each section's exercises,
    matching the behavior of EdvibeParser.convert_lesson_to_jsi_flat().
    """
    raw_file = OUTPUT_DIR / RAW_FILES[level]
    raw_data = json.load(open(raw_file, 'r', encoding='utf-8'))
    lessons_full = raw_data.get("lessons_full", [])

    rebuilt_lessons = []
    for lesson_data in lessons_full:
        title = lesson_data.get("lesson_title", lesson_data.get("title", ""))
        blocks = []
        position = 1

        for section in lesson_data.get("sections", []):
            section_title = section.get("title", "")

            # Add section header as text block (same as convert_lesson_to_jsi_flat)
            if section_title:
                blocks.append({
                    "block_type": "text",
                    "position": position,
                    "content": {
                        "html": f"<h2><strong>{section_title}</strong></h2>",
                        "text": section_title
                    },
                    "title": ""
                })
                position += 1

            for ex in section.get("exercises", []):
                block = convert_exercise_to_block_with_html(ex)
                block["position"] = position
                blocks.append(block)
                position += 1

        rebuilt_lessons.append({"title": title, "blocks": blocks})

    return rebuilt_lessons


def main():
    print("=" * 70)
    print("  REBUILDING Family and Friends with fixes")
    print("=" * 70)

    merged = {
        "title": "Family and Friends",
        "description": "Family and Friends for Kids (1-6)",
        "sections": []
    }

    stats = Counter()
    fix_stats = Counter()

    for level in range(1, 7):
        print(f"\n--- {LEVEL_NAMES[level]} ---")

        # Rebuild from raw
        raw_lessons = rebuild_from_raw(level)
        print(f"  Raw lessons: {len(raw_lessons)}")

        # For levels with missing lessons, get them from hierarchy
        hierarchy_file = HIERARCHY_FILES.get(level)
        if hierarchy_file:
            hier = json.load(open(OUTPUT_DIR / hierarchy_file, 'r', encoding='utf-8'))
            hier_lessons = hier["sections"][0]["lessons"]
            hier_titles = {l["title"] for l in hier_lessons}
            raw_titles = {l["title"] for l in raw_lessons}
            missing_titles = hier_titles - raw_titles

            if missing_titles:
                print(f"  Adding {len(missing_titles)} missing lessons from hierarchy")
                # Get missing lessons from hierarchy (already in JSI format, no HTML)
                missing_from_hier = [l for l in hier_lessons if l["title"] in missing_titles]
                raw_lessons.extend(missing_from_hier)

            # For Level 5, also handle duplicates/ordering from fixed hierarchy
            if level == 5:
                # Use hierarchy ordering (already fixed)
                hier_order = [l["title"] for l in hier_lessons]
                # Create title->lesson map (prefer raw data since it has HTML)
                lesson_map = {}
                for l in raw_lessons:
                    if l["title"] not in lesson_map:
                        lesson_map[l["title"]] = l

                ordered_lessons = []
                for title in hier_order:
                    if title in lesson_map:
                        ordered_lessons.append(lesson_map[title])
                raw_lessons = ordered_lessons

        print(f"  Total lessons: {len(raw_lessons)}")

        # Apply fixes to all blocks
        for lesson in raw_lessons:
            for i, block in enumerate(lesson["blocks"]):
                old_type = block["block_type"]
                block = apply_fixes(block)
                lesson["blocks"][i] = block
                new_type = block["block_type"]

                stats[new_type] += 1
                if old_type != new_type:
                    fix_stats[f"{old_type} -> {new_type}"] += 1

        total_blocks = sum(len(l["blocks"]) for l in raw_lessons)
        print(f"  Total blocks: {total_blocks}")

        merged["sections"].append({
            "title": LEVEL_NAMES[level],
            "lessons": raw_lessons
        })

    # Save
    out_file = OUTPUT_DIR / "jsi_merged_FF_all_levels_fixed.json"
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    # Stats
    total_lessons = sum(len(s["lessons"]) for s in merged["sections"])
    total_blocks = sum(stats.values())

    print(f"\n{'=' * 70}")
    print(f"  RESULT")
    print(f"{'=' * 70}")
    print(f"  Sections: {len(merged['sections'])}")
    print(f"  Lessons:  {total_lessons}")
    print(f"  Blocks:   {total_blocks}")
    print(f"\n  Block types:")
    for bt, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"    {bt:20s}: {count}")
    if fix_stats:
        print(f"\n  Conversions:")
        for conv, count in sorted(fix_stats.items(), key=lambda x: -x[1]):
            print(f"    {conv:30s}: {count}")
    print(f"\n  Saved: {out_file}")


if __name__ == "__main__":
    main()
