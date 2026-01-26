"""Import all 89 teachers from Excel to production database."""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import async_session_maker
from app.models import Level, User
from app.models.user import UserRole
from app.utils.security import get_password_hash

# All 89 teachers from Преподы.xlsx
TEACHERS = [
    ["Ms. Dilnara Aripova", "dilnaraaripova@gmail.com", "000000", None, "12+"],
    ["Ms. Kamila Arslonbekova", "katyhoul@gmail.com", "000001", None, "12+"],
    ["Mr. Denis Bem", "bemdenis@gmail.com", "000002", None, "12+"],
    ["Ms. Bakhtawar Ratib", "Bakhtawar.ratib2001@gmail.com", "000003", None, "12+"],
    ["Ms. Dinara Abdrakhmanova", "dinara.abdrakhmanova.01@gmail.com", "000004", None, "6-12"],
    ["Ms. Anel Azimkhanova", "anel.azimkhanova2004@gmail.com", "000005", None, "6-12"],
    ["Ms. Manshuk Akzholtayeva", "akmanshuk05@gmail.com", "000006", None, "6-12"],
    ["Ms. Aknur", "hikkarin@bk.ru", "000007", None, "12+"],
    ["Mr. Vladimir", "vladimir.von.aladin@gmail.com", "000008", None, "12+"],
    ["Ms. Zhuldyz Algaliyeva", "sfire746@gmail.com", "000009", None, "12+"],
    ["Mr. Salman Aliyev", "salmanaliyev20@gmail.com", "000010", None, "12+"],
    ["Ms. Yerkezhan Aman", "erkeea7894@gmail.com", "000011", None, "12+"],
    ["Mr. Askar Amanbay", "amanbay2004@inbox.ru", "000012", None, "12+"],
    ["Ms. Amina Meirambek", "aminalee0903@gmail.com", "000013", None, "12+"],
    ["Ms. Adema Askar", "ademask57@gmail.com", "000014", None, "6-12"],
    ["Shugyla", "shyla.lmbek@mail.ru", "000015", None, "12+"],
    ["Ms. Zere Baizhan", "bayzhanzere@gmail.com", "000016", None, "6-12"],
    ["Temirlan Baimerden", "tbaimerden@gmail.com", "000017", None, "12+"],
    ["Ms. Sayana Zhanatovna", "soni_bai@mail.ru", "000018", None, "12+"],
    ["Ms. Yuliya Bachurina", "solnishko77787@mail.ru", "000019", None, "12+"],
    ["Ms. Alena Biterman", "akimova.alena.97@bk.ru", "000020", None, "12+"],
    ["Ms. Botagoz Tulegenova", "botaJSIkz2025@mail.ru", "000021", None, "12+"],
    ["Ms. Regina Gofman", "gof-rigaa@mail.ru", "000022", None, "6-12"],
    ["Ms. Rano Galym", "rano151198@gmail.com", "000023", None, "12+"],
    ["Ms. Zhannur Daribayeva", "zhannurdaribayevaa@gmail.com", "000024", None, "6-12"],
    ["Ms. Aziza", "minseoshin981@gmail.com", "000025", None, "6-12"],
    ["Ms Yesimzhanova Diana", "Seotanann@gmail.com", "000026", None, "12+"],
    ["Ms. Sabina Esmagulova", "siesmaghulova@gmail.com", "000027", None, "12+"],
    ["Mr. Samat Zharmagambetov", "asofpc@gmail.com", "000028", None, "12+"],
    ["Ms. Samal Zhorabekova", "samal.zh@jsi.kz", "000029", None, "12+"],
    ["Ms. Arailym Zaydullaeva", "1zaidullaevaaa1@gmail.com", "000030", None, "6-12"],
    ["Ms. Milana Zaitseva", "milanazajceva27@gmail.com", "000031", None, "12+"],
    ["Ms. Makhabbat Ibraeva", "makhabbat_ibraeva86@mail.ru", "000032", None, "6-12"],
    ["Ms. Kamila Iskhanova", "kamila.iskhanova@gmail.com", "000033", None, "12+"],
    ["Ms. Aiymzhan", "kairdenovaaiymzhan@gmail.com", "000034", None, "6-12"],
    ["Ms. Zhanelya Kakimbekova", "kakimbekovazhanelya@gmail.com", "000035", None, "12+"],
    ["Aigerim Kaskyrbaeva", "aigerim.kaskyrbaeva@jsi.kz", "000036", None, "12+"],
    ["Ms. Dariya Kaupova", "daryakaupova@gmail.com", "000037", None, "12+"],
    ["Ms. Aigul Karimbek", "aigulkar8@gmail.com", "000038", None, "12+"],
    ["Alina Kozhakenova", "a_kozhakonova@kbtu.kz", "000039", None, "6-12"],
    ["Ms Aliya Kopbasova", "aliyakopbasova@gmail.com", "000040", None, "6-12"],
    ["Ms. Maria Kotsar", "mkotsar@mail.ru", "000041", None, "12+"],
    ["Ms. Kamila Khodzhabergenova", "kamila.khojabergenova@gmail.com", "000042", None, "12+"],
    ["Ms. Kumbrova Milana", "Kumbrova.milana04@gmail.com", "000043", None, "12+"],
    ["Ms. Alua Kusekenova", "alua.kusekenova01@gmail.com", "000044", None, "12+"],
    ["Ms. Zhanerke Kairatova", "maknagito@gmail.com", "000045", None, "12+"],
    ["Ms. Ayagoz Kaiyrbekkyzy", "ayagoz.kayyrbekkyzy03@gmail.com", "000046", None, "12+"],
    ["Ms. Raushan Qanapash", "rauwan200560@gmail.com", "000047", None, "12+"],
    ["Ms. Amina Kinayat", "aminakinayat021@gmail.com", "000048", None, "6-12"],
    ["Mr. Ivan Landin", "ivanlandin1998@yandex.ru", "000049", None, "12+"],
    ["Mr. Alen", "sokold419@gmail.com", "000050", None, "12+"],
    ["Ms. Maximova Meruyert", "maximovameruert@gmail.com", "000051", None, "12+"],
    ["Mr. Alibek (kaz)", "Alibek_17_95@mail.ru", "000052", None, "12+"],
    ["Ms. Zhanel Maratzhan", "zhanelmarat1234@gmail.com", "000053", None, "12+"],
    ["Ms. Annush Martirosyan", "armyanka.28@mail.ru", "000054", None, "12+"],
    ["Minnu Mathew", "minnu54556@gmail.com", "000055", None, "12+"],
    ["Ms. Akbota Mussabek", "akbotamussabek@gmail.com", "000056", None, "12+"],
    ["Ms. Dilnaz Narynbekova", "dilnaznarynbekova@gmail.com", "000057", None, "12+"],
    ["Ms. Maftuna Nigmatullayeva", "nigmatullaevamaftuna013@gmail.com", "000058", None, "12+"],
    ["Ms. Akbota Nurlybekova", "prostobota@yandex.com", "000059", None, "12+"],
    ["Ms. Aruana Nurmanova", "nurmanovaaruana1@gmail.com", "000060", None, "12+"],
    ["Ms. Laura Nurlan", "laura01605@gmail.com", "000061", None, "12+"],
    ["Ms. Nagima Ramazanova", "nagima9490@mail.ru", "000062", None, "12+"],
    ["Ms. Sabina Rassulova", "rassulovas21@gmail.com", "000063", None, "12+"],
    ["Ayazhan", "ayazhanrakhmanova@gmail.com", "000064", None, "12+"],
    ["Ms. Makpal Rakhmatulla", "makpalrakhmatulla7@gmail.com", "000065", None, "12+"],
    ["asel R", "hazelplutonium@gmail.com", "000066", None, "12+"],
    ["Ms. Gaukhar Rakhymzhanova", "gauharrahim00@gmail.com", "000067", None, "12+"],
    ["Ms. Amina Sadanova", "aminasadanova71@gmail.com", "000068", None, "12+"],
    ["Ms. Zhuldyz Saduova", "zhuldyzsaduova509@gmail.com", "000069", None, "12+"],
    ["Ms. Saida", "saidasaida@gmail.com", "000070", None, "12+"],
    ["Ms. Aruzhan Seidaliyeva", "seidalievaaruzhan.88@gmail.com", "000071", None, "12+"],
    ["Mr. Yernar Sembekov", "sembekovrn@gmail.com", "000072", None, "12+"],
    ["Mr. Alikhan Sergaliyev", "alikha5nserga7liev@gmail.com", "000073", None, "12+"],
    ["Dinmuhammed Sibgatullin", "dis@internativa.biz", "000074", None, "12+"],
    ["Ms. Shugyla Tasmurat", "shugylatasmurat01@gmail.com", "000075", None, "12+"],
    ["Ms. Aruzhan Temirbekova", "aruzhan.bisengali2@gmail.com", "000076", None, "12+"],
    ["Ms. Kamila Tleuzhanova", "kamila.t2105@gmail.com", "000077", None, "12+"],
    ["Mr. Andrew Tulin", "andrey.tulin.00@gmail.com", "000078", None, "12+"],
    ["Adelya Turganbek", "adelyaturganbek89@gmail.com", "000079", None, "6-12"],
    ["Ms. Karakat", "karakattursyn19@gmail.com", "000080", None, "12+"],
    ["Ms. Alina Ualiyeva", "klassblin@gmail.com", "000081", None, "12+"],
    ["Ms. Dilfuza Khamidullayeva", "dilfuza040319@gmail.com", "000082", None, "6-12"],
    ["Ms. Veronika", "n.tsoy97@gmail.com", "000083", None, "12+"],
    ["Ms. Oksana Shainian", "oksanashainian@gmail.com", "000084", None, "12+"],
    ["Mr. Igor Shafarevich", "i.a.shafarevich@mail.com", "000085", None, "12+"],
    ["Ms. Yelizaveta Shnaider", "liz.shnaider@gmail.com", "000086", None, "12+"],
    ["Mr. Nurdaulet Ybraikozha", "nurdash04@gmail.com", "000087", None, "12+"],
    ["Ms. Dildora Yusupova", "dildora2732yus@gmail.com", "000088", None, "12+"],
]


