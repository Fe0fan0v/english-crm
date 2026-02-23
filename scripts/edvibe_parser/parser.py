"""
Edvibe Course Parser

Скрипт для парсинга курсов с платформы Edvibe и конвертации в формат JSI LMS.

Поддерживает три уровня:
1. Все курсы (--all-courses) - парсит все курсы из личного кабинета
2. Один курс (--course-url) - парсит все уроки одного курса
3. Один урок (--lesson-url) - парсит один конкретный урок

Использование:
    # Все курсы
    python parser.py -e email -p pass --all-courses

    # Один курс
    python parser.py -e email -p pass --course-url "https://edvibe.com/cabinet/school/materials/personal/folder/198472"

    # Один урок
    python parser.py -e email -p pass --lesson-url "https://edvibe.com/cabinet/school/materials/personal/lesson/123456"

Требования:
    pip install playwright
    playwright install chromium
"""

import argparse
import asyncio
import json
import re
import html as html_module
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

try:
    from playwright.async_api import async_playwright, Page, Browser, ElementHandle
except ImportError:
    print("Playwright не установлен. Установите:")
    print("  pip install playwright")
    print("  playwright install chromium")
    exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


class EdvibeParser:
    """Парсер курсов Edvibe"""

    def __init__(self, email: str, password: str, headless: bool = False, slow_mo: int = 0):
        self.email = email
        self.password = password
        self.headless = headless
        self.slow_mo = slow_mo
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.base_url = "https://edvibe.com"
        self._playwright = None

    async def start(self, storage_state_path: str = None):
        """Запуск браузера"""
        self._playwright = await async_playwright().start()

        self.browser = await self._playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo
        )

        # Создаём контекст с сохранённой сессией если есть
        if storage_state_path and Path(storage_state_path).exists():
            print(f"[BROWSER] Loading session from: {storage_state_path}")
            self.context = await self.browser.new_context(storage_state=storage_state_path)
        else:
            self.context = await self.browser.new_context()

        self.page = await self.context.new_page()
        await self.page.set_viewport_size({"width": 1920, "height": 1080})

        # Устанавливаем таймаут по умолчанию (60 секунд)
        self.page.set_default_timeout(60000)
        self.page.set_default_navigation_timeout(60000)

        self.storage_state_path = storage_state_path

    async def close(self):
        """Закрытие браузера"""
        if hasattr(self, 'context') and self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def save_session(self, path: str = None):
        """Сохранение сессии (cookies) в файл"""
        save_path = path or (Path(__file__).parent / "session.json")
        await self.context.storage_state(path=str(save_path))
        print(f"[SESSION] Saved to: {save_path}")

    async def login(self, manual: bool = False) -> bool:
        """Авторизация на Edvibe"""
        print(f"[LOGIN] Авторизация под {self.email}...")

        try:
            await self.page.goto(f"{self.base_url}/login", wait_until="load")
            await asyncio.sleep(3)

            if manual:
                # Ручной режим - ждём пока пользователь залогинится
                print("\n" + "="*50)
                print("RUCHNOY REZHIM VHODA")
                print("Voydite v sistemu v otkryvshemsya brauzere.")
                print("Ozhidayu vhoda (maksimum 120 sekund)...")
                print("="*50)

                # Ждём пока URL изменится (пользователь залогинится)
                for i in range(120):
                    await asyncio.sleep(1)
                    if "login" not in self.page.url.lower():
                        print(f"[OK] Avtorizaciya uspeshna! ({i+1} sek)")
                        await asyncio.sleep(2)  # Даём странице загрузиться
                        # Сохраняем сессию
                        await self.save_session()
                        return True
                    if i % 10 == 0 and i > 0:
                        print(f"   ...ozhidayu ({i} sek)")

                print("[ERROR] Timeout - vy ne voshli za 120 sekund.")
                return False

            # Автоматический режим
            # Ввод email
            email_input = await self.page.query_selector('input[type="email"], input[name="email"]')
            if email_input:
                await email_input.fill(self.email)
            else:
                await self.page.fill('input[placeholder*="mail" i]', self.email)

            # Ввод пароля
            password_input = await self.page.query_selector('input[type="password"]')
            if password_input:
                await password_input.fill(self.password)

            # Клик на кнопку входа
            await self.page.click('button[type="submit"], button:has-text("Войти"), button:has-text("Login")')

            # Ждем редиректа
            await asyncio.sleep(3)
            await self.page.wait_for_load_state("load")

            # Проверка успешности
            if "login" not in self.page.url.lower():
                print("[OK] Avtorizaciya uspeshna!")
                return True
            else:
                print("[ERROR] Oshibka avtorizacii. Proverte login/parol.")
                return False

        except Exception as e:
            print(f"[ERROR] Oshibka pri avtorizacii: {e}")
            return False

    # ==================== УРОВЕНЬ 1: ВСЕ КУРСЫ ====================

    async def parse_all_courses(self, materials_url: str = None) -> List[Dict]:
        """Парсинг списка всех курсов"""
        url = materials_url or f"{self.base_url}/cabinet/school/materials/personal"
        print(f"\n[COURSES] Загрузка списка курсов: {url}")

        await self.page.goto(url, wait_until="load")
        await asyncio.sleep(3)

        courses = []

        # Находим все карточки курсов (drag-card-item)
        cards = await self.page.query_selector_all('.drag-card-item, .tir-drag.item')
        print(f"   Найдено карточек: {len(cards)}")

        for card in cards:
            try:
                course_id = await card.get_attribute("id")
                if not course_id or not course_id.isdigit():
                    continue

                # Название курса
                name_el = await card.query_selector('.fw-medium, .avatar-card-name, .book-card-name')
                name = ""
                if name_el:
                    name = await name_el.inner_text()
                    name = name.strip()

                # Изображение курса
                img_el = await card.query_selector('img[src*="docstorio.com"]')
                image_url = ""
                if img_el:
                    image_url = await img_el.get_attribute("src")

                if name:
                    courses.append({
                        "id": course_id,
                        "name": name,
                        "image_url": image_url,
                        "url": f"{self.base_url}/cabinet/school/materials/personal/folder/{course_id}"
                    })
                    print(f"   [COURSE] {name} (ID: {course_id})")

            except Exception as e:
                print(f"   [WARN] Ошибка парсинга карточки: {e}")
                continue

        print(f"\n[OK] Найдено курсов: {len(courses)}")
        return courses

    # ==================== УРОВЕНЬ 2: ОДИН КУРС (СПИСОК УРОКОВ) ====================

    async def parse_course(self, course_url: str, parent_folder_id: str = None) -> Dict:
        """Парсинг одного курса - получение списка уроков"""
        print(f"\n[COURSE] Zagruzka kursa: {course_url}")

        # Извлекаем folder_id из URL
        folder_match = re.search(r'/folder/(\d+)', course_url)
        folder_id = folder_match.group(1) if folder_match else None

        # Переходим на страницу материалов
        materials_url = f"{self.base_url}/cabinet/school/materials/personal"
        print(f"   Step 1: Going to materials page...")
        await self.page.goto(materials_url, wait_until="load")
        await asyncio.sleep(5)

        if folder_id:
            # Сначала ищем на главной странице
            card = await self.page.query_selector(f'[id="{folder_id}"]')
            if card:
                print(f"   Step 2: Found folder ID {folder_id} on main page, clicking...")
                await card.click()
                await asyncio.sleep(5)
            else:
                # Вложенная папка - ищем родителя
                print(f"   Step 2: Folder {folder_id} not found, checking parent folder...")

                # Известные родительские папки
                parent_ids = {
                    # Beginner и другие уровни внутри English File 4th
                    '198472': '17223', '198474': '17223', '198475': '17223',
                    '198477': '17223', '198478': '17223', '198480': '17223', '198481': '17223',
                    # Family and Friends уровни 1-6 + F
                    '198487': '17222', '198489': '17222', '198490': '17222',
                    '198491': '17222', '198493': '17222', '198495': '17222',
                    '816630': '17222',
                }

                parent_id = parent_folder_id or parent_ids.get(folder_id)
                if parent_id:
                    print(f"   Step 2b: Going to parent folder {parent_id}...")
                    parent_card = await self.page.query_selector(f'[id="{parent_id}"]')
                    if parent_card:
                        await parent_card.click()
                        await asyncio.sleep(5)

                        # Теперь ищем целевую папку
                        target_card = await self.page.query_selector(f'[id="{folder_id}"]')
                        if target_card:
                            print(f"   Step 3: Found folder {folder_id}, clicking...")
                            await target_card.click()
                            await asyncio.sleep(5)
                        else:
                            print(f"   [WARN] Folder {folder_id} not found in parent")
                    else:
                        print(f"   [WARN] Parent folder {parent_id} not found")
                else:
                    print(f"   [WARN] No parent mapping for folder {folder_id}")

        current_url = self.page.url
        print(f"   Current URL: {current_url}")

        course_data = {
            "title": "",
            "url": course_url,
            "lessons": [],
            "parsed_at": datetime.now().isoformat()
        }

        # Название курса (из хлебных крошек или заголовка)
        title_el = await self.page.query_selector('.breadcrumb-item.active, .folder-title, h1')
        if title_el:
            course_data["title"] = (await title_el.inner_text()).strip()

        # Если не нашли - ищем по другому селектору
        if not course_data["title"]:
            # Берём из URL
            match = re.search(r'/folder/(\d+)', course_url)
            if match:
                course_data["title"] = f"Курс {match.group(1)}"

        print(f"   Название: {course_data['title']}")

        # Проверяем есть ли подпапки (вложенные курсы/уровни)
        subfolders = await self.page.query_selector_all('.tir-drag.item, .drag-card-item')
        if len(subfolders) > 0:
            print(f"   Found {len(subfolders)} SUBFOLDERS (nested courses):")
            course_data["subfolders"] = []
            for sf in subfolders:
                sf_id = await sf.get_attribute("id")
                sf_name_el = await sf.query_selector('.fw-medium, .avatar-card-name, .book-card-name')
                sf_name = ""
                if sf_name_el:
                    sf_name = (await sf_name_el.inner_text()).strip()
                if sf_id and sf_name:
                    course_data["subfolders"].append({"id": sf_id, "name": sf_name})
                    print(f"      - {sf_name} (ID: {sf_id})")

            print("\n   [INFO] This is a folder with sub-courses. To parse lessons, use URL of a specific sub-course:")
            for sf in course_data["subfolders"]:
                print(f"      --course-url \".../folder/{sf['id']}\"  # {sf['name']}")

        # Находим все карточки уроков
        lesson_cards = await self.page.query_selector_all('.book-lesson')
        print(f"   Found {len(lesson_cards)} lessons")

        # Если ничего не нашли - выведем структуру страницы
        if len(lesson_cards) == 0:
            print("   [DEBUG] Page structure:")
            # Смотрим первые элементы с data-v атрибутами
            main_content = await self.page.query_selector('.lesson-viewer-main, .materials-content, main, #app')
            if main_content:
                inner = await main_content.inner_html()
                # Выводим первые 500 символов
                print(f"   {inner[:500]}...")

        for i, card in enumerate(lesson_cards):
            try:
                lesson_info = await self._parse_lesson_card(card, i + 1)
                if lesson_info:
                    course_data["lessons"].append(lesson_info)
            except Exception as e:
                print(f"   [WARN] Ошибка парсинга урока {i+1}: {e}")

        return course_data

    async def _parse_lesson_card(self, card: ElementHandle, index: int) -> Optional[Dict]:
        """Парсинг карточки урока на странице курса"""
        lesson_info = {
            "index": index,
            "title": "",
            "image_uuid": ""
        }

        # Ищем изображение урока (UUID)
        img_el = await card.query_selector('img[src*="LessonImages"]')
        if img_el:
            src = await img_el.get_attribute("src")
            match = re.search(r'LessonImages/([a-f0-9\-]{36})', src)
            if match:
                lesson_info["image_uuid"] = match.group(1)

        # Ищем название урока
        # Паттерн 1: текст с номером (1. Название)
        all_text = await card.inner_text()
        lines = [l.strip() for l in all_text.split('\n') if l.strip()]

        for line in lines:
            # Ищем строки вида "1. Название" или "27. 9A- Something"
            if re.match(r'^\d+\.?\s+', line):
                lesson_info["title"] = line
                break

        # Если не нашли по номеру - берём первую непустую строку
        if not lesson_info["title"] and lines:
            lesson_info["title"] = lines[0]

        if lesson_info["title"]:
            print(f"      {index}. {lesson_info['title'][:50]}")

        return lesson_info if lesson_info["title"] else None

    async def navigate_to_folder(self, folder_id: str, parent_folder_id: str = None) -> bool:
        """Навигация к папке через клики (не через URL)"""
        # Переходим на страницу материалов
        materials_url = f"{self.base_url}/cabinet/school/materials/personal"
        await self.page.goto(materials_url, wait_until="load")
        await asyncio.sleep(3)

        # Известные родительские папки
        parent_ids = {
            # English File 4th
            '198472': '17223', '198474': '17223', '198475': '17223',
            '198477': '17223', '198478': '17223', '198480': '17223', '198481': '17223',
            # Family and Friends for Kids (1-6) + F
            '198487': '17222', '198489': '17222', '198490': '17222',
            '198491': '17222', '198493': '17222', '198495': '17222',
            '816630': '17222',
        }

        parent_id = parent_folder_id or parent_ids.get(folder_id)

        # Сначала пробуем найти папку на главной странице
        card = await self.page.query_selector(f'[id="{folder_id}"]')
        if card:
            await card.click()
            await asyncio.sleep(3)
            return True

        # Если нет - идём через родителя
        if parent_id:
            parent_card = await self.page.query_selector(f'[id="{parent_id}"]')
            if parent_card:
                await parent_card.click()
                await asyncio.sleep(3)

                target_card = await self.page.query_selector(f'[id="{folder_id}"]')
                if target_card:
                    await target_card.click()
                    await asyncio.sleep(3)
                    return True

        return False

    async def open_lesson_from_course(self, lesson_index: int) -> bool:
        """Открытие урока из списка курса по индексу (1-based)"""
        print(f"\n[LESSON] Opening lesson #{lesson_index}...")

        # Находим карточку урока (только .book-lesson для точности)
        cards = await self.page.query_selector_all('.book-lesson')

        if lesson_index < 1 or lesson_index > len(cards):
            print(f"[ERROR] Lesson #{lesson_index} not found (total {len(cards)} lessons)")
            return False

        card = cards[lesson_index - 1]

        # Скроллим к карточке
        await card.scroll_into_view_if_needed()
        await asyncio.sleep(1)

        # Двойной клик на карточку для открытия урока
        try:
            await card.dblclick(force=True)
        except:
            # Если двойной клик не работает - пробуем обычный клик с force
            await card.click(force=True)

        await asyncio.sleep(5)

        # Проверяем что урок открылся
        lesson_header = await self.page.query_selector('.lesson-viewer-header, .lesson-layout, .lesson-viewer-main')
        if lesson_header:
            print("[OK] Lesson opened")
            return True

        # Проверяем URL
        if "/lesson/" in self.page.url or "/content" in self.page.url:
            print("[OK] Navigated to lesson page")
            return True

        print("[WARN] Could not confirm lesson opened")
        return True

    # ==================== УРОВЕНЬ 3: ОДИН УРОК ====================

    async def parse_lesson(self, lesson_url: str = None) -> Dict:
        """Парсинг текущего открытого урока или урока по URL"""
        if lesson_url:
            print(f"\n[LESSON] Загрузка урока: {lesson_url}")
            await self.page.goto(lesson_url, wait_until="domcontentloaded", timeout=60000)
            print("   Ожидание загрузки контента...")
            # Увеличиваем задержку для lesson-editor
            await asyncio.sleep(8)

            # Дополнительное ожидание для динамического контента
            try:
                await self.page.wait_for_selector('.sections-list_item, .exercise_wrapper', timeout=10000)
                print("   Контент загружен")
            except:
                print("   [WARN] Timeout waiting for content, continuing anyway...")

        lesson_data = {
            "title": "",
            "sections": [],
            "parsed_at": datetime.now().isoformat(),
            "source_url": lesson_url or self.page.url
        }

        # Название урока
        title_el = await self.page.query_selector('.lesson-viewer-header_input, .lesson-description')
        if title_el:
            lesson_data["title"] = (await title_el.inner_text()).strip()

        print(f"   Название: {lesson_data['title']}")

        # Список разделов
        section_elements = await self.page.query_selector_all('.sections-list_item:not(.medium)')
        section_names = []

        for section_el in section_elements:
            name = (await section_el.inner_text()).strip()
            if name and name != "Добавить раздел" and not name.startswith("Для домашней"):
                section_names.append(name)

        print(f"   Разделов: {len(section_names)}")
        for i, name in enumerate(section_names, 1):
            print(f"      {i}. {name}")

        # Парсим каждый раздел
        previous_content_hash = None

        for i, section_name in enumerate(section_names):
            print(f"\n   [SECTION] Парсинг раздела {i+1}/{len(section_names)}: {section_name}")

            # Кликаем на раздел (ищем точное совпадение текста)
            section_elements = await self.page.query_selector_all('.sections-list_item:not(.medium)')
            section_el = None
            for el in section_elements:
                el_text = (await el.inner_text()).strip()
                if el_text == section_name:
                    section_el = el
                    break

            if section_el:
                # Скроллим к элементу и кликаем
                await section_el.scroll_into_view_if_needed()
                await asyncio.sleep(0.5)
                await section_el.click()

                # Ждём пока контент обновится (проверяем hash содержимого)
                max_attempts = 15
                for attempt in range(max_attempts):
                    await asyncio.sleep(1)

                    # Получаем hash текущего содержимого (ID + текст первых 2 упражнений)
                    exercises = await self.page.query_selector_all('.exercise_wrapper')
                    content_parts = []
                    for ex in exercises[:2]:  # Первые 2 упражнения для надёжности
                        ex_id = await ex.get_attribute("id") or ""
                        ex_text = (await ex.inner_text())[:100] if ex else ""
                        content_parts.append(f"{ex_id}:{ex_text}")
                    current_hash = "|".join(content_parts)

                    # Если hash изменился или это первая секция - контент загружен
                    if current_hash != previous_content_hash or i == 0:
                        previous_content_hash = current_hash
                        first_id = content_parts[0].split(":")[0] if content_parts else "None"
                        print(f"      Контент загружен (exercise_id: {first_id})")
                        break

                    # Пробуем кликнуть ещё раз если контент не изменился
                    if attempt == 5:
                        print(f"      [RETRY] Повторный клик на секцию...")
                        await section_el.click()

                    if attempt == max_attempts - 1:
                        print(f"      [WARN] Контент не изменился после {max_attempts} попыток")

                await asyncio.sleep(0.5)  # Финальная задержка для стабильности

            # Парсим упражнения
            section_data = await self._parse_section(section_name)
            lesson_data["sections"].append(section_data)

        return lesson_data

    async def _parse_section(self, section_name: str) -> Dict:
        """Парсинг текущего раздела урока"""
        section_data = {
            "title": section_name,
            "exercises": []
        }

        exercises = await self.page.query_selector_all('.exercise_wrapper')
        print(f"      Упражнений: {len(exercises)}")

        for i, exercise in enumerate(exercises):
            exercise_data = await self._parse_exercise(exercise, i + 1)
            if exercise_data:
                section_data["exercises"].append(exercise_data)

        return section_data

    @staticmethod
    def _parse_fillgaps_html(html_content: str) -> dict:
        """Парсит HTML fill_gaps блока и извлекает text и gaps.
        Копия логики из scripts/fix_fillgaps_in_db.py."""
        if not BeautifulSoup:
            return {"text": "", "gaps": []}

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

    async def _extract_test_options(self, exercise_el: ElementHandle, slot_el: ElementHandle) -> list:
        """Извлечение опций теста через Playwright DOM."""
        options = []

        # Try multiple selectors for test options
        option_selectors = [
            '.tir-radio',
            '.radio-option',
            '.answer-option',
            '.exercise-select-item',
            'label:has(input[type="radio"])',
            '.option-item',
            '.test-option',
        ]

        option_elements = []
        search_root = slot_el or exercise_el
        for selector in option_selectors:
            option_elements = await search_root.query_selector_all(selector)
            if option_elements and len(option_elements) >= 2:
                break

        for opt_el in option_elements:
            opt_text = (await opt_el.inner_text()).strip()
            if not opt_text:
                continue

            is_correct = False
            class_attr = await opt_el.get_attribute("class") or ""
            if "correct" in class_attr.lower() or "right" in class_attr.lower():
                is_correct = True
            data_correct = await opt_el.get_attribute("data-correct")
            if data_correct == "true":
                is_correct = True

            options.append({"text": opt_text, "is_correct": is_correct})

        return options

    async def _parse_exercise(self, exercise_el: ElementHandle, index: int) -> Optional[Dict]:
        """Парсинг одного упражнения"""
        exercise_data = {
            "position": index,
            "block_type": "text",
            "content": {}
        }

        try:
            # ID упражнения
            exercise_id = await exercise_el.get_attribute("id")
            if exercise_id:
                exercise_data["source_id"] = exercise_id

            # Заголовок
            title_el = await exercise_el.query_selector('.exercise-wrapper-title-text')
            if title_el:
                exercise_data["title"] = (await title_el.inner_text()).strip()

            # Получаем HTML контент для анализа
            slot_el = await exercise_el.query_selector('.exercise-wrapper-slot')
            html_content = ""
            text_content = ""
            if slot_el:
                html_content = await slot_el.inner_html()
                text_content = await slot_el.inner_text()

            # === УМНОЕ ОПРЕДЕЛЕНИЕ ТИПА БЛОКА ===
            # Анализируем HTML структуру для универсального распознавания типов

            # Проверка 1: Fill gaps - есть поля ввода для заполнения пропусков
            if ('listofintputs=' in html_content or
                'exercise-answer-input' in html_content or
                'exercise-input-correct-form-word' in html_content or
                ('<input' in html_content and ('complete' in exercise_data.get("title", "").lower() or
                                                'fill' in exercise_data.get("title", "").lower() or
                                                'write' in exercise_data.get("title", "").lower()))):
                exercise_data["block_type"] = "fill_gaps"
                # Try to extract structured data from HTML
                if 'rightanswers' in html_content and BeautifulSoup:
                    parsed = self._parse_fillgaps_html(html_content)
                    if parsed["gaps"]:
                        exercise_data["content"] = parsed
                    else:
                        exercise_data["content"] = {"text": text_content.strip(), "gaps": [], "html": html_content}
                else:
                    exercise_data["content"] = {"text": text_content.strip(), "gaps": [], "html": html_content}
                return exercise_data

            # Проверка 2: Matching/Word Order - есть draggable элементы
            if ('draggable' in html_content or 'sorting_wrapper' in html_content):
                title_lower = exercise_data.get("title", "").lower()
                # Если в заголовке "match", "pair" - это matching
                if 'match' in title_lower or 'pair' in title_lower:
                    exercise_data["block_type"] = "matching"
                    exercise_data["content"] = {"html": html_content, "text": text_content.strip(), "pairs": []}
                    return exercise_data
                # Если "order", "arrange", "put in order" - это word_order
                elif 'order' in title_lower or 'arrange' in title_lower or 'sentence' in title_lower:
                    exercise_data["block_type"] = "word_order"
                    exercise_data["content"] = {"html": html_content, "text": text_content.strip(), "sentences": []}
                    return exercise_data
                # По умолчанию - matching
                else:
                    exercise_data["block_type"] = "matching"
                    exercise_data["content"] = {"html": html_content, "text": text_content.strip(), "pairs": []}
                    return exercise_data

            # Проверка 3: Essay/Writing - есть текстовый редактор
            if ('exercise-essay' in html_content or
                'html-editor' in html_content or
                'contenteditable="true"' in html_content):
                exercise_data["block_type"] = "essay"
                exercise_data["content"] = {"html": html_content, "text": text_content.strip()}
                return exercise_data

            # Проверка 4: Test/Quiz - есть radio buttons или checkboxes
            if (('tir-radio' in html_content or 'radio-group' in html_content or
                 '<input type="radio"' in html_content or '<input type="checkbox"' in html_content) and
                ('exercise-test' in html_content or 'quiz' in html_content or
                 'choose' in exercise_data.get("title", "").lower() or
                 'select' in exercise_data.get("title", "").lower())):
                exercise_data["block_type"] = "test"
                # Try to extract options via Playwright
                options = await self._extract_test_options(exercise_el, slot_el)
                exercise_data["content"] = {
                    "question": exercise_data.get("title", ""),
                    "options": options,
                    "html": html_content
                }
                return exercise_data

            # Проверка 5: True/False - ключевые слова в заголовке
            title_lower = exercise_data.get("title", "").lower()
            if ('true' in title_lower and 'false' in title_lower) or 'правда' in title_lower or 'ложь' in title_lower:
                exercise_data["block_type"] = "true_false"
                exercise_data["content"] = {"text": text_content.strip(), "html": html_content}
                return exercise_data

            # Проверка 6: Flashcards - карточки со словами
            if ('flashcard' in html_content or 'card-flip' in html_content or
                ('card' in html_content and 'vocabulary' in title_lower)):
                exercise_data["block_type"] = "flashcards"
                exercise_data["content"] = {"html": html_content, "text": text_content.strip(), "cards": []}
                return exercise_data

            # Проверка 7: Image choice - выбор изображения
            if (html_content.count('<img') >= 3 and  # Несколько изображений
                ('choose' in title_lower or 'select' in title_lower or 'which' in title_lower)):
                exercise_data["block_type"] = "image_choice"
                exercise_data["content"] = {"html": html_content, "question": exercise_data.get("title", ""), "options": []}
                return exercise_data

            # === Определение типа и парсинг контента (существующая логика как fallback) ===

            # 1. Изображение
            img_el = await exercise_el.query_selector('.exercise_images_wrapper img, .teacher_img, .image_component_wrapper img')
            if img_el:
                exercise_data["block_type"] = "image"
                src = await img_el.get_attribute("src")
                exercise_data["content"] = {
                    "url": src,
                    "caption": exercise_data.get("title", "")
                }
                return exercise_data

            # 2. Видео
            video_el = await exercise_el.query_selector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-player')
            if video_el:
                exercise_data["block_type"] = "video"
                src = await video_el.get_attribute("src")
                exercise_data["content"] = {"url": src or ""}
                return exercise_data

            # 3. Аудио
            # Сначала ищем именно <audio> тег
            audio_tag = await exercise_el.query_selector('audio')
            if audio_tag:
                exercise_data["block_type"] = "audio"
                src = await audio_tag.get_attribute("src")
                # Если src пустой, ищем <source> внутри
                if not src:
                    source_tag = await audio_tag.query_selector('source')
                    if source_tag:
                        src = await source_tag.get_attribute("src")
                exercise_data["content"] = {"url": src or ""}
                return exercise_data

            # Если <audio> не найден, ищем обёртку и audio внутри
            audio_wrapper = await exercise_el.query_selector('.audio-player, [class*="audio"]')
            if audio_wrapper:
                audio_tag = await audio_wrapper.query_selector('audio')
                if audio_tag:
                    exercise_data["block_type"] = "audio"
                    src = await audio_tag.get_attribute("src")
                    if not src:
                        source_tag = await audio_tag.query_selector('source')
                        if source_tag:
                            src = await source_tag.get_attribute("src")
                    exercise_data["content"] = {"url": src or ""}
                    return exercise_data

                # Последний fallback - ищем MP3 URL в HTML
                html = await audio_wrapper.inner_html()
                import re
                mp3_match = re.search(r'https?://[^\s"\'<>]+\.mp3', html)
                if mp3_match:
                    exercise_data["block_type"] = "audio"
                    exercise_data["content"] = {"url": mp3_match.group(0)}
                    return exercise_data

            # 4. Topic (текст с заметками преподавателя) - старый формат
            topic_el = await exercise_el.query_selector('.exercise-topic')
            if topic_el:
                exercise_data["block_type"] = "teaching_guide"
                text_el = await topic_el.query_selector('.exercise-topic-text, .exercise-texteditor-preview')
                if text_el:
                    html = await text_el.inner_html()
                    text = await text_el.inner_text()
                    exercise_data["content"] = {"html": html, "text": text.strip()}
                return exercise_data

            # 5. Note / Teaching guide (различаем по .note-name)
            note_el = await exercise_el.query_selector('.exercise-note-wrapper, .tir-alert.blue, .note-body')
            if note_el:
                # Проверяем .note-name чтобы определить тип
                note_name_el = await note_el.query_selector('.note-name')
                note_name_text = ""
                if note_name_el:
                    note_name_text = (await note_name_el.inner_text()).strip().lower()

                # Если содержит "teaching guide" - это заметка для преподавателя
                if "teaching guide" in note_name_text:
                    exercise_data["block_type"] = "teaching_guide"
                else:
                    exercise_data["block_type"] = "remember"

                text_el = await note_el.query_selector('.note-text, .exercise-texteditor-preview, span')
                if text_el:
                    html = await text_el.inner_html()
                    text = await text_el.inner_text()
                    exercise_data["content"] = {"html": html, "text": text.strip()}
                return exercise_data

            # 6. Fill gaps - теперь обрабатывается в универсальной логике выше (строка 590)

            # 7. Test / Quiz / Radio buttons
            # Ищем различные варианты тестовых элементов
            test_el = await exercise_el.query_selector(
                '.exercise-test, .quiz, .exercise-radio, .exercise-select, '
                '.tir-radio-group, [class*="test"][class*="question"], [class*="radio"][class*="group"]'
            )
            if test_el:
                exercise_data["block_type"] = "test"
                test_html = await test_el.inner_html()
                exercise_data["content"] = {"question": "", "options": [], "html": test_html}

                # Ищем вопрос (заголовок теста)
                question_el = await exercise_el.query_selector(
                    '.exercise-wrapper-title-text, .question-text, .test-question, h3, h4'
                )
                if question_el:
                    exercise_data["content"]["question"] = (await question_el.inner_text()).strip()

                # Extract options via shared method
                options = await self._extract_test_options(exercise_el, test_el)
                exercise_data["content"]["options"] = options

                # Если опций не найдено - пробуем извлечь из текста
                if not exercise_data["content"]["options"]:
                    full_text = await test_el.inner_text()
                    exercise_data["content"]["question"] = full_text.strip()

                return exercise_data

            # 8. Matching - теперь обрабатывается в универсальной логике выше (строка 600)

            # 9. True/False
            tf_el = await exercise_el.query_selector('.exercise-true-false, [class*="true"][class*="false"]')
            if tf_el:
                exercise_data["block_type"] = "true_false"
                text = await tf_el.inner_text()
                tf_html = await tf_el.inner_html()
                exercise_data["content"] = {"text": text.strip(), "html": tf_html}
                return exercise_data

            # 10. Word order - теперь обрабатывается в универсальной логике выше (строка 609)

            # 11. Dialogue
            dialogue_el = await exercise_el.query_selector('.exercise-dialogue, .dialogue')
            if dialogue_el:
                exercise_data["block_type"] = "text"
                html = await dialogue_el.inner_html()
                exercise_data["content"] = {"html": html}
                return exercise_data

            # Fallback: весь контент упражнения
            slot_el = await exercise_el.query_selector('.exercise-wrapper-slot')
            if slot_el:
                html = await slot_el.inner_html()
                text = await slot_el.inner_text()
                if text.strip():
                    exercise_data["content"] = {"html": html, "text": text.strip()}

            return exercise_data

        except Exception as e:
            print(f"      [WARN] Ошибка парсинга упражнения {index}: {e}")
            return None

    # ==================== КОНВЕРТАЦИЯ В ФОРМАТ JSI ====================

    def convert_to_jsi_format(self, edvibe_data: Dict) -> Dict:
        """Конвертация данных Edvibe в формат JSI LMS (старый формат - один урок)"""
        jsi_course = {
            "title": edvibe_data.get("title", "Импортированный урок"),
            "description": f"Импортировано из Edvibe: {edvibe_data.get('source_url', '')}",
            "sections": []
        }

        for section in edvibe_data.get("sections", []):
            jsi_section = {
                "title": section.get("title", ""),
                "lessons": [{
                    "title": section.get("title", ""),
                    "blocks": []
                }]
            }

            for exercise in section.get("exercises", []):
                block = self._convert_exercise_to_block(exercise)
                if block:
                    jsi_section["lessons"][0]["blocks"].append(block)

            jsi_course["sections"].append(jsi_section)

        return jsi_course

    def convert_lesson_to_jsi_flat(self, edvibe_lesson: Dict, lesson_title: str = "") -> Dict:
        """
        Конвертация урока Edvibe в плоский формат JSI.
        Все секции урока (Warm-up, Speaking, etc.) объединяются в один урок.
        Между секциями добавляются divider блоки с названием секции.

        Структура:
        - Один урок содержит все блоки из всех секций
        - Перед каждой секцией - divider с названием
        """
        title = lesson_title or edvibe_lesson.get("title", "Урок")
        blocks = []
        position = 1

        for section in edvibe_lesson.get("sections", []):
            section_title = section.get("title", "")

            # Добавляем заголовок секции как text блок (жирный заголовок)
            if section_title:
                blocks.append({
                    "block_type": "text",
                    "position": position,
                    "content": {
                        "html": f"<h2><strong>{section_title}</strong></h2>",
                        "text": section_title
                    },
                    "title": ""  # Без дополнительного заголовка
                })
                position += 1

            # Добавляем все упражнения секции
            for exercise in section.get("exercises", []):
                block = self._convert_exercise_to_block(exercise)
                if block:
                    block["position"] = position
                    blocks.append(block)
                    position += 1

        return {
            "title": title,
            "blocks": blocks
        }

    def convert_course_to_jsi_hierarchy(self, course_name: str, level_name: str, lessons_data: List[Dict]) -> Dict:
        """
        Конвертация курса Edvibe в иерархию JSI.

        Иерархия:
        - Course (English File 4th) - папка/серия
        - Section (Beginner) - уровень
        - Lesson (1A Cappuccino) - урок
        - Blocks - все блоки урока

        Args:
            course_name: Название курса (напр. "English File 4th")
            level_name: Название уровня (напр. "Beginner")
            lessons_data: Список уроков с данными от parse_lesson()
        """
        jsi_course = {
            "title": course_name,
            "description": f"Импортировано из Edvibe",
            "sections": [{
                "title": level_name,
                "lessons": []
            }]
        }

        for i, lesson_data in enumerate(lessons_data, 1):
            # Приоритет: lesson_title (из списка курса) > title (из страницы урока) > Урок N
            lesson_title = lesson_data.get("lesson_title") or lesson_data.get("title") or f"Урок {i}"
            flat_lesson = self.convert_lesson_to_jsi_flat(lesson_data, lesson_title)
            jsi_course["sections"][0]["lessons"].append(flat_lesson)
            print(f"   Конвертирован урок: {lesson_title} ({len(flat_lesson['blocks'])} блоков)")

        return jsi_course

    def _convert_exercise_to_block(self, exercise: Dict) -> Dict:
        """Конвертация упражнения в блок JSI"""
        block_type = exercise.get("block_type", "text")
        content = exercise.get("content", {})

        block = {
            "block_type": block_type,
            "position": exercise.get("position", 0),
            "content": {}
        }

        if block_type in ("image", "video", "audio"):
            block["content"] = {"url": content.get("url", "")}
            if content.get("caption"):
                block["content"]["caption"] = content["caption"]

        elif block_type in ("text", "teaching_guide", "remember"):
            # JSI expects 'html' field for remember blocks
            raw_html = content.get("html", content.get("text", ""))
            clean_html = self._clean_html(raw_html)
            block["content"] = {"html": clean_html, "text": clean_html}

        elif block_type == "fill_gaps":
            block["content"] = {
                "text": content.get("text", ""),
                "gaps": content.get("gaps", []),
                "html": content.get("html", ""),
            }

        elif block_type == "test":
            # Preserve options as-is (already structured dicts from _extract_test_options)
            options = content.get("options", [])
            if options and isinstance(options[0], str):
                options = [{"text": opt, "is_correct": False} for opt in options]
            block["content"] = {
                "question": content.get("question", ""),
                "options": options,
                "html": content.get("html", ""),
            }

        elif block_type == "matching":
            block["content"] = {
                "pairs": content.get("pairs", []),
                "html": content.get("html", ""),
                "text": content.get("text", ""),
            }

        elif block_type == "true_false":
            block["content"] = {
                "text": content.get("text", ""),
                "statements": content.get("statements", []),
                "html": content.get("html", ""),
            }

        elif block_type == "word_order":
            block["content"] = {
                "sentences": content.get("sentences", [{"words": content.get("words", []), "correct_order": []}]),
                "html": content.get("html", ""),
                "text": content.get("text", ""),
            }

        if exercise.get("title"):
            block["title"] = exercise["title"]

        return block

    def _clean_html(self, html: str) -> str:
        """Очистка HTML от Vue.js атрибутов и лишних классов"""
        if not html:
            return ""

        # Удаляем Vue.js атрибуты (data-v-*)
        import re
        html = re.sub(r'\s*data-v-[a-z0-9]+(?:-s)?="[^"]*"', '', html)
        html = re.sub(r'\s*data-v-[a-z0-9]+(?:-s)?', '', html)

        # Удаляем классы Edvibe
        html = re.sub(r'\s*class="[^"]*exercise-[^"]*"', '', html)
        html = re.sub(r'\s*class="[^"]*note-[^"]*"', '', html)

        # Удаляем пустые атрибуты
        html = re.sub(r'\s*class=""', '', html)
        html = re.sub(r'\s*dir="ltr"', '', html)

        # Удаляем HTML-комментарии
        html = re.sub(r'<!--.*?-->', '', html)

        # Упрощаем вложенные span без атрибутов
        html = re.sub(r'<span>\s*<span>([^<]*)</span>\s*</span>', r'<span>\1</span>', html)

        # Удаляем пустые теги
        html = re.sub(r'<(\w+)>\s*</\1>', '', html)

        return html.strip()

    # ==================== СОХРАНЕНИЕ ====================

    def save_to_file(self, data: Dict, filename: str) -> Path:
        """Сохранение данных в JSON файл"""
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        filepath = output_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"\n[SAVE] Сохранено: {filepath}")
        return filepath


