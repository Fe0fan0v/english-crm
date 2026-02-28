import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usersApi, levelsApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { User, UserListResponse, Level } from "../types";
import Avatar from "../components/Avatar";
import CreateUserModal, { type CreateUserData } from "../components/CreateUserModal";
import clsx from "clsx";

type TabType = "students" | "staff";

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<UserListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const activeTab: TabType = (searchParams.get("tab") as TabType) || "students";
  const balanceFrom = searchParams.get("balance_from") || "";
  const balanceTo = searchParams.get("balance_to") || "";
  const sortBy = searchParams.get("sort_by") || "";

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "1" && key === "page" || value === "students" && key === "tab") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    levelsApi.list().then((data) => setLevels(data.items)).catch(console.error);
  }, []);

  const getLevelName = (levelId: number | null) => {
    if (!levelId) return null;
    return levels.find((l) => l.id === levelId)?.name || null;
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const role = activeTab === "students" ? "student" : "teacher";
      const response = await usersApi.list(
        page, 20, search || undefined, role,
        balanceFrom ? Number(balanceFrom) : undefined,
        balanceTo ? Number(balanceTo) : undefined,
        sortBy || undefined,
      );
      setData(response);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, activeTab, balanceFrom, balanceTo, sortBy]);

  // Both tabs use server-side filtering now
  const filteredUsers = data?.items || [];
  const totalCount = data?.total || 0;

  const handleCreateUser = async (userData: CreateUserData) => {
    await usersApi.create(userData);
    // Refresh the list after creating
    await fetchUsers();
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await usersApi.delete(userId);
      // Refresh the list after deleting
      await fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Не удалось удалить пользователя");
    }
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Пользователи</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => updateParams({ tab: "students", page: null, search: null })}
          className={clsx("tab pb-3", activeTab === "students" && "tab-active")}
        >
          Ученики
        </button>
        <button
          onClick={() => updateParams({ tab: "staff", page: null, search: null })}
          className={clsx("tab pb-3", activeTab === "staff" && "tab-active")}
        >
          Сотрудники
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
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
            placeholder={
              activeTab === "students" ? "Поиск учеников" : "Поиск сотрудников"
            }
            value={search}
            onChange={(e) => {
              updateParams({ search: e.target.value, page: null });
            }}
            className="input pl-12"
          />
        </div>

        {activeTab === "students" && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Баланс от</span>
              <input
                type="number"
                value={balanceFrom}
                onChange={(e) => updateParams({ balance_from: e.target.value, page: null })}
                className="input w-28 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">до</span>
              <input
                type="number"
                value={balanceTo}
                onChange={(e) => updateParams({ balance_to: e.target.value, page: null })}
                className="input w-28 py-1.5 text-sm"
                placeholder="999999"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => updateParams({ sort_by: e.target.value, page: null })}
              className="input w-auto py-1.5 text-sm"
            >
              <option value="">По дате создания</option>
              <option value="balance_asc">Баланс (по возрастанию)</option>
              <option value="balance_desc">Баланс (по убыванию)</option>
              <option value="name_asc">Имя (А-Я)</option>
              <option value="name_desc">Имя (Я-А)</option>
            </select>
            {(balanceFrom || balanceTo || sortBy) && (
              <button
                onClick={() => updateParams({ balance_from: null, balance_to: null, sort_by: null, page: null })}
                className="text-sm text-cyan-600 hover:text-cyan-700"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </div>

      {/* Count */}
      <p className="text-gray-500 text-sm mb-4">
        Кол-во {activeTab === "students" ? "учеников" : "сотрудников"}{" "}
        {totalCount}
      </p>

      {/* Create button */}
      <div className="card mb-4 flex justify-center">
        <button
          onClick={() => setIsModalOpen(true)}
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
          Создать нового {activeTab === "students" ? "ученика" : "сотрудника"}
        </button>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user: User) => (
            <UserCard
              key={user.id}
              user={user}
              onProfile={() => navigate(`/users/${user.id}`)}
              onSchedule={
                user.role === "teacher"
                  ? () => navigate(`/teachers/${user.id}`)
                  : user.role === "student"
                    ? () => navigate(`/students/${user.id}`)
                    : undefined
              }
              onDelete={() => handleDeleteUser(user.id, user.name)}
              levelName={getLevelName(user.level_id)}
              showBalance={activeTab === "students"}
            />
          ))}

          {filteredUsers.length === 0 && (
            <div className="card text-center py-12 text-gray-500">
              {activeTab === "students"
                ? "Ученики не найдены"
                : "Сотрудники не найдены"}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50"
          >
            Назад
          </button>
          <span className="px-4 py-2 text-gray-600">
            {page} из {data.pages}
          </span>
          <button
            onClick={() => updateParams({ page: String(Math.min(data.pages, page + 1)) })}
            disabled={page === data.pages}
            className="btn btn-secondary disabled:opacity-50"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
        defaultRole={activeTab === "students" ? "student" : "teacher"}
        currentUserRole={currentUser?.role}
      />
    </div>
  );
}

interface UserCardProps {
  user: User;
  onProfile: () => void;
  onSchedule?: () => void;
  onDelete: () => void;
  levelName?: string | null;
  showBalance?: boolean;
}

function UserCard({ user, onProfile, onSchedule, onDelete, levelName, showBalance }: UserCardProps) {
  const balanceNum = showBalance ? Number(user.balance) : 0;

  return (
    <div className="card card-hover flex items-center gap-4 py-4">
      <Avatar name={user.name} photo={user.photo_url} size="lg" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">{user.name}</h3>
          {showBalance && (
            <span
              className={clsx(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                balanceNum > 0
                  ? "bg-green-100 text-green-700"
                  : balanceNum < 0
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
              )}
            >
              {balanceNum.toLocaleString("ru-RU")} тг
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
          {/* Phone */}
          <span className="flex items-center gap-1">
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
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            {user.phone || "—"}
          </span>
          {/* Email */}
          <span className="flex items-center gap-1">
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {user.email}
          </span>
          {/* Level */}
          {levelName && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {levelName}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Schedule button for teachers and students */}
        {(user.role === "teacher" || user.role === "student") && onSchedule && (
          <button onClick={onSchedule} className="btn btn-secondary">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Расписание
          </button>
        )}
        <button onClick={onProfile} className="btn btn-primary">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Профиль
        </button>
        {/* Delete button */}
        <button
          onClick={onDelete}
          className="btn bg-red-500 hover:bg-red-600 text-white"
          title="Удалить пользователя"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Удалить
        </button>
      </div>
    </div>
  );
}