async def import_teachers():
    """Import all teachers from the list."""
    async with async_session_maker() as db:
        levels_result = await db.execute(select(Level))
        levels = {level.name: level for level in levels_result.scalars().all()}
        print(f"Available levels: {list(levels.keys())}")

        users_result = await db.execute(select(User))
        existing_emails = {user.email.lower() for user in users_result.scalars().all()}
        print(f"Existing users before import: {len(existing_emails)}\n")

        created_count = 0
        skipped_count = 0

        for row in TEACHERS:
            name, email, password, _, level_name = row

            if email.lower() in existing_emails:
                skipped_count += 1
                continue

            # Map level name to level_id
            level_id = None
            if level_name == "12+":
                for level_obj in levels.values():
                    if "12+" in level_obj.name:
                        level_id = level_obj.id
                        break
            elif level_name == "6-12":
                for level_obj in levels.values():
                    if "6-12" in level_obj.name:
                        level_id = level_obj.id
                        break
            elif level_name == "1-6":
                for level_obj in levels.values():
                    if "1-6" in level_obj.name:
                        level_id = level_obj.id
                        break

            new_user = User(
                name=name,
                email=email.lower(),
                password_hash=get_password_hash(password or "teacher123"),
                role=UserRole.TEACHER,
                level_id=level_id,
                balance="0",
                is_active=True,
            )
            db.add(new_user)
            created_count += 1

        await db.commit()
        print(f"\n=== Import Summary ===")
        print(f"Created: {created_count} new teachers")
        print(f"Skipped (already exists): {skipped_count}")
        print(f"Total in file: {len(TEACHERS)}")


if __name__ == "__main__":
    asyncio.run(import_teachers())
