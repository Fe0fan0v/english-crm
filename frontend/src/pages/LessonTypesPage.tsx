import { useEffect, useState } from "react";
import { lessonTypesApi } from "../services/api";
import type { LessonType, LessonTypeListResponse } from "../types";
import LessonTypeModal, { type LessonTypeFormData } from "../components/LessonTypeModal";

export default function LessonTypesPage() {
  const [data, setData] = useState<LessonTypeListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<LessonType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchLessonTypes = async () => {
    setIsLoading(true);
    try {
      const response = await lessonTypesApi.list(search || undefined);
      setData(response);
    } catch (error) {
      console.error("Failed to fetch lesson types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLessonTypes();
  }, [search]);

  const handleCreate = async (formData: LessonTypeFormData) => {
    await lessonTypesApi.create(formData);
    await fetchLessonTypes();
  };

  const handleUpdate = async (formData: LessonTypeFormData) => {
    if (!editingType) return;
    await lessonTypesApi.update(editingType.id, formData);
    await fetchLessonTypes();
  };

  const handleDelete = async (id: number) => {
    try {
      await lessonTypesApi.delete(id);
      setDeleteConfirm(null);
      await fetchLessonTypes();
    } catch (error) {
      setDeleteConfirm(null);
      const errorMessage =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Не удалось удалить тип занятия";
      alert(errorMessage);
    }
  };

  const openCreateModal = () => {
    setEditingType(null);
    setIsModalOpen(true);
  };

  const openEditModal = (lessonType: LessonType) => {
    setEditingType(lessonType);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Типы занятий</h1>

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
          Добавить занятие
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
                  Стоимость
                </th>
                <th className="text-right py-4 px-6 font-medium text-gray-600">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((lessonType) => (
                <tr
                  key={lessonType.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {lessonType.name}
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    {parseFloat(lessonType.price).toLocaleString("ru-RU")} тг
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(lessonType)}
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
                      {deleteConfirm === lessonType.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(lessonType.id)}
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
                          onClick={() => setDeleteConfirm(lessonType.id)}
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
                    Типы занятий не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Total count */}
      {data && data.total > 0 && (
        <p className="text-gray-500 text-sm mt-4">
          Всего типов занятий: {data.total}
        </p>
      )}

      {/* Modal */}
      <LessonTypeModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingType ? handleUpdate : handleCreate}
        lessonType={editingType}
      />
    </div>
  );
}
