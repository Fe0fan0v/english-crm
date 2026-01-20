import { useState, useEffect } from "react";
import { lessonTypesApi, groupsApi, usersApi } from "../services/api";
import type { LessonType, Group, User } from "../types";

interface LessonCreateModalProps {
  onClose: () => void;
  onSubmit: (data: LessonFormData) => Promise<void>;
  teacherId?: number; // Pre-selected teacher (for teacher dashboard)
  teachers?: User[]; // List of teachers (for admin/manager)
}

export interface LessonFormData {
  title: string;
  teacher_id?: number;
  lesson_type_id: number;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url?: string;
  group_id?: number;
  student_ids: number[];
}

export default function LessonCreateModal({
  onClose,
  onSubmit,
  teacherId,
  teachers,
}: LessonCreateModalProps) {
  const [title, setTitle] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(teacherId);
  const [lessonTypeId, setLessonTypeId] = useState<number | "">("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load lesson types, groups, and students
  useEffect(() => {
    const loadData = async () => {
      try {
        const [lessonTypesRes, studentsRes] = await Promise.all([
          lessonTypesApi.list(),
          usersApi.list(1, 100),
        ]);
        setLessonTypes(lessonTypesRes.items);
        setStudents(studentsRes.items.filter((u) => u.role === "student"));

        // Load groups for the selected teacher
        if (selectedTeacherId) {
          const groupsRes = await groupsApi.list(1, 100, undefined, selectedTeacherId);
          setGroups(groupsRes.items);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Не удалось загрузить данные");
      }
    };
    loadData();
  }, [selectedTeacherId]);

  // When group is selected, load its students
  useEffect(() => {
    if (groupId) {
      const loadGroupStudents = async () => {
        try {
          const group = await groupsApi.get(Number(groupId));
          setSelectedStudentIds(group.students.map((s) => s.student_id));
        } catch (err) {
          console.error("Failed to load group students:", err);
        }
      };
      loadGroupStudents();
    }
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Введите название урока");
      return;
    }
    if (!lessonTypeId) {
      setError("Выберите тип урока");
      return;
    }
    if (!scheduledDate) {
      setError("Выберите дату");
      return;
    }
    if (!teacherId && !selectedTeacherId) {
      setError("Выберите преподавателя");
      return;
    }
    if (selectedStudentIds.length === 0 && !groupId) {
      setError("Выберите хотя бы одного ученика или группу");
      return;
    }

    setIsLoading(true);
    try {
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      await onSubmit({
        title: title.trim(),
        teacher_id: selectedTeacherId,
        lesson_type_id: Number(lessonTypeId),
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        meeting_url: meetingUrl.trim() || undefined,
        group_id: groupId ? Number(groupId) : undefined,
        student_ids: selectedStudentIds,
      });
      onClose();
    } catch (err) {
      console.error("Failed to create lesson:", err);
      setError("Не удалось создать урок");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Новый урок</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название урока *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input w-full"
                placeholder="Например: Урок грамматики"
              />
            </div>

            {/* Teacher (for admin/manager) */}
            {teachers && !teacherId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Преподаватель *
                </label>
                <select
                  value={selectedTeacherId || ""}
                  onChange={(e) => setSelectedTeacherId(e.target.value ? Number(e.target.value) : undefined)}
                  className="input w-full"
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Lesson Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип урока *
              </label>
              <select
                value={lessonTypeId}
                onChange={(e) => setLessonTypeId(e.target.value ? Number(e.target.value) : "")}
                className="input w-full"
              >
                <option value="">Выберите тип урока</option>
                {lessonTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.price} тг)
                  </option>
                ))}
              </select>
            </div>

            {/* Date, Time and Duration */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Время *
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Длительность *
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="input w-full"
                >
                  <option value={30}>30 мин</option>
                  <option value={45}>45 мин</option>
                  <option value={60}>1 час</option>
                  <option value={90}>1.5 часа</option>
                  <option value={120}>2 часа</option>
                </select>
              </div>
            </div>

            {/* Meeting URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на урок
              </label>
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="input w-full"
                placeholder="https://telemost.yandex.ru/..."
              />
              <p className="text-xs text-gray-400 mt-1">
                В будущем ссылка будет создаваться автоматически
              </p>
            </div>

            {/* Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Группа (опционально)
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
                className="input w-full"
              >
                <option value="">Без группы (индивидуальный)</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.students_count} уч.)
                  </option>
                ))}
              </select>
            </div>

            {/* Students */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ученики {groupId ? "(из группы)" : ""}
              </label>
              <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                {students.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет учеников</p>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-700">{student.name}</span>
                        <span className="text-xs text-gray-400">{student.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedStudentIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Выбрано: {selectedStudentIds.length}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex-1"
            >
              {isLoading ? "Создание..." : "Создать урок"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
