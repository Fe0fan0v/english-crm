import os

import httpx

YANDEX_DICT_API_KEY = os.getenv("YANDEX_DICT_API_KEY", "")


async def translate_word(word: str, lang: str = "en-ru") -> dict | None:
    """Translate a word using Yandex Dictionary API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://dictionary.yandex.net/api/v1/dicservice.json/lookup",
                params={"key": YANDEX_DICT_API_KEY, "lang": lang, "text": word},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            defs = data.get("def", [])
            if not defs:
                return None
            results = []
            for d in defs:
                pos = d.get("pos", "")
                ts = d.get("ts", "")
                translations = [tr.get("text", "") for tr in d.get("tr", [])[:3]]
                if translations:
                    results.append({"pos": pos, "ts": ts, "tr": translations})
            if not results:
                return None
            return {
                "word": word,
                "ts": results[0].get("ts", ""),
                "definitions": results,
            }
    except Exception:
        return None


async def lookup_word(word: str) -> dict | None:
    """Look up a word in the Free Dictionary API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data or not isinstance(data, list):
                return None
            entry = data[0]
            phonetic = entry.get("phonetic", "")
            if not phonetic:
                # Try phonetics array
                for p in entry.get("phonetics", []):
                    if p.get("text"):
                        phonetic = p["text"]
                        break
            # Get first definition
            definition = ""
            for meaning in entry.get("meanings", []):
                for defn in meaning.get("definitions", []):
                    if defn.get("definition"):
                        definition = defn["definition"]
                        break
                if definition:
                    break
            return {"phonetic": phonetic, "definition": definition}
    except Exception:
        return None
