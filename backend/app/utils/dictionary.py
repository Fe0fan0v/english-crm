import httpx


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
