import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { groupsApi, usersApi } from "../services/api";
import type { Group, GroupListResponse, User } from "../types";
import GroupModal from "../components/GroupModal";

export default function GroupsPage() {
  const [data, setData] = useState<GroupListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>();
  const [teachersLoading, setTeachersLoading] = useState(true);
  const navigate = useNavigate();

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await groupsApi.list(page, 20, search || undefined, selectedTeacherId);
      setData(response);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      setTeachersLoading(true);
      console.log('Fetching teachers...');
      const response = await usersApi.list(1, 100, undefined, "teacher"); // Фильтр по роли
      console.log('Teachers loaded:', response.items);
      setTeachers(response.items);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setTeachersLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [page, search, selectedTeacherId]);

  const handleCreateGroup = async (groupData: { name: string; description?: string; teacher_id?: number }) => {
    await groupsApi.create(groupData);
    await fetchGroups();
    setIsModalOpen(false);
  };

  const handleUpdateGroup = async (groupData: { name: string; description?: string; teacher_id?: number }) => {
    if (!editingGroup) return;
    await groupsApi.update(editingGroup.id, groupData);
    await fetchGroups();
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить эту группу?")) return;
    try {
      await groupsApi.delete(id);
      await fetchGroups();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Группы</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
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
            placeholder="Поиск групп"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-12"
          />
        </div>

        {/* Teacher filter */}
        <select
          value={selectedTeacherId || ""}
          onChange={(e) => {
            setSelectedTeacherId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className="input max-w-xs"
          disabled={teachersLoading}
        >
          <option value="">
            {teachersLoading ? "Загрузка..." : "Все преподаватели"}
          </option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-gray-500 text-sm mb-4">
        Всего групп: {data?.total || 0}
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
          Создать новую группу
        </button>
      </div>

      {/* Groups list */}
      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((group: Group) => (
            <GroupCard
              key={group.id}
              group={group}
              onView={() => navigate(`/groups/${group.id}`)}
              onEdit={() => setEditingGroup(group)}
              onDelete={() => handleDeleteGroup(group.id)}
            />
          ))}

          {(!data?.items || data.items.length === 0) && (
            <div className="card text-center py-12 text-gray-500">
              Группы не найдены
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

      {/* Create Group Modal */}
      <GroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateGroup}
        teachers={teachers}
      />

      {/* Edit Group Modal */}
      <GroupModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        onSubmit={handleUpdateGroup}
        teachers={teachers}
        group={editingGroup || undefined}
      />
    </div>
  );
}

interface GroupCardProps {
  group: Group;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function GroupCard({ group, onView, onEdit, onDelete }: GroupCardProps) {
  return (
    <div className="card card-hover flex items-center gap-4 py-4">
      {/* Group icon */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800">{group.name}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
          {/* Teacher */}
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {group.teacher_name || "Не назначен"}
          </span>
          {/* Students count */}
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {group.students_count} учеников
          </span>
        </div>
        {group.description && (
          <p className="text-sm text-gray-400 mt-1 truncate">{group.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onView} className="btn btn-primary">
          Подробнее
        </button>
        <button onClick={onEdit} className="btn btn-secondary">
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
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="btn btn-secondary text-red-500 hover:bg-red-50"
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
        </button>
      </div>
    </div>
  );
}
