"""
Парсинг fill_gaps блоков из HTML
Извлечение текста и gaps (правильных ответов)
"""
from bs4 import BeautifulSoup
import re
import html as html_module


def parse_fillgaps_from_html(html_content: str) -> dict:
    """
    Парсит HTML fill_gaps блока и извлекает:
    - Очищенный текст
    - Массив gaps с правильными ответами

    Пример HTML:
    <div>1. I'm not Tom. 2. <span listofintputs="..."><div rightanswers="You aren't">
    <div contenteditable="true"></div></div></div></span> in class 5.</div>

    Результат:
    {
        "text": "1. I'm not Tom. 2. {0} in class 5.",
        "gaps": [
            {"index": 0, "answer": "You aren't", "alternatives": []}
        ]
    }
    """

    # Декодируем HTML entities
    html_content = html_module.unescape(html_content)

    soup = BeautifulSoup(html_content, 'html.parser')

    # Сначала найдём все div с rightanswers (это наши gaps)
    gap_elements = soup.find_all('div', attrs={'rightanswers': True})

    # Удаляем все span с listofintputs (они содержат мусор в атрибуте)
    # Но сначала извлечём из них div с rightanswers и переместим выше
    for span in soup.find_all('span', attrs={'listofintputs': True}):
        # Найдём div с rightanswers внутри
        gap_div = span.find('div', attrs={'rightanswers': True})
        if gap_div:
            # Заменяем span на gap_div
            span.replace_with(gap_div)
        else:
            # Если нет gap_div, просто удаляем span
            span.decompose()

    # Удаляем все data-testid элементы (input wrappers)
    for elem in soup.find_all(attrs={'data-testid': True}):
        elem.decompose()

    # Удаляем popover и indicators (мусор)
    for div in soup.find_all('div', class_=['tir-popover_element', 'indicators_wrapper', 'emoji-animation', 'comment-icon']):
        div.decompose()

    # Теперь снова найдём все элементы с rightanswers
    gap_elements = soup.find_all('div', attrs={'rightanswers': True})

    gaps = []
    gap_index = 0

    # Обрабатываем каждый gap element
    for elem in gap_elements:
        right_answer = elem.get('rightanswers', '').strip()

        if not right_answer:
            continue

        # Заменяем элемент на placeholder {index}
        placeholder = f"{{{gap_index}}}"
        elem.replace_with(placeholder)

        gaps.append({
            "index": gap_index,
            "answer": right_answer,
            "alternatives": []  # Можно добавить альтернативные ответы если нужно
        })

        gap_index += 1

    # Получаем очищенный текст
    text = soup.get_text(separator=' ', strip=True)

    # Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text).strip()

    # Убираем пробелы перед знаками препинания
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)

    return {
        "text": text,
        "gaps": gaps
    }


def test_parser():
    """Тестируем парсер на примере"""

    # Пример HTML из БД
    html = """<div><div><p><span><span>1.&nbsp;<span style="color:#525266"><u><em>I'm not Tom</em></u></span>. I'm Tony.<br>2. </span></span><span><span listofintputs="[You aren't&lt;em class=&quot;hide-id-exercise-item&quot;&gt;##1681229980##&lt;/em&gt;]"><div><div><div rightanswers="You aren't"><div data-testid="exercise-answer-input-wrapper"><div contenteditable="true" disabled="false" data-testid="exercise-answer-input" style="min-width: 70px; min-height: 32px;"></div></div></div></div></div></span></span><span><span> in class 5. You're in class 4.<br>3. </span></span><span><span listofintputs="[You aren't&lt;em...&gt;]"><div><div><div rightanswers="You aren't"><div data-testid="exercise-answer-input-wrapper"><div contenteditable="true"></div></div></div></div></div></span></span><span><span> in room 6. You're in room 7.</span></span></p></div></div>"""

    result = parse_fillgaps_from_html(html)

    print("="*80)
    print("Тест парсера fill_gaps")
    print("="*80)
    print(f"\nText:\n{result['text']}")
    print(f"\nGaps ({len(result['gaps'])}):")
    for gap in result['gaps']:
        print(f"  [{gap['index']}] = '{gap['answer']}'")
    print()


if __name__ == "__main__":
    test_parser()
