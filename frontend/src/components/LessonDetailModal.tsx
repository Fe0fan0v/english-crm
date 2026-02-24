import { useState, useEffect } from "react";
import { lessonsApi, teacherApi, courseMaterialsApi } from "../services/api";
import { liveSessionApi } from "../services/liveSessionApi";
import { useAuthStore } from "../store/authStore";
import type { LessonDetail, AttendanceStatus, LessonMaterial, LessonCourseMaterial } from "../types";
import AttachMaterialModal from "./AttachMaterialModal";
import AttachCourseMaterialModal from "./AttachCourseMaterialModal";

interface LessonDetailModalProps {
  lessonId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  pending: "Ожидание",
  present: "Был",
  absent_excused: "Не был (ув.)",
  absent_unexcused: "Не был",
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingStudentId, setUpdatingStudentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"attendance" | "materials" | "courses">("attendance");
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<LessonCourseMaterial[]>([]);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isAttachCourseMaterialModalOpen, setIsAttachCourseMaterialModalOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isUpdatingMeetingUrl, setIsUpdatingMeetingUrl] = useState(false);
  const [isStartingLiveSession, setIsStartingLiveSession] = useState(false);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    if (activeTab === "materials" && lesson) {
      loadMaterials();
    } else if (activeTab === "courses" && lesson) {
      loadCourseMaterials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lesson]);

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await lessonsApi.getLesson(lessonId);
      setLesson(data);
      setMeetingUrl(data.meeting_url || "");
    } catch (err) {
      console.error("Failed to load lesson:", err);
      setError("Не удалось загрузить урок");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await lessonsApi.getLessonMaterials(lessonId);
      setMaterials(data);
    } catch (err) {
      console.error("Failed to load materials:", err);
    }
  };

  const loadCourseMaterials = async () => {
    try {
      const data = await courseMaterialsApi.getLessonCourseMaterials(lessonId);
      setCourseMaterials(data);
    } catch (err) {
      console.error("Failed to load course materials:", err);
    }
  };

  const handleDetachCourseMaterial = async (materialId: number) => {
    if (!confirm("Открепить этот материал от урока?")) return;
    await courseMaterialsApi.detachCourseMaterial(lessonId, materialId);
    await loadCourseMaterials();
  };

  const getCourseMaterialTitle = (material: LessonCourseMaterial): string => {
    if (material.material_type === "course" && material.course_title) {
      return material.course_title;
    } else if (material.material_type === "section" && material.section_title) {
      return material.section_title;
    } else if (material.material_type === "lesson" && material.interactive_lesson_title) {
      return material.interactive_lesson_title;
    }
    return "Unknown";
  };

  const getCourseMaterialTypeBadge = (type: string) => {
    switch (type) {
      case "course":
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Курс</span>;
      case "section":
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Секция</span>;
      case "lesson":
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Урок</span>;
      default:
        return null;
    }
  };

  const getCourseMaterialLink = (material: LessonCourseMaterial): string => {
    console.log("Getting link for material:", material);

    if (material.material_type === "course" && material.course_id) {
      return `/courses/${material.course_id}/edit`;
    } else if (material.material_type === "section" && material.course_id) {
      // Navigate to course editor (section is visible there)
      console.log("Section with course_id:", material.course_id);
      return `/courses/${material.course_id}/edit`;
    } else if (material.material_type === "topic" && material.course_id) {
      // Navigate to course editor (topic is visible there)
      return `/courses/${material.course_id}/edit`;
    } else if (material.material_type === "lesson" && material.interactive_lesson_id) {
      return `/courses/lessons/${material.interactive_lesson_id}`;
    }

    console.warn("No valid link found for material:", material);
    return "#";
  };

  const handleAttach = async (materialId: number) => {
    await lessonsApi.attachMaterial(lessonId, materialId);
    await loadMaterials();
    setIsAttachModalOpen(false);
  };

  const handleDetach = async (materialId: number) => {
    if (!confirm("Открепить этот материал от урока?")) return;
    await lessonsApi.detachMaterial(lessonId, materialId);
    await loadMaterials();
  };

  const handleCancelLesson = async () => {
    if (!lesson) return;
    if (!confirm("Вы уверены, что хотите отменить урок?")) return;

    try {
      setIsCancelling(true);
      if (currentUser?.role === "teacher") {
        await teacherApi.cancelLesson(lessonId);
      } else {
        await lessonsApi.updateLesson(lessonId, { status: "cancelled" });
      }
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Failed to cancel lesson:", err);
      setError("Не удалось отменить урок");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!lesson) return;
    if (!confirm("Вы уверены, что хотите удалить урок? Это действие нельзя отменить.")) return;

    try {
      setIsDeleting(true);
      await lessonsApi.deleteLesson(lessonId);
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Failed to delete lesson:", err);
      setError("Не удалось удалить урок");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAttendanceChange = async (studentId: number, status: AttendanceStatus) => {
    try {
      setUpdatingStudentId(studentId);
      if (currentUser?.role === "teacher") {
        await teacherApi.markAttendance(lessonId, [{ student_id: studentId, status }]);
      } else {
        await lessonsApi.updateAttendance(lessonId, studentId, status);
      }
      await loadLesson();
    } catch (err) {
      console.error("Failed to update attendance:", err);
      setError("Не удалось обновить посещаемость");
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleUpdateMeetingUrl = async () => {
    if (!lesson) return;
    try {
      setIsUpdatingMeetingUrl(true);
      setError("");
      const trimmedUrl = meetingUrl.trim();
      if (currentUser?.role === "teacher") {
        await teacherApi.updateLesson(lessonId, { meeting_url: trimmedUrl || undefined });
      } else {
        await lessonsApi.updateLesson(lessonId, { meeting_url: trimmedUrl || undefined });
      }
      await loadLesson();
    } catch (err) {
      console.error("Failed to update meeting URL:", err);
      setError("Не удалось обновить ссылку на урок");
    } finally {
      setIsUpdatingMeetingUrl(false);
    }
  };

  const handleStartLiveSession = async (interactiveLessonId: number, studentId: number) => {
    try {
      setIsStartingLiveSession(true);
      await liveSessionApi.create({
        lesson_id: lessonId,
        interactive_lesson_id: interactiveLessonId,
        student_id: studentId,
      });
      window.open(`/courses/lessons/${interactiveLessonId}?session=${lessonId}`, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось создать сессию";
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr?.response?.data?.detail || msg);
    } finally {
      setIsStartingLiveSession(false);
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
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "attendance"
                  ? "text-cyan-600 border-b-2 border-cyan-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Посещаемость ({lesson.students.length})
            </button>
            <button
              onClick={() => setActiveTab("materials")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "materials"
                  ? "text-cyan-600 border-b-2 border-cyan-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setActiveTab("courses")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "courses"
                  ? "text-cyan-600 border-b-2 border-cyan-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Курсы
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
            <div className="space-y-4">
              {/* Meeting URL Editor (only for teacher/admin/manager) */}
              {currentUser?.role !== "student" && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ссылка на урок
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      className="input flex-1"
                      placeholder="https://telemost.yandex.ru/..."
                      disabled={isUpdatingMeetingUrl}
                    />
                    <button
                      onClick={handleUpdateMeetingUrl}
                      disabled={isUpdatingMeetingUrl || meetingUrl.trim() === (lesson?.meeting_url || "")}
                      className="btn btn-primary whitespace-nowrap"
                    >
                      {isUpdatingMeetingUrl ? "..." : "Сохранить"}
                    </button>
                  </div>
                </div>
              )}

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
                          <option value="present">Был</option>
                          <option value="absent_excused">Не был (ув.)</option>
                          <option value="absent_unexcused">Не был</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "materials" && (
            <div className="space-y-4">
              {/* Attach button - only for teacher */}
              {lesson && currentUser?.role !== "student" && (
                <button
                  onClick={() => setIsAttachModalOpen(true)}
                  className="btn btn-primary w-full"
                >
                  + Прикрепить материал PDF
                </button>
              )}

              {/* Materials list */}
              {materials.length > 0 ? (
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div key={material.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800">{material.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Прикреплено: {new Date(material.attached_at).toLocaleDateString("ru-RU", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })} • {material.attacher_name}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <a
                            href={material.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Открыть
                          </a>
                          {currentUser?.role !== "student" && (
                            <button
                              onClick={() => handleDetach(material.id)}
                              className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                            >
                              Открепить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Материалов нет</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "courses" && (
            <div className="space-y-4">
              {/* Attach button - only for teacher/admin/manager */}
              {lesson && currentUser?.role !== "student" && (
                <button
                  onClick={() => setIsAttachCourseMaterialModalOpen(true)}
                  className="btn btn-primary w-full"
                >
                  + Прикрепить материал из курса
                </button>
              )}

              {/* Course Materials list */}
              {courseMaterials.length > 0 ? (
                <div className="space-y-3">
                  {courseMaterials.map((material) => (
                    <div key={material.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800">{getCourseMaterialTitle(material)}</h4>
                            {getCourseMaterialTypeBadge(material.material_type)}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Прикреплено: {new Date(material.attached_at).toLocaleDateString("ru-RU", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })} • {material.attacher_name}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <a
                            href={getCourseMaterialLink(material)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Предпросмотр
                          </a>
                          {currentUser?.role !== "student" &&
                            material.material_type === "lesson" &&
                            material.interactive_lesson_id &&
                            lesson.students.length === 1 && (
                            <button
                              onClick={() => handleStartLiveSession(
                                material.interactive_lesson_id!,
                                lesson.students[0].id
                              )}
                              disabled={isStartingLiveSession}
                              className="btn btn-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                              {isStartingLiveSession ? "..." : "Открыть"}
                            </button>
                          )}
                          {currentUser?.role !== "student" && (
                            <button
                              onClick={() => handleDetachCourseMaterial(material.id)}
                              className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                            >
                              Открепить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p>Курсовых материалов нет</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary flex-1">
              Закрыть
            </button>
            {lesson.status === "scheduled" && (
              <button
                onClick={handleCancelLesson}
                disabled={isCancelling}
                className="btn bg-orange-500 text-white hover:bg-orange-600 flex-1"
              >
                {isCancelling ? "Отмена..." : "Отменить урок"}
              </button>
            )}
            {currentUser?.role !== "teacher" && (
              <button
                onClick={handleDeleteLesson}
                disabled={isDeleting}
                className="btn bg-red-500 text-white hover:bg-red-600 flex-1"
              >
                {isDeleting ? "Удаление..." : "Удалить"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attach Material Modal */}
      {isAttachModalOpen && (
        <AttachMaterialModal
          attachedMaterialIds={materials.map((m) => m.id)}
          onClose={() => setIsAttachModalOpen(false)}
          onAttach={handleAttach}
        />
      )}

      {/* Attach Course Material Modal */}
      {isAttachCourseMaterialModalOpen && (
        <AttachCourseMaterialModal
          isOpen={isAttachCourseMaterialModalOpen}
          lessonId={lessonId}
          onClose={() => setIsAttachCourseMaterialModalOpen(false)}
          onAttached={() => loadCourseMaterials()}
        />
      )}
    </div>
  );
}
