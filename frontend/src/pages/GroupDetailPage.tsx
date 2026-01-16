import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { groupsApi, usersApi } from "../services/api";
import type { GroupDetail, GroupStudent, User } from "../types";
import Avatar from "../components/Avatar";
import AddStudentsModal from "../components/AddStudentsModal";
import GroupModal from "../components/GroupModal";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddStudentsModalOpen, setIsAddStudentsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [teachers, setTeachers] = useState<User[]>([]);

  const fetchGroup = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await groupsApi.get(parseInt(id));
      setGroup(data);
    } catch (error) {
      console.error("Failed to fetch group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await usersApi.list(1, 100);
      setTeachers(response.items.filter((u) => u.role === "teacher"));
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchTeachers();
  }, [id]);

  const handleAddStudents = async (studentIds: number[]) => {
    if (!id) return;
    try {
      const updatedGroup = await groupsApi.addStudents(parseInt(id), studentIds);
      setGroup(updatedGroup);
      setIsAddStudentsModalOpen(false);
    } catch (error) {
      console.error("Failed to add students:", error);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!id) return;
    if (!confirm("Вы уверены, что хотите удалить этого ученика из группы?")) return;
    try {
      const updatedGroup = await groupsApi.removeStudents(parseInt(id), [studentId]);
      setGroup(updatedGroup);
    } catch (error) {
      console.error("Failed to remove student:", error);
    }
  };

  const handleUpdateGroup = async (data: { name: string; description?: string; teacher_id?: number }) => {
    if (!id) return;
    try {
      await groupsApi.update(parseInt(id), data);
      await fetchGroup();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update group:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Группа не найдена</div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Назад
      </button>

      {/* Group header */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          {/* Group icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-purple-500"
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

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{group.name}</h1>
            {group.description && (
              <p className="text-gray-500 mt-1">{group.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Преподаватель: {group.teacher_name || "Не назначен"}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {group.students.length} учеников
              </span>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Редактировать
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Students section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Ученики группы</h2>
          <button
            onClick={() => setIsAddStudentsModalOpen(true)}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Добавить учеников
          </button>
        </div>

        {group.students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            В группе пока нет учеников
          </div>
        ) : (
          <div className="space-y-3">
            {group.students.map((student: GroupStudent) => (
              <StudentCard
                key={student.id}
                student={student}
                onRemove={() => handleRemoveStudent(student.student_id)}
                onProfile={() => navigate(`/users/${student.student_id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Students Modal */}
      <AddStudentsModal
        isOpen={isAddStudentsModalOpen}
        onClose={() => setIsAddStudentsModalOpen(false)}
        onSubmit={handleAddStudents}
        existingStudentIds={group.students.map((s) => s.student_id)}
      />

      {/* Edit Group Modal */}
      <GroupModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateGroup}
        teachers={teachers}
        group={{ ...group, students_count: group.students.length }}
      />
    </div>
  );
}

interface StudentCardProps {
  student: GroupStudent;
  onRemove: () => void;
  onProfile: () => void;
}

function StudentCard({ student, onRemove, onProfile }: StudentCardProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
      <Avatar name={student.student_name} size="md" />

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-800">{student.student_name}</h4>
        <p className="text-sm text-gray-500">{student.student_email}</p>
      </div>

      <div className="text-right mr-4">
        <p className="text-sm text-gray-500">Баланс</p>
        <p className="font-medium text-gray-800">{student.balance} руб.</p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onProfile} className="btn btn-secondary text-sm">
          Профиль
        </button>
        <button
          onClick={onRemove}
          className="btn btn-secondary text-red-500 hover:bg-red-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
