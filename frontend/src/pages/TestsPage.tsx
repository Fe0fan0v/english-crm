import { useEffect, useState } from "react";
import { testsApi } from "../services/api";
import type { Test, TestListResponse } from "../types";

interface TestFormData {
  title: string;
}

export default function TestsPage() {
  const [data, setData] = useState<TestListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchTests = async () => {
    setIsLoading(true);
    try {
      const response = await testsApi.list(search || undefined);
      setData(response);
    } catch (error) {
      console.error("Failed to fetch tests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [search]);

  const handleCreate = async (formData: TestFormData) => {
    await testsApi.create(formData);
    await fetchTests();
  };

  const handleUpdate = async (formData: TestFormData) => {
    if (!editingTest) return;
    await testsApi.update(editingTest.id, formData);
    await fetchTests();
  };

  const handleDelete = async (id: number) => {
    await testsApi.delete(id);
    setDeleteConfirm(null);
    await fetchTests();
  };

  const openCreateModal = () => {
    setEditingTest(null);
    setIsModalOpen(true);
  };

  const openEditModal = (test: Test) => {
    setEditingTest(test);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTest(null);
  };

  return (
    <div>
      <h1 className="page-title">Тесты</h1>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
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
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-12"
          />
        </div>
      </div>

      {/* Create button */}
      <div className="card mb-6 flex justify-center">
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 text-cyan-500 font-medium hover:text-cyan-600 transition-colors py-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Добавить тест
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-6 font-medium text-gray-600">
                  Название
                </th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">
                  Дата создания
                </th>
                <th className="text-right py-4 px-6 font-medium text-gray-600">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((test) => (
                <tr
                  key={test.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {test.title}
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    {new Date(test.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(test)}
                        className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"
                        title="Редактировать"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {deleteConfirm === test.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(test.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(test.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Удалить"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500">
                    Тесты не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <p className="text-gray-500 text-sm mt-4">Всего тестов: {data.total}</p>
      )}

      {/* Modal */}
      <TestModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingTest ? handleUpdate : handleCreate}
        test={editingTest}
      />
    </div>
  );
}

// Modal Component
interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TestFormData) => Promise<void>;
  test?: Test | null;
}

function TestModal({ isOpen, onClose, onSubmit, test }: TestModalProps) {
  const [formData, setFormData] = useState<TestFormData>({ title: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof TestFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!test;

  useEffect(() => {
    if (test) {
      setFormData({ title: test.title });
    } else {
      setFormData({ title: "" });
    }
    setErrors({});
  }, [test, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TestFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Введите название";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      await onSubmit(formData);
      setFormData({ title: "" });
      setErrors({});
      onClose();
    } catch (error) {
      console.error("Failed to save test:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof TestFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? "Редактировать тест" : "Добавить тест"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`input w-full ${errors.title ? "border-red-500" : ""}`}
              placeholder="Название теста"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn btn-secondary"
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary"
              disabled={isLoading}
            >
              {isLoading
                ? "Сохранение..."
                : isEditing
                  ? "Сохранить"
                  : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
