import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lessonsApi, usersApi } from "../services/api";
import type { ScheduleLesson, User } from "../types";
import Avatar from "../components/Avatar";
import LessonCreateModal, { type LessonFormData } from "../components/LessonCreateModal";
import LessonDetailModal from "../components/LessonDetailModal";

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDateRange(start: Date, end: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  return `${start.getDate()} ${months[start.getMonth()]} - ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateISO(date: Date): string {
  return formatDateLocal(date) + "T00:00:00";
}

function formatDateISOEnd(date: Date): string {
  return formatDateLocal(date) + "T23:59:59";
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

const statusColors: Record<string, string> = {
  scheduled: "bg-cyan-100 border-cyan-300 text-cyan-700",
  completed: "bg-green-100 border-green-300 text-green-700",
  cancelled: "bg-red-100 border-red-300 text-red-700",
  no_show: "bg-yellow-100 border-yellow-300 text-yellow-700",
};

export default function StudentSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const studentId = Number(id);

  const [student, setStudent] = useState<User | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);

  // Load student info and teachers
  useEffect(() => {
    if (!studentId) return;
    usersApi.get(studentId).then(setStudent).catch(console.error);
    lessonsApi.getTeachers().then(setTeachers).catch(console.error);
  }, [studentId]);

  // Fetch lessons
  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const data = await lessonsApi.getSchedule(
        formatDateISO(weekStart),
        formatDateISOEnd(weekEnd),
        undefined,
        studentId
      );
      setLessons(data);
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchLessons();
  }, [weekStart, weekEnd, studentId]);

  // Cell click → create lesson
  const handleCellClick = (dayIndex: number, hour: number) => {
    const date = getDateForDay(dayIndex);
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    setPrefillDate(dateStr);
    setPrefillTime(timeStr);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setPrefillDate(undefined);
    setPrefillTime(undefined);
  };

  const handleCreateLesson = async (data: LessonFormData) => {
    if (!data.teacher_id) throw new Error("Teacher ID is required");
    await lessonsApi.createLesson({
      title: data.title,
      teacher_id: data.teacher_id,
      lesson_type_id: data.lesson_type_id,
      scheduled_at: data.scheduled_at,
      duration_minutes: data.duration_minutes,
      meeting_url: data.meeting_url,
      group_id: data.group_id,
      student_ids: data.student_ids,
    });
    fetchLessons();
  };

  // Week navigation
  const goToPrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goToNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToToday = () => setCurrentDate(new Date());

  // Helpers
  const getDateForDay = (dayIndex: number): Date => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    return d;
  };

  const isToday = (dayIndex: number): boolean => {
    const d = getDateForDay(dayIndex);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const getLessonsForSlot = (dayIndex: number, hour: number): ScheduleLesson[] => {
    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayIndex);
    return lessons.filter((lesson) => {
      const ld = new Date(lesson.scheduled_at);
      return ld.getDate() === slotDate.getDate() && ld.getMonth() === slotDate.getMonth() && ld.getHours() === hour;
    });
  };

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Загрузка...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/users")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={student.name} photo={student.photo_url} size="lg" />
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{student.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{student.email}</span>
            {student.phone && <span>{student.phone}</span>}
            <span className="font-medium text-gray-700">Баланс: {Number(student.balance).toLocaleString()} тг</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-medium text-gray-700">
          {formatDateRange(weekStart, weekEnd)}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать урок
          </button>
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
            <button onClick={goToPrevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Сегодня
            </button>
            <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-16 p-3 border-b border-r border-gray-100 bg-gray-50 text-gray-500 text-sm font-medium">
                    Время
                  </th>
                  {WEEKDAYS.map((day, index) => (
                    <th
                      key={day}
                      className={`p-3 border-b border-r border-gray-100 text-center min-w-[120px] ${
                        isToday(index) ? "bg-cyan-50" : "bg-gray-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-500">{day}</div>
                      <div className={`text-lg font-semibold ${isToday(index) ? "text-cyan-600" : "text-gray-800"}`}>
                        {getDateForDay(index).getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time, timeIndex) => (
                  <tr key={time}>
                    <td className="p-2 border-b border-r border-gray-100 bg-gray-50 text-center text-sm text-gray-500 font-medium">
                      {time}
                    </td>
                    {WEEKDAYS.map((_, dayIndex) => {
                      const slotLessons = getLessonsForSlot(dayIndex, timeIndex);
                      return (
                        <td
                          key={dayIndex}
                          className={`p-1 border-b border-r border-gray-100 align-top h-16 cursor-pointer hover:bg-gray-50 transition-colors ${
                            isToday(dayIndex) ? "bg-cyan-50/30" : ""
                          }`}
                          onClick={() => handleCellClick(dayIndex, timeIndex)}
                        >
                          {slotLessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className={`text-xs p-1.5 rounded-lg mb-1 border cursor-pointer truncate hover:shadow-md transition-shadow ${statusColors[lesson.status]}`}
                              title={`${lesson.title} - ${lesson.teacher_name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLessonId(lesson.id);
                              }}
                            >
                              <div className="font-medium truncate">{lesson.title}</div>
                              <div className="truncate opacity-80">{lesson.teacher_name}</div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status legend */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span className="font-medium">Статусы:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-200 border border-cyan-300"></div>
          <span>Запланирован</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
          <span>Завершён</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300"></div>
          <span>Отменён</span>
        </div>
      </div>

      {/* Create lesson modal */}
      {showCreateModal && (
        <LessonCreateModal
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateLesson}
          onBatchSubmit={() => fetchLessons()}
          teachers={teachers}
          prefillDate={prefillDate}
          prefillTime={prefillTime}
          prefillStudentIds={[studentId]}
        />
      )}

      {/* Lesson detail modal */}
      {selectedLessonId && (
        <LessonDetailModal
          lessonId={selectedLessonId}
          onClose={() => setSelectedLessonId(null)}
          onUpdate={fetchLessons}
        />
      )}
    </div>
  );
}
