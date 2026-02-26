"""
Скрипт для получения ссылок на уровни курса
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def get_levels():
    session_file = Path(__file__).parent / "session.json"

    print("[START] Zapusk brauzera...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        context = await browser.new_context(storage_state=str(session_file))
        page = await context.new_page()
        page.set_default_timeout(60000)

        course_url = "https://edvibe.com/cabinet/school/materials/books/folder/17221"
        print(f"[OPEN] {course_url}")

        await page.goto(course_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(5000)

        print("\n[INFO] Ishchu kartochki kursov...")

        # Ждём загрузки карточек
        try:
            await page.wait_for_selector(".book-card-avatar-card", timeout=10000)
        except:
            print("[WARN] Ne udalos dojdatsya kartochek")

        # Дополнительное время
        await page.wait_for_timeout(3000)

        # Ищем все карточки курсов
        cards = await page.locator(".book-card-avatar-card").all()
        print(f"[INFO] Naydeno kartochek: {len(cards)}")

        levels = []

        for i, card in enumerate(cards, 1):
            try:
                # Получаем название уровня из самой карточки
                title = await card.locator(".avatar-card-name_wrap p").text_content()
                title = title.strip() if title else f"Level {i}"

                print(f"\n[LEVEL {i}] {title}")

                # Кликаем на карточку
                await card.click()
                await page.wait_for_timeout(4000)

                # Получаем URL
                current_url = page.url
                print(f"[URL] {current_url}")

                # Извлекаем ID папки
                folder_id = current_url.split("/folder/")[-1]

                levels.append({
                    "title": title,
                    "url": current_url,
                    "folder_id": folder_id
                })

                # Возвращаемся назад
                await page.go_back()
                await page.wait_for_timeout(2000)

            except Exception as e:
                print(f"[ERROR] {e}")

        # Сохраняем результаты
        output_file = Path(__file__).parent / "market_leader_levels.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(levels, f, indent=2, ensure_ascii=False)

        print(f"\n[SAVED] Rezultaty sohraneny: {output_file}")
        print("\n=== NAJDENNYE UROVNI ===")
        for level in levels:
            print(f"\nNazvanie: {level['title']}")
            print(f"URL: {level['url']}")
            print(f"Folder ID: {level['folder_id']}")

        await page.wait_for_timeout(3000)
        await browser.close()
        print("\n[DONE] Gotovo!")

if __name__ == "__main__":
    asyncio.run(get_levels())
