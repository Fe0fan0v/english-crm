"""
Проверка количества секций в Intermediate и Upper-Intermediate уровнях Market Leader
"""
import asyncio
from pathlib import Path
from parser import EdvibeParser

LEVELS = [
    {"id": "667903", "name": "MARKET LEADER INTER", "level": "Intermediate"},
    {"id": "683180", "name": "MARKET LEADER UPPER", "level": "Upper-Intermediate"}
]

async def check_sections():
    email = "jsi.online.2020@gmail.com"
    password = "Vg9$kR7p!sQ2#Lm8"

    edvibe = EdvibeParser(email, password, headless=True, slow_mo=300)

    try:
        session_file = Path(__file__).parent / "session.json"
        await edvibe.start(storage_state_path=str(session_file) if session_file.exists() else None)

        for level_info in LEVELS:
            book_id = level_info["id"]
            book_url = f"https://edvibe.com/cabinet/school/materials/book/{book_id}/content"

            print(f"\n{level_info['level']}:")
            await edvibe.page.goto(book_url, wait_until="domcontentloaded")
            await asyncio.sleep(3)

            # Клик на Содержание
            content_tab = await edvibe.page.query_selector('text="Содержание"')
            if content_tab:
                await content_tab.click()
                await asyncio.sleep(2)

            # Ждём секции
            try:
                await edvibe.page.wait_for_selector('.section_accordion_list-item', timeout=10000)
                await asyncio.sleep(2)
            except:
                pass

            sections = await edvibe.page.query_selector_all('.section_accordion_list-item')
            print(f"  Найдено секций: {len(sections)}")

    finally:
        await edvibe.close()

if __name__ == "__main__":
    asyncio.run(check_sections())
