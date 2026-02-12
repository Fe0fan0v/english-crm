import { useState, useEffect } from "react";
import { levelsApi, usersApi } from "../services/api";
import type { UserRole, Level, User } from "../types";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserData) => Promise<void>;
  defaultRole?: UserRole;
  currentUserRole?: UserRole;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  level_id?: number | null;
  teacher_id?: number | null;
}

const roleLabels: Record<UserRole, string> = {
  student: "Ученик",
  teacher: "Учитель",
  manager: "Менеджер",
  admin: "Администратор",
};

export default function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRole = "student",
  currentUserRole,
}: CreateUserModalProps) {
  // Filter available roles based on current user's role
  const availableRoles = Object.entries(roleLabels).filter(([role]) => {
    if (currentUserRole === 'manager') {
      return role === 'teacher' || role === 'student';
    }
    return true; // admin sees all roles
  });
  const [formData, setFormData] = useState<CreateUserData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: defaultRole,
    level_id: null,
    teacher_id: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateUserData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) {
      levelsApi.list().then((data) => setLevels(data.items)).catch(console.error);
      usersApi.list(1, 100, undefined, "teacher").then((data) => setTeachers(data.items)).catch(console.error);
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreateUserData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Введите имя";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Введите email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Некорректный email";
    }

    if (!formData.password) {
      newErrors.password = "Введите пароль";
    } else if (formData.password.length < 6) {
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
      await onSubmit(formData);
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: defaultRole,
        level_id: null,
        teacher_id: null,
      });
      setErrors({});
      onClose();
    } catch (error: any) {
      console.error("Failed to create user:", error);
      const message =
        error?.response?.data?.detail || "Не удалось создать пользователя";
      setErrors((prev) => ({ ...prev, email: message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof CreateUserData]) {
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Создать {formData.role === "student" ? "ученика" : "сотрудника"}
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
              value={formData.phone}
              onChange={handleChange}
              className="input w-full"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`input w-full ${errors.password ? "border-red-500" : ""}`}
              placeholder="Минимум 6 символов"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="input w-full"
            >
              {availableRoles.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Level (for student and teacher) */}
          {(formData.role === "student" || formData.role === "teacher") && (
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

          {/* Teacher (for student only) */}
          {formData.role === "student" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Преподаватель
              </label>
              <select
                value={formData.teacher_id || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    teacher_id: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
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
          )}

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
              {isLoading ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
