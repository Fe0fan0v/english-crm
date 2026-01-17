import { useState } from "react";
import { teacherApi } from "../services/api";
import type { TeacherLesson, AttendanceStatus, AttendanceUpdate } from "../types";

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: TeacherLesson;
  onSave: () => void;
}

const statusLabels: Record<AttendanceStatus, string> = {
  pending: "Не отмечен",
  present: "Был",
  absent_excused: "Не был (ув.)",
  absent_unexcused: "Не был",
};

const statusColors: Record<AttendanceStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  present: "bg-green-100 text-green-700",
  absent_excused: "bg-blue-100 text-blue-700",
  absent_unexcused: "bg-red-100 text-red-700",
};

export default function AttendanceModal({
  isOpen,
  onClose,
  lesson,
  onSave,
}: AttendanceModalProps) {
  const [attendances, setAttendances] = useState<Record<number, AttendanceStatus>>(
    () => {
      const initial: Record<number, AttendanceStatus> = {};
      lesson.students.forEach((s) => {
        initial[s.id] = s.attendance_status;
      });
      return initial;
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendances((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const updates: AttendanceUpdate[] = lesson.students.map((s) => ({
        student_id: s.id,
        status: attendances[s.id],
      }));

      await teacherApi.markAttendance(lesson.id, updates);
      onSave();
    } catch (err) {
      setError("Не удалось сохранить посещаемость");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const lessonDate = new Date(lesson.scheduled_at);
  const formattedDate = lessonDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = lessonDate.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{lesson.title}</h2>
            <p className="text-sm text-gray-500">
              {formattedDate} в {formattedTime}
            </p>
            <p className="text-sm text-gray-500">
              Тип: {lesson.lesson_type_name} ({parseFloat(lesson.lesson_type_price).toLocaleString("ru-RU")} тг)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Students List */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {lesson.students.length > 0 ? (
            <div className="space-y-4">
              {lesson.students.map((student) => (
                <div key={student.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-800">{student.name}</span>
                    {student.charged && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded">
                        Списано
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(["present", "absent_excused", "absent_unexcused"] as AttendanceStatus[]).map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(student.id, status)}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            attendances[student.id] === status
                              ? statusColors[status]
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {statusLabels[status]}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              В этом уроке нет учеников
            </p>
          )}
        </div>

        {/* Warning */}
        <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100">
          <div className="flex items-start gap-2 text-sm text-yellow-700">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>
              При статусе <strong>"Был"</strong> или <strong>"Не был"</strong> с баланса ученика
              списывается {parseFloat(lesson.lesson_type_price).toLocaleString("ru-RU")} тг.
              <br />
              При статусе <strong>"Не был (ув.)"</strong> деньги не списываются.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          {error && <p className="text-red-500 text-sm mr-auto">{error}</p>}
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isSubmitting || lesson.students.length === 0}
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
