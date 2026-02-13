import { useState, useEffect, useCallback, useRef } from "react";
import type { VocabularyWord, VocabularyWordCreate } from "../types";
import { pronounceWord, fetchTranscription } from "../utils/audioUtils";

interface VocabularyListProps {
  words: VocabularyWord[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (data: VocabularyWordCreate) => Promise<void>;
  onUpdate: (wordId: number, data: Partial<VocabularyWordCreate>) => Promise<void>;
  onDelete: (wordId: number) => Promise<void>;
  showAddedBy?: boolean;
}

interface WordFormData {
  english: string;
  translation: string;
  transcription: string;
  example: string;
}

const emptyForm: WordFormData = {
  english: "",
  translation: "",
  transcription: "",
  example: "",
};

export default function VocabularyList({
  words,
  isLoading,
  search,
  onSearchChange,
  onAdd,
  onUpdate,
  onDelete,
  showAddedBy = false,
}: VocabularyListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [form, setForm] = useState<WordFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [fetchingTranscription, setFetchingTranscription] = useState(false);
  const abortRef = useRef(false);

  // Preload voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }, []);

  const openAdd = () => {
    setEditingWord(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (word: VocabularyWord) => {
    setEditingWord(word);
    setForm({
      english: word.english,
      translation: word.translation,
      transcription: word.transcription || "",
      example: word.example || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWord(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.english.trim() || !form.translation.trim()) return;
    setSaving(true);
    try {
      const data: VocabularyWordCreate = {
        english: form.english.trim(),
        translation: form.translation.trim(),
        transcription: form.transcription.trim() || null,
        example: form.example.trim() || null,
      };
      if (editingWord) {
        await onUpdate(editingWord.id, data);
      } else {
        await onAdd(data);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (wordId: number) => {
    setDeletingId(wordId);
    try {
      await onDelete(wordId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSpeak = useCallback(async (word: string, id: number) => {
    window.speechSynthesis.cancel();
    abortRef.current = true;
    await new Promise((r) => setTimeout(r, 50));
    abortRef.current = false;
    setSpeakingId(id);
    try {
      await pronounceWord(word);
    } finally {
      if (!abortRef.current) setSpeakingId(null);
    }
  }, []);

  const handleAutoTranscription = async () => {
    if (!form.english.trim()) return;
    setFetchingTranscription(true);
    try {
      const t = await fetchTranscription(form.english.trim());
      if (t) {
        setForm((f) => ({ ...f, transcription: t }));
      }
    } finally {
      setFetchingTranscription(false);
    }
  };

  const speakerIcon = (size: string) => (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );

  return (
    <>
      {/* Search and Add */}
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
              placeholder="Поиск по слову или переводу..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {words.length} {words.length === 1 ? "слово" : words.length < 5 ? "слова" : "слов"}
            </span>
            <button onClick={openAdd} className="btn btn-primary whitespace-nowrap">
              + Добавить
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card text-center py-12">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Загрузка...
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && words.length === 0 && (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-gray-500">
            {search ? "Ничего не найдено" : "Словарь пуст. Добавьте первое слово!"}
          </p>
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && words.length > 0 && (
        <div className="hidden md:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Слово
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Перевод
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Транскрипция
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Пример
                  </th>
                  {showAddedBy && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Добавил
                    </th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {words.map((word) => (
                  <tr key={word.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {word.english}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{word.translation}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-sm">
                      {word.transcription || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                      {word.example || "—"}
                    </td>
                    {showAddedBy && (
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {word.added_by_name || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSpeak(word.english, word.id)}
                          title="Произнести"
                          className={`p-2 rounded-full transition-colors ${
                            speakingId === word.id
                              ? "bg-cyan-100 text-cyan-600"
                              : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          {speakerIcon("w-4 h-4")}
                        </button>
                        <button
                          onClick={() => openEdit(word)}
                          title="Редактировать"
                          className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(word.id)}
                          disabled={deletingId === word.id}
                          title="Удалить"
                          className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      {!isLoading && words.length > 0 && (
        <div className="md:hidden space-y-3">
          {words.map((word) => (
            <div key={word.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-lg">
                      {word.english}
                    </span>
                    {word.transcription && (
                      <span className="text-gray-400 font-mono text-sm">
                        {word.transcription}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 mb-1">{word.translation}</div>
                  {word.example && (
                    <div className="text-gray-400 text-sm italic">{word.example}</div>
                  )}
                  {showAddedBy && word.added_by_name && (
                    <div className="text-gray-400 text-xs mt-1">
                      Добавил: {word.added_by_name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleSpeak(word.english, word.id)}
                    title="Произнести"
                    className={`p-2 rounded-full transition-colors ${
                      speakingId === word.id
                        ? "bg-cyan-100 text-cyan-600"
                        : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {speakerIcon("w-5 h-5")}
                  </button>
                  <button
                    onClick={() => openEdit(word)}
                    title="Редактировать"
                    className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(word.id)}
                    disabled={deletingId === word.id}
                    title="Удалить"
                    className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editingWord ? "Редактировать слово" : "Добавить слово"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Английское слово *
                </label>
                <input
                  type="text"
                  value={form.english}
                  onChange={(e) => setForm((f) => ({ ...f, english: e.target.value }))}
                  className="input w-full"
                  placeholder="hello"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Перевод *
                </label>
                <input
                  type="text"
                  value={form.translation}
                  onChange={(e) => setForm((f) => ({ ...f, translation: e.target.value }))}
                  className="input w-full"
                  placeholder="привет"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Транскрипция
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.transcription}
                    onChange={(e) => setForm((f) => ({ ...f, transcription: e.target.value }))}
                    className="input flex-1"
                    placeholder="/həˈloʊ/"
                  />
                  <button
                    type="button"
                    onClick={handleAutoTranscription}
                    disabled={!form.english.trim() || fetchingTranscription}
                    className="btn btn-secondary text-sm px-3 whitespace-nowrap disabled:opacity-50"
                    title="Получить транскрипцию автоматически"
                  >
                    {fetchingTranscription ? "..." : "Авто"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пример использования
                </label>
                <textarea
                  value={form.example}
                  onChange={(e) => setForm((f) => ({ ...f, example: e.target.value }))}
                  className="input w-full"
                  rows={2}
                  placeholder="Hello, how are you?"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="btn btn-secondary">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!form.english.trim() || !form.translation.trim() || saving}
                className="btn btn-primary disabled:opacity-50"
              >
                {saving ? "Сохранение..." : editingWord ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
