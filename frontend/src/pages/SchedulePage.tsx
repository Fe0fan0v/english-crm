import { useEffect, useState, useMemo } from "react";
import { lessonsApi } from "../services/api";
import type { ScheduleLesson, User } from "../types";
import LessonCreateModal, { type LessonFormData } from "../components/LessonCreateModal";
import LessonDetailModal from "../components/LessonDetailModal";

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
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

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0] + "T00:00:00";
}

function formatDateISOEnd(date: Date): string {
  return date.toISOString().split("T")[0] + "T23:59:59";
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${9 + i}:00`); // 9:00 - 19:00

// Status colors
const statusColors: Record<string, string> = {
  scheduled: "bg-cyan-100 border-cyan-300 text-cyan-700",
  completed: "bg-green-100 border-green-300 text-green-700",
  cancelled: "bg-red-100 border-red-300 text-red-700",
  no_show: "bg-yellow-100 border-yellow-300 text-yellow-700",
};

interface DayModalProps {
  date: Date;
  lessons: ScheduleLesson[];
  onClose: () => void;
  onLessonClick: (lessonId: number) => void;
}

function DayModal({ date, lessons, onClose, onLessonClick }: DayModalProps) {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const weekdayNames = [
    "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {date.getDate()} {months[date.getMonth()]}
              </h2>
              <p className="text-sm text-gray-500">{weekdayNames[date.getDay()]}</p>
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

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          {lessons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет уроков на этот день</p>
          ) : (
            <div className="space-y-3">
              {lessons
                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                .map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${statusColors[lesson.status]}`}
                    onClick={() => onLessonClick(lesson.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{lesson.title}</div>
                        <div className="text-sm opacity-80 mt-1">
                          {new Date(lesson.scheduled_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" • "}
                          {lesson.lesson_type_name}
                        </div>
                        <div className="text-sm opacity-80">
                          Учитель: {lesson.teacher_name}
                        </div>
                        {lesson.students_count > 0 && (
                          <div className="text-sm opacity-80">
                            Учеников: {lesson.students_count}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs px-2 py-1 rounded-md bg-white/50">
                          {lesson.status === "scheduled" && "Запланирован"}
                          {lesson.status === "completed" && "Завершён"}
                          {lesson.status === "cancelled" && "Отменён"}
                          {lesson.status === "no_show" && "Неявка"}
                        </div>
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();

  // Handle cell click to create lesson with prefilled date/time
  const handleCellClick = (dayIndex: number, hour: number) => {
    const date = getDateForDay(dayIndex);
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    setPrefillDate(dateStr);
    setPrefillTime(timeStr);
    setShowCreateModal(true);
  };

  // Close create modal and reset prefill
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setPrefillDate(undefined);
    setPrefillTime(undefined);
  };

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);

  // Load teachers
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const data = await lessonsApi.getTeachers();
        setTeachers(data);
      } catch (error) {
        console.error("Failed to fetch teachers:", error);
      }
    };
    loadTeachers();
  }, []);

  // Fetch lessons function
  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const data = await lessonsApi.getSchedule(
        formatDateISO(weekStart),
        formatDateISOEnd(weekEnd),
        selectedTeacherId
      );
      setLessons(data);
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load lessons
  useEffect(() => {
    fetchLessons();
  }, [weekStart, weekEnd, selectedTeacherId]);

  // Handle create lesson
  const handleCreateLesson = async (data: LessonFormData) => {
    if (!data.teacher_id) {
      throw new Error("Teacher ID is required");
    }
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
    fetchLessons(); // Refresh the schedule
  };

  // Navigate weeks
  const goToPrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get lessons for specific day and hour
  const getLessonsForSlot = (dayIndex: number, hour: number): ScheduleLesson[] => {
    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayIndex);

    return lessons.filter((lesson) => {
      const lessonDate = new Date(lesson.scheduled_at);
      return (
        lessonDate.getDate() === slotDate.getDate() &&
        lessonDate.getMonth() === slotDate.getMonth() &&
        lessonDate.getHours() === hour
      );
    });
  };

  // Get lessons for a day
  const getLessonsForDay = (dayIndex: number): ScheduleLesson[] => {
    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayIndex);

    return lessons.filter((lesson) => {
      const lessonDate = new Date(lesson.scheduled_at);
      return (
        lessonDate.getDate() === slotDate.getDate() &&
        lessonDate.getMonth() === slotDate.getMonth()
      );
    });
  };

  // Get date for day index
  const getDateForDay = (dayIndex: number): Date => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    return d;
  };

  // Check if date is today
  const isToday = (dayIndex: number): boolean => {
    const d = getDateForDay(dayIndex);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Handle day click
  const handleDayClick = (dayIndex: number) => {
    setSelectedDate(getDateForDay(dayIndex));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Расписание</h1>

        <div className="flex items-center gap-4">
          {/* Create lesson button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать урок
          </button>

          {/* Teacher filter */}
          <select
            value={selectedTeacherId || ""}
            onChange={(e) => setSelectedTeacherId(e.target.value ? Number(e.target.value) : undefined)}
            className="input w-48"
          >
            <option value="">Все учителя</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>

          {/* Week navigation */}
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
            <button
              onClick={goToPrevWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Сегодня
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Date range display */}
      <div className="text-lg font-medium text-gray-700 mb-4">
        {formatDateRange(weekStart, weekEnd)}
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
                      className={`p-3 border-b border-r border-gray-100 text-center min-w-[120px] cursor-pointer hover:bg-gray-50 transition-colors ${
                        isToday(index) ? "bg-cyan-50" : "bg-gray-50"
                      }`}
                      onClick={() => handleDayClick(index)}
                    >
                      <div className="text-sm font-medium text-gray-500">{day}</div>
                      <div className={`text-lg font-semibold ${
                        isToday(index) ? "text-cyan-600" : "text-gray-800"
                      }`}>
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
                      const slotLessons = getLessonsForSlot(dayIndex, 9 + timeIndex);
                      const hour = 9 + timeIndex;
                      return (
                        <td
                          key={dayIndex}
                          className={`p-1 border-b border-r border-gray-100 align-top h-16 cursor-pointer hover:bg-gray-50 transition-colors ${
                            isToday(dayIndex) ? "bg-cyan-50/30" : ""
                          }`}
                          onClick={() => handleCellClick(dayIndex, hour)}
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
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300"></div>
          <span>Неявка</span>
        </div>
      </div>

      {/* Day details modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          lessons={getLessonsForDay(
            Math.round((selectedDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
          )}
          onClose={() => setSelectedDate(null)}
          onLessonClick={(lessonId) => {
            setSelectedDate(null);
            setSelectedLessonId(lessonId);
          }}
        />
      )}

      {/* Create lesson modal */}
      {showCreateModal && (
        <LessonCreateModal
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateLesson}
          teachers={teachers}
          prefillDate={prefillDate}
          prefillTime={prefillTime}
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
