import { useState, useEffect } from "react";
import { levelsApi } from "../services/api";
import type { User, Level } from "../types";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EditUserData) => Promise<void>;
  user: User;
}

export interface EditUserData {
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  level_id: number | null;
  password?: string;
}

export default function EditUserModal({
  isOpen,
  onClose,
  onSubmit,
  user,
}: EditUserModalProps) {
  const [formData, setFormData] = useState<EditUserData>({
    name: "",
    email: "",
    phone: null,
    photo_url: null,
    level_id: null,
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EditUserData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);

  // Load levels
  useEffect(() => {
    if (isOpen) {
      levelsApi.list().then((data) => setLevels(data.items)).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        photo_url: user.photo_url || null,
        level_id: user.level_id || null,
        password: "",
      });
      setErrors({});
    }
  }, [user, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EditUserData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите имя";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Введите email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Некорректный email";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Пароль должен быть не менее 6 символов";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.password) {
        delete dataToSubmit.password;
      }
      await onSubmit(dataToSubmit);
      onClose();
    } catch (error) {
      console.error("Failed to update user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));
    if (errors[name as keyof EditUserData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Редактировать профиль
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
              Имя *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input w-full ${errors.name ? "border-red-500" : ""}`}
              placeholder="Введите имя"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`input w-full ${errors.email ? "border-red-500" : ""}`}
              placeholder="email@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Телефон
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              className="input w-full"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          {/* Level */}
          {(user.role === "student" || user.role === "teacher") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Уровень
              </label>
              <select
                value={formData.level_id || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    level_id: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                className="input w-full"
              >
                <option value="">Не указан</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Новый пароль
            </label>
            <input
              type="password"
              name="password"
              value={formData.password || ""}
              onChange={handleChange}
              className={`input w-full ${errors.password ? "border-red-500" : ""}`}
              placeholder="Оставьте пустым, чтобы не менять"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL фото
            </label>
            <input
              type="url"
              name="photo_url"
              value={formData.photo_url || ""}
              onChange={handleChange}
              className="input w-full"
              placeholder="https://example.com/photo.jpg"
            />
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
              {isLoading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
