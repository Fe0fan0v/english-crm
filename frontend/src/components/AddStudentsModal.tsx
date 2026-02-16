import { useState, useEffect } from "react";
import { usersApi } from "../services/api";
import type { User } from "../types";
import Avatar from "./Avatar";

interface AddStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentIds: number[]) => Promise<void>;
  existingStudentIds: number[];
}

export default function AddStudentsModal({
  isOpen,
  onClose,
  onSubmit,
  existingStudentIds,
}: AddStudentsModalProps) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list(1, 10000, search || undefined, "student");
      // Filter only students who are not already in the group
      const availableStudents = response.items.filter(
        (user) => user.role === "student" && !existingStudentIds.includes(user.id)
      );
      setStudents(availableStudents);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
      setSelectedIds([]);
    }
  }, [isOpen, search, existingStudentIds]);

  const handleToggleStudent = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedIds);
      setSelectedIds([]);
      setSearch("");
    } catch (error) {
      console.error("Failed to add students:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">
            Добавить учеников
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
              placeholder="Поиск учеников"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-12 w-full"
            />
          </div>
        </div>

        {/* Select all */}
        {students.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={handleSelectAll}
              className="text-sm text-cyan-500 hover:text-cyan-600"
            >
              {selectedIds.length === students.length ? "Снять выделение" : "Выбрать всех"}
            </button>
            <span className="text-sm text-gray-500">
              Выбрано: {selectedIds.length}
            </span>
          </div>
        )}

        {/* Students list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search ? "Ученики не найдены" : "Все ученики уже в группе"}
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(student.id)}
                    onChange={() => handleToggleStudent(student.id)}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                  />
                  <Avatar name={student.name} photo={student.photo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{student.name}</p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                  <span className="text-sm text-gray-500">{student.balance} тг</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn btn-secondary"
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 btn btn-primary"
            disabled={selectedIds.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Добавление..." : `Добавить (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
