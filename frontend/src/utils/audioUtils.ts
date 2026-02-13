// Cache for dictionary API audio URLs
const audioCache = new Map<string, string | null>();

// Cache for transcriptions
const transcriptionCache = new Map<string, string | null>();

export async function fetchDictionaryAudio(
  word: string,
): Promise<string | null> {
  if (audioCache.has(word)) return audioCache.get(word)!;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) {
      audioCache.set(word, null);
      return null;
    }
    const data = await res.json();
    const phonetics = data[0]?.phonetics as { audio?: string }[] | undefined;
    const audioUrl =
      phonetics?.find((p) => p.audio && p.audio.includes("us"))?.audio ||
      phonetics?.find((p) => p.audio)?.audio ||
      null;
    audioCache.set(word, audioUrl);
    return audioUrl;
  } catch {
    audioCache.set(word, null);
    return null;
  }
}

export function getEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.name.includes("Google US English")) ||
    voices.find(
      (v) => v.name.includes("Google") && v.lang.startsWith("en"),
    ) ||
    voices.find(
      (v) => v.name.includes("Microsoft") && v.lang.startsWith("en-US"),
    ) ||
    voices.find((v) => v.lang.startsWith("en-US")) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}

export function speakWithSpeechAPI(text: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    const voice = getEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/**
 * Pronounce a single English word: tries dictionary audio first, falls back to Speech API.
 */
export async function pronounceWord(word: string): Promise<void> {
  window.speechSynthesis.cancel();
  const audioUrl = await fetchDictionaryAudio(word);
  if (audioUrl) {
    await playAudioUrl(audioUrl);
  } else {
    await speakWithSpeechAPI(word);
  }
}

/**
 * Fetch IPA transcription from the free dictionary API.
 */
export async function fetchTranscription(
  word: string,
): Promise<string | null> {
  if (transcriptionCache.has(word)) return transcriptionCache.get(word)!;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) {
      transcriptionCache.set(word, null);
      return null;
    }
    const data = await res.json();
    const phonetic: string | undefined =
      data[0]?.phonetic ||
      data[0]?.phonetics?.find((p: { text?: string }) => p.text)?.text;
    const result = phonetic || null;
    transcriptionCache.set(word, result);
    return result;
  } catch {
    transcriptionCache.set(word, null);
    return null;
  }
}
