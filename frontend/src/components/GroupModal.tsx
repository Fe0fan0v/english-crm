import { useState, useEffect } from "react";
import type { Group, User } from "../types";

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GroupFormData) => Promise<void>;
  teachers: User[];
  group?: Group;
}

export interface GroupFormData {
  name: string;
  description?: string;
  teacher_id?: number;
}

export default function GroupModal({
  isOpen,
  onClose,
  onSubmit,
  teachers,
  group,
}: GroupModalProps) {
  const [formData, setFormData] = useState<GroupFormData>({
    name: "",
    description: "",
    teacher_id: undefined,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || "",
        teacher_id: group.teacher_id || undefined,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        teacher_id: undefined,
      });
    }
    setErrors({});
  }, [group, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof GroupFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите название группы";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        teacher_id: formData.teacher_id || undefined,
      });
      setFormData({
        name: "",
        description: "",
        teacher_id: undefined,
      });
      setErrors({});
    } catch (error) {
      console.error("Failed to save group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "teacher_id" ? (value ? Number(value) : undefined) : value,
    }));
    if (errors[name as keyof GroupFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {group ? "Редактировать группу" : "Создать группу"}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
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
              placeholder="Введите название группы"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input w-full resize-none"
              placeholder="Введите описание группы"
              rows={3}
            />
          </div>

          {/* Teacher */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Преподаватель
            </label>
            <select
              name="teacher_id"
              value={formData.teacher_id || ""}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="">Не назначен</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
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
              {isLoading ? "Сохранение..." : group ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
