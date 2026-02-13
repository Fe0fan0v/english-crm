import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { vocabularyApi, teacherApi } from "../services/api";
import type { VocabularyWord, VocabularyWordCreate, TeacherStudentInfo } from "../types";
import VocabularyList from "../components/VocabularyList";

export default function TeacherStudentVocabularyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<TeacherStudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load students
  useEffect(() => {
    const load = async () => {
      setStudentsLoading(true);
      try {
        const data = await teacherApi.getStudents();
        setStudents(data);
        // Check query param
        const studentParam = searchParams.get("student");
        if (studentParam) {
          const id = parseInt(studentParam, 10);
          if (data.some((s) => s.id === id)) {
            setSelectedStudentId(id);
          }
        }
      } catch (error) {
        console.error("Failed to load students:", error);
      } finally {
        setStudentsLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWords = useCallback(
    async (studentId: number, searchQuery?: string) => {
      setIsLoading(true);
      try {
        const data = await vocabularyApi.getStudentWords(studentId, searchQuery || undefined);
        setWords(data.items);
      } catch (error) {
        console.error("Failed to load vocabulary:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedStudentId) {
      setWords([]);
      return;
    }
    const timeout = setTimeout(() => {
      loadWords(selectedStudentId, search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [selectedStudentId, search, loadWords]);

  const handleSelectStudent = (id: number) => {
    setSelectedStudentId(id);
    setSearch("");
    setSearchParams({ student: String(id) });
  };

  const handleAdd = async (data: VocabularyWordCreate) => {
    if (!selectedStudentId) return;
    await vocabularyApi.addStudentWord(selectedStudentId, data);
    await loadWords(selectedStudentId, search);
  };

  const handleUpdate = async (wordId: number, data: Partial<VocabularyWordCreate>) => {
    if (!selectedStudentId) return;
    await vocabularyApi.updateStudentWord(selectedStudentId, wordId, data);
    await loadWords(selectedStudentId, search);
  };

  const handleDelete = async (wordId: number) => {
    if (!selectedStudentId) return;
    await vocabularyApi.deleteStudentWord(selectedStudentId, wordId);
    await loadWords(selectedStudentId, search);
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div>
      <h1 className="page-title">Словарь учеников</h1>

      {/* Student selector */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Выберите ученика
        </label>
        {studentsLoading ? (
          <div className="text-gray-500 text-sm">Загрузка учеников...</div>
        ) : students.length === 0 ? (
          <div className="text-gray-500 text-sm">У вас нет назначенных учеников</div>
        ) : (
          <select
            value={selectedStudentId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) handleSelectStudent(Number(val));
            }}
            className="input w-full max-w-md"
          >
            <option value="">— Выберите ученика —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Vocabulary list */}
      {selectedStudentId && selectedStudent && (
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
      )}

      {/* Prompt to select student */}
      {!selectedStudentId && !studentsLoading && students.length > 0 && (
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="text-gray-500">Выберите ученика, чтобы открыть его словарь</p>
        </div>
      )}
    </div>
  );
}
