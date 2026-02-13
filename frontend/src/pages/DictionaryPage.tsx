import { useState, useEffect, useCallback } from "react";
import { vocabularyApi } from "../services/api";
import type { VocabularyWord, VocabularyWordCreate } from "../types";
import VocabularyList from "../components/VocabularyList";

export default function DictionaryPage() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadWords = useCallback(async (searchQuery?: string) => {
    setIsLoading(true);
    try {
      const data = await vocabularyApi.getMyWords(searchQuery || undefined);
      setWords(data.items);
    } catch (error) {
      console.error("Failed to load vocabulary:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadWords(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, loadWords]);

  const handleAdd = async (data: VocabularyWordCreate) => {
    await vocabularyApi.addMyWord(data);
    await loadWords(search);
  };

  const handleUpdate = async (wordId: number, data: Partial<VocabularyWordCreate>) => {
    await vocabularyApi.updateMyWord(wordId, data);
    await loadWords(search);
  };

  const handleDelete = async (wordId: number) => {
    await vocabularyApi.deleteMyWord(wordId);
    await loadWords(search);
  };

  return (
    <div>
      <h1 className="page-title">Мой словарь</h1>
      <VocabularyList
        words={words}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        showAddedBy
      />
    </div>
  );
}
