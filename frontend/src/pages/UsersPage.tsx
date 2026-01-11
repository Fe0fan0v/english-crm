import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../services/api";
import type { User, UserListResponse } from "../types";
import Avatar from "../components/Avatar";
import CreateUserModal, { type CreateUserData } from "../components/CreateUserModal";
import clsx from "clsx";

type TabType = "students" | "staff";

export default function UsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("students");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list(page, 20, search || undefined);
      setData(response);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const filteredUsers =
    data?.items.filter((user) => {
      if (activeTab === "students") {
        return user.role === "student";
      }
      return user.role !== "student";
    }) || [];

  const totalCount = filteredUsers.length;

  const handleCreateUser = async (userData: CreateUserData) => {
    await usersApi.create(userData);
    // Refresh the list after creating
    await fetchUsers();
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Пользователи</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("students")}
          className={clsx("tab pb-3", activeTab === "students" && "tab-active")}
        >
          Ученики
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={clsx("tab pb-3", activeTab === "staff" && "tab-active")}
        >
          Сотрудники
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
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
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-12"
          />
        </div>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50"
          >
            Назад
          </button>
          <span className="px-4 py-2 text-gray-600">
            {page} из {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
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
      />
    </div>
  );
}

interface UserCardProps {
  user: User;
  onProfile: () => void;
}

function UserCard({ user, onProfile }: UserCardProps) {
  return (
    <div className="card card-hover flex items-center gap-4 py-4">
      <Avatar name={user.name} photo={user.photo_url} size="lg" />

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800">{user.name}</h3>
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
        </div>
      </div>

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
        Профиль {user.role === "student" ? "ученика" : ""}
      </button>
    </div>
  );
}