# ==================== ГЛАВНАЯ ФУНКЦИЯ ====================

async def main():
    parser = argparse.ArgumentParser(
        description="Парсер курсов Edvibe",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:

  # Парсинг всех курсов
  python parser.py -e email@example.com -p password --all-courses

  # Парсинг одного курса (все уроки)
  python parser.py -e email@example.com -p password --course-url "https://edvibe.com/.../folder/198472"

  # Парсинг одного урока
  python parser.py -e email@example.com -p password --lesson-url "https://edvibe.com/.../lesson/123456"

  # С отображением браузера (для отладки)
  python parser.py -e email -p pass --course-url "..." --no-headless
        """
    )

    parser.add_argument("--email", "-e", required=True, help="Email для входа в Edvibe")
    parser.add_argument("--password", "-p", required=True, help="Пароль")

    # Режимы парсинга (взаимоисключающие)
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--all-courses", action="store_true", help="Парсить все курсы")
    mode_group.add_argument("--course-url", help="URL курса для парсинга всех уроков")
    mode_group.add_argument("--lesson-url", help="URL одного урока для парсинга")

    parser.add_argument("--no-headless", action="store_true", help="Показывать браузер (для отладки)")
    parser.add_argument("--manual-login", action="store_true", help="Ручной вход (скрипт ждёт пока вы залогинитесь)")
    parser.add_argument("--session", default=None, help="Путь к файлу сессии (session.json). Если не указан, ищет в папке скрипта")
    parser.add_argument("--slow", type=int, default=0, help="Замедление действий в мс (для отладки)")
    parser.add_argument("--output", "-o", help="Имя выходного файла")
    parser.add_argument("--max-lessons", type=int, default=0, help="Максимум уроков для парсинга (0 = все)")
    parser.add_argument("--course-name", default="English File 4th", help="Название курса/серии (напр. 'English File 4th')")
    parser.add_argument("--level-name", default="Beginner", help="Название уровня (напр. 'Beginner')")

    args = parser.parse_args()

    edvibe = EdvibeParser(
        email=args.email,
        password=args.password,
        headless=not args.no_headless,
        slow_mo=args.slow
    )

    try:
        # Определяем путь к файлу сессии
        session_path = args.session or str(Path(__file__).parent / "session.json")

        await edvibe.start(storage_state_path=session_path)

        # Проверяем есть ли сохранённая сессия
        if Path(session_path).exists():
            print(f"[SESSION] Found saved session: {session_path}")
            # Проверяем что сессия валидна
            await edvibe.page.goto(f"{edvibe.base_url}/cabinet/school/materials/personal", wait_until="load")
            await asyncio.sleep(3)
            if "login" not in edvibe.page.url.lower():
                print("[OK] Session is valid, skipping login")
            else:
                print("[WARN] Session expired, need to login again")
                if not await edvibe.login(manual=args.manual_login):
                    return
        else:
            # Нет сохранённой сессии - логинимся
            if not await edvibe.login(manual=args.manual_login):
                return

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # === Режим 1: Все курсы ===
        if args.all_courses:
            print("\n" + "="*60)
            print("РЕЖИМ: Парсинг всех курсов")
            print("="*60)

            courses = await edvibe.parse_all_courses()

            # Сохраняем список курсов
            filename = args.output or f"courses_list_{timestamp}.json"
            edvibe.save_to_file({"courses": courses, "parsed_at": datetime.now().isoformat()}, filename)

            # Парсим каждый курс
            all_data = {"courses": []}

            for course in courses:
                print(f"\n{'='*60}")
                print(f"Парсинг курса: {course['name']}")
                print("="*60)

                course_data = await edvibe.parse_course(course["url"])
                course_data["name"] = course["name"]
                course_data["id"] = course["id"]

                # Парсим каждый урок курса
                lessons_data = []
                max_lessons = args.max_lessons or len(course_data["lessons"])

                for i, lesson_info in enumerate(course_data["lessons"][:max_lessons]):
                    print(f"\n--- Урок {i+1}/{min(max_lessons, len(course_data['lessons']))}: {lesson_info['title'][:40]} ---")

                    # Возвращаемся к списку курса если нужно
                    if i > 0:
                        await edvibe.page.goto(course["url"], wait_until="load")
                        await asyncio.sleep(2)

                    # Открываем урок
                    if await edvibe.open_lesson_from_course(lesson_info["index"]):
                        lesson_data = await edvibe.parse_lesson()
                        lesson_data["course_name"] = course["name"]
                        lessons_data.append(lesson_data)

                course_data["lessons_full"] = lessons_data
                all_data["courses"].append(course_data)

            # Сохраняем полные данные
            full_filename = f"full_export_{timestamp}.json"
            edvibe.save_to_file(all_data, full_filename)

            print("\n" + "="*60)
            print("[OK] ПАРСИНГ ЗАВЕРШЕН!")
            print(f"   Курсов: {len(all_data['courses'])}")
            total_lessons = sum(len(c.get('lessons_full', [])) for c in all_data['courses'])
            print(f"   Уроков: {total_lessons}")

        # === Режим 2: Один курс ===
        elif args.course_url:
            print("\n" + "="*60)
            print("РЕЖИМ: Парсинг одного курса")
            print(f"Курс: {args.course_name}")
            print(f"Уровень: {args.level_name}")
            print("="*60)

            course_data = await edvibe.parse_course(args.course_url)

            # Парсим каждый урок
            lessons_data = []
            max_lessons = args.max_lessons or len(course_data["lessons"])

            # Извлекаем folder_id для навигации
            folder_match = re.search(r'/folder/(\d+)', args.course_url)
            folder_id = folder_match.group(1) if folder_match else None

            for i, lesson_info in enumerate(course_data["lessons"][:max_lessons]):
                lesson_title = lesson_info.get('title', f'Урок {i+1}')
                print(f"\n--- Урок {i+1}/{min(max_lessons, len(course_data['lessons']))}: {lesson_title[:50]} ---")

                if i > 0:
                    # Возвращаемся к папке через клики (не через URL)
                    print("   [NAV] Returning to course folder...")
                    if folder_id:
                        await edvibe.navigate_to_folder(folder_id)
                    else:
                        await edvibe.page.goto(args.course_url, wait_until="load")
                        await asyncio.sleep(2)

                if await edvibe.open_lesson_from_course(lesson_info["index"]):
                    lesson_data = await edvibe.parse_lesson()
                    # Сохраняем название урока из списка курса (более надёжное)
                    lesson_data["lesson_title"] = lesson_title
                    lessons_data.append(lesson_data)

            course_data["lessons_full"] = lessons_data

            # === Сохраняем в новой иерархии ===
            # Конвертируем все уроки в единый курс с правильной иерархией
            jsi_hierarchy = edvibe.convert_course_to_jsi_hierarchy(
                course_name=args.course_name,
                level_name=args.level_name,
                lessons_data=lessons_data
            )

            # Сохраняем единый файл с иерархией
            safe_level = re.sub(r'[^\w\s-]', '', args.level_name)
            safe_level = re.sub(r'\s+', '_', safe_level)[:30]
            hierarchy_filename = f"jsi_hierarchy_{safe_level}_{timestamp}.json"
            edvibe.save_to_file(jsi_hierarchy, hierarchy_filename)

            # Также сохраняем сырые данные курса
            safe_course = re.sub(r'[^\w\s-]', '', course_data.get("title", "course"))
            safe_course = re.sub(r'\s+', '_', safe_course)[:30]
            raw_filename = args.output or f"raw_course_{safe_course}_{timestamp}.json"
            edvibe.save_to_file(course_data, raw_filename)

            print("\n" + "="*60)
            print("[OK] ПАРСИНГ КУРСА ЗАВЕРШЕН!")
            print(f"   Курс: {course_data.get('title')}")
            print(f"   Уроков: {len(lessons_data)}")

        # === Режим 3: Один урок ===
        elif args.lesson_url:
            print("\n" + "="*60)
            print("РЕЖИМ: Парсинг одного урока")
            print("="*60)

            lesson_data = await edvibe.parse_lesson(args.lesson_url)

            # Сохраняем сырые данные
            safe_title = re.sub(r'[^\w\s-]', '', lesson_data.get("title", "lesson"))
            safe_title = re.sub(r'\s+', '_', safe_title)[:30]
            filename = args.output or f"lesson_{safe_title}_{timestamp}.json"

            edvibe.save_to_file(lesson_data, f"raw_{filename}")

            # Конвертируем в JSI формат
            jsi_data = edvibe.convert_to_jsi_format(lesson_data)
            edvibe.save_to_file(jsi_data, f"jsi_{filename}")

            print("\n" + "="*60)
            print("[OK] ПАРСИНГ УРОКА ЗАВЕРШЕН!")
            print(f"   Урок: {lesson_data.get('title')}")
            print(f"   Разделов: {len(lesson_data.get('sections', []))}")
            total_ex = sum(len(s.get('exercises', [])) for s in lesson_data.get('sections', []))
            print(f"   Упражнений: {total_ex}")

    except Exception as e:
        print(f"\n[ERROR] Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await edvibe.close()


if __name__ == "__main__":
    asyncio.run(main())
