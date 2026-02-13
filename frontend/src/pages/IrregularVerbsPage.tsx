import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { irregularVerbs } from "../data/irregularVerbs";
import {
  fetchDictionaryAudio,
  playAudioUrl,
  speakWithSpeechAPI,
} from "../utils/audioUtils";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function IrregularVerbsPage() {
  const [search, setSearch] = useState("");
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const abortRef = useRef(false);

  // Preload voices (Chrome loads them async)
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return irregularVerbs;
    const q = search.trim().toLowerCase();
    return irregularVerbs.filter(
      (v) =>
        v.v1.toLowerCase().includes(q) ||
        v.v2.toLowerCase().includes(q) ||
        v.v3.toLowerCase().includes(q) ||
        v.translation.toLowerCase().includes(q)
    );
  }, [search]);

  const speakAllForms = useCallback(
    async (v1: string, v2: string, v3: string, index: number) => {
      window.speechSynthesis.cancel();
      abortRef.current = true;
      await delay(50);
      abortRef.current = false;

      setSpeakingIndex(index);
      try {
        // V1: try dictionary audio, fallback to Speech API
        const v1Audio = await fetchDictionaryAudio(v1);
        if (abortRef.current) return;
        if (v1Audio) {
          await playAudioUrl(v1Audio);
        } else {
          await speakWithSpeechAPI(v1);
        }
        if (abortRef.current) return;

        await delay(400);
        if (abortRef.current) return;

        // V2: try dictionary audio, fallback to Speech API
        const v2First = v2.split("/")[0].trim();
        const v2Audio = await fetchDictionaryAudio(v2First);
        if (abortRef.current) return;
        if (v2Audio) {
          await playAudioUrl(v2Audio);
        } else {
          await speakWithSpeechAPI(v2First);
        }
        if (abortRef.current) return;

        await delay(400);
        if (abortRef.current) return;

        // V3: try dictionary audio, fallback to Speech API
        const v3First = v3.split("/")[0].trim();
        const v3Audio = await fetchDictionaryAudio(v3First);
        if (abortRef.current) return;
        if (v3Audio) {
          await playAudioUrl(v3Audio);
        } else {
          await speakWithSpeechAPI(v3First);
        }
      } finally {
        if (!abortRef.current) setSpeakingIndex(null);
      }
    },
    []
  );

  const speakerIcon = (size: string) => (
    <svg
      className={size}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );

  const speakerBtnClass = (idx: number) =>
    `p-2 rounded-full transition-colors ${
      speakingIndex === idx
        ? "bg-cyan-100 text-cyan-600"
        : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
    }`;

  return (
    <div>
      <h1 className="page-title">Неправильные глаголы</h1>

      {/* Search */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Поиск по глаголу или переводу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {filtered.length === irregularVerbs.length
              ? `Всего: ${irregularVerbs.length}`
              : `Найдено: ${filtered.length} из ${irregularVerbs.length}`}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Infinitive (V1)
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Past Simple (V2)
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Past Participle (V3)
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Перевод
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Транскрипция
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((verb, index) => (
                <tr
                  key={verb.v1}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {verb.v1}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{verb.v2}</td>
                  <td className="px-4 py-3 text-gray-700">{verb.v3}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {verb.translation}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-sm">
                    {verb.transcription}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        speakAllForms(verb.v1, verb.v2, verb.v3, index)
                      }
                      title="Прослушать произношение"
                      className={speakerBtnClass(index)}
                    >
                      {speakerIcon("w-5 h-5")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((verb, index) => (
          <div key={verb.v1} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-lg">
                    {verb.v1}
                  </span>
                  <span className="text-gray-400 font-mono text-sm">
                    {verb.transcription}
                  </span>
                </div>
                <div className="text-gray-600 mb-2">{verb.translation}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-gray-400">V2: </span>
                    <span className="text-gray-700 font-medium">{verb.v2}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">V3: </span>
                    <span className="text-gray-700 font-medium">{verb.v3}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  speakAllForms(verb.v1, verb.v2, verb.v3, index)
                }
                title="Прослушать произношение"
                className={`${speakerBtnClass(index)} flex-shrink-0 ml-2`}
              >
                {speakerIcon("w-6 h-6")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="card text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-500">Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
