import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { levelsApi } from "../services/api";
import type { Level, LevelListResponse } from "../types";

interface LevelFormData {
  name: string;
  teacher_percentage: number;
}

export default function LevelsPage() {
  const [data, setData] = useState<LevelListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchLevels = async () => {
    setIsLoading(true);
    try {
      const response = await levelsApi.list(search || undefined);
      setData(response);
    } catch (error) {
      console.error("Failed to fetch levels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, [search]);

  const handleCreate = async (formData: LevelFormData) => {
    await levelsApi.create(formData);
    await fetchLevels();
  };

  const handleUpdate = async (formData: LevelFormData) => {
    if (!editingLevel) return;
    await levelsApi.update(editingLevel.id, formData);
    await fetchLevels();
  };

  const handleDelete = async (id: number) => {
    await levelsApi.delete(id);
    setDeleteConfirm(null);
    await fetchLevels();
  };

  const openCreateModal = () => {
    setEditingLevel(null);
    setIsModalOpen(true);
  };

  const openEditModal = (level: Level) => {
    setEditingLevel(level);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLevel(null);
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Уровни</h1>

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
          Добавить уровень
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
                  Название уровня
                </th>
                <th className="text-right py-4 px-6 font-medium text-gray-600">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((level) => (
                <tr
                  key={level.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {level.name}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/levels/${level.id}`)}
                        className="btn btn-primary text-sm"
                        title="Настроить оплаты"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Настроить оплаты
                      </button>
                      <button
                        onClick={() => openEditModal(level)}
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
                      {deleteConfirm === level.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(level.id)}
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
                          onClick={() => setDeleteConfirm(level.id)}
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
                  <td colSpan={2} className="py-12 text-center text-gray-500">
                    Уровни не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Total count */}
      {data && data.total > 0 && (
        <p className="text-gray-500 text-sm mt-4">Всего уровней: {data.total}</p>
      )}

      {/* Modal */}
      <LevelModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingLevel ? handleUpdate : handleCreate}
        level={editingLevel}
      />
    </div>
  );
}

// Modal Component
interface LevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LevelFormData) => Promise<void>;
  level?: Level | null;
}

function LevelModal({ isOpen, onClose, onSubmit, level }: LevelModalProps) {
  const [formData, setFormData] = useState<LevelFormData>({
    name: "",
    teacher_percentage: 0,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LevelFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!level;

  useEffect(() => {
    if (level) {
      setFormData({
        name: level.name,
        teacher_percentage: parseFloat(level.teacher_percentage),
      });
    } else {
      setFormData({ name: "", teacher_percentage: 0 });
    }
    setErrors({});
  }, [level, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LevelFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите название";
    }

    if (formData.teacher_percentage < 0 || formData.teacher_percentage > 100) {
      newErrors.teacher_percentage = "Процент должен быть от 0 до 100";
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
      setFormData({ name: "", teacher_percentage: 0 });
      setErrors({});
      onClose();
    } catch (error) {
      console.error("Failed to save level:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
    if (errors[name as keyof LevelFormData]) {
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
            {isEditing ? "Редактировать уровень" : "Добавить уровень"}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input w-full ${errors.name ? "border-red-500" : ""}`}
              placeholder="Например: 1-6 месяцев"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % преподавателю *
            </label>
            <input
              type="number"
              name="teacher_percentage"
              value={formData.teacher_percentage}
              onChange={handleChange}
              className={`input w-full ${errors.teacher_percentage ? "border-red-500" : ""}`}
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
            />
            {errors.teacher_percentage && (
              <p className="text-red-500 text-sm mt-1">{errors.teacher_percentage}</p>
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
                : "Добавить уровень"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
