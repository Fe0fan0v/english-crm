import { useState, useEffect } from "react";
import type { LessonType } from "../types";

interface LessonTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LessonTypeFormData) => Promise<void>;
  lessonType?: LessonType | null; // For editing
}

export interface LessonTypeFormData {
  name: string;
  price: number;
}

export default function LessonTypeModal({
  isOpen,
  onClose,
  onSubmit,
  lessonType,
}: LessonTypeModalProps) {
  const [formData, setFormData] = useState<LessonTypeFormData>({
    name: "",
    price: 0,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LessonTypeFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!lessonType;

  // Populate form when editing
  useEffect(() => {
    if (lessonType) {
      setFormData({
        name: lessonType.name,
        price: parseFloat(lessonType.price),
      });
    } else {
      setFormData({ name: "", price: 0 });
    }
    setErrors({});
  }, [lessonType, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LessonTypeFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите название";
    }

    if (formData.price < 0) {
      newErrors.price = "Стоимость не может быть отрицательной";
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
      setFormData({ name: "", price: 0 });
      setErrors({});
      onClose();
    } catch (error) {
      console.error("Failed to save lesson type:", error);
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
    if (errors[name as keyof LessonTypeFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? "Редактировать тип занятия" : "Добавить занятие"}
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
              placeholder="Например: Group, Indiv, Duo..."
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Стоимость (за урок) *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className={`input w-full ${errors.price ? "border-red-500" : ""}`}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            {errors.price && (
              <p className="text-red-500 text-sm mt-1">{errors.price}</p>
            )}
            {formData.price > 0 && (
              <p className="text-gray-500 text-sm mt-1">
                В месяц (12 уроков): {(formData.price * 12).toLocaleString("ru-RU")} тг
              </p>
            )}
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
              {isLoading
                ? "Сохранение..."
                : isEditing
                ? "Сохранить"
                : "Добавить занятие"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
