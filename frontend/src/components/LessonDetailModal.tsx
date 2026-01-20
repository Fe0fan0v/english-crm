import { useState, useEffect } from "react";
import { lessonsApi } from "../services/api";
import type { LessonDetail, AttendanceStatus } from "../types";

interface LessonDetailModalProps {
  lessonId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  pending: "Ожидание",
  present: "Присутствовал",
  absent_excused: "Уважительная причина",
  absent_unexcused: "Неуважительная причина",
};

const attendanceStatusColors: Record<AttendanceStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  present: "bg-green-100 text-green-700",
  absent_excused: "bg-yellow-100 text-yellow-700",
  absent_unexcused: "bg-red-100 text-red-700",
};

export default function LessonDetailModal({
  lessonId,
  onClose,
  onUpdate,
}: LessonDetailModalProps) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [updatingStudentId, setUpdatingStudentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"attendance" | "materials">("attendance");

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await lessonsApi.getLesson(lessonId);
      setLesson(data);
    } catch (err) {
      console.error("Failed to load lesson:", err);
      setError("Не удалось загрузить урок");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLesson = async () => {
    if (!lesson) return;
    if (!confirm("Вы уверены, что хотите отменить урок?")) return;

    try {
      setIsCancelling(true);
      await lessonsApi.updateLesson(lessonId, { status: "cancelled" });
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Failed to cancel lesson:", err);
      setError("Не удалось отменить урок");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAttendanceChange = async (studentId: number, status: AttendanceStatus) => {
    try {
      setUpdatingStudentId(studentId);
      await lessonsApi.updateAttendance(lessonId, studentId, status);
      await loadLesson();
    } catch (err) {
      console.error("Failed to update attendance:", err);
      setError("Не удалось обновить посещаемость");
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Запланирован",
    completed: "Завершён",
    cancelled: "Отменён",
    no_show: "Неявка",
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-cyan-100 text-cyan-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    no_show: "bg-yellow-100 text-yellow-700",
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-red-500">{error || "Урок не найден"}</div>
          <button onClick={onClose} className="btn btn-secondary mt-4">
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold text-gray-800">{lesson.title}</h2>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[lesson.status]}`}>
                  {statusLabels[lesson.status]}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDateTime(lesson.scheduled_at)} ({lesson.duration_minutes} мин)
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {lesson.teacher_name}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {lesson.lesson_type_name}
                </div>
                {lesson.group_name && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Группа: {lesson.group_name}
                  </div>
                )}
                {lesson.meeting_url && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <a href={lesson.meeting_url} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                      Ссылка на урок
                    </a>
                  </div>
                )}
              </div>
            </div>
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

        {/* Tabs */}
        <div className="border-b border-gray-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab("attendance")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "attendance"
                  ? "text-cyan-600 border-b-2 border-cyan-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Посещаемость ({lesson.students.length})
            </button>
            <button
              onClick={() => setActiveTab("materials")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "materials"
                  ? "text-cyan-600 border-b-2 border-cyan-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Материалы
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-350px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-3">
              {lesson.students.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Нет учеников на этом уроке</p>
              ) : (
                lesson.students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{student.name}</div>
                      <div className="text-sm text-gray-500">{student.email}</div>
                      {student.charged && (
                        <div className="text-xs text-green-600 mt-1">Списано</div>
                      )}
                    </div>
                    <div className="ml-4">
                      {lesson.status === "cancelled" ? (
                        <span className={`px-3 py-1.5 rounded-lg text-sm ${attendanceStatusColors[student.attendance_status]}`}>
                          {attendanceStatusLabels[student.attendance_status]}
                        </span>
                      ) : (
                        <select
                          value={student.attendance_status}
                          onChange={(e) => handleAttendanceChange(student.id, e.target.value as AttendanceStatus)}
                          disabled={updatingStudentId === student.id}
                          className={`px-3 py-1.5 rounded-lg text-sm border-0 cursor-pointer ${attendanceStatusColors[student.attendance_status]} ${
                            updatingStudentId === student.id ? "opacity-50" : ""
                          }`}
                        >
                          <option value="pending">Ожидание</option>
                          <option value="present">Присутствовал</option>
                          <option value="absent_excused">Уваж. причина</option>
                          <option value="absent_unexcused">Неуваж. причина</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "materials" && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Материалы урока</h3>
              <p className="text-gray-500">Раздел в разработке</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            {lesson.status === "scheduled" && (
              <>
                <button onClick={onClose} className="btn btn-secondary flex-1">
                  Закрыть
                </button>
                <button
                  onClick={handleCancelLesson}
                  disabled={isCancelling}
                  className="btn bg-red-500 text-white hover:bg-red-600 flex-1"
                >
                  {isCancelling ? "Отмена..." : "Отменить урок"}
                </button>
              </>
            )}
            {lesson.status !== "scheduled" && (
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
