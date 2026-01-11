import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../services/api";
import type { User, UserListResponse } from "../types";
import Avatar from "../components/Avatar";
import clsx from "clsx";

type TabType = "students" | "staff";

export default function UsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("students");
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
        <button className="flex items-center gap-2 text-purple-600 font-medium hover:text-purple-700 transition-colors py-2">
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
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
            {user.id}
          </span>
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
        <div className="flex items-center gap-3 mt-2">
          <span className="text-gray-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
          </span>
          <span className="text-gray-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
            </svg>
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
