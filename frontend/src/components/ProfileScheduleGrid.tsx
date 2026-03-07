import { useState, useEffect, useMemo } from "react";
import { lessonsApi, teacherApi } from "../services/api";
import type { ScheduleLesson, TeacherAvailability } from "../types";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-cyan-100 border-l-4 border-cyan-500 text-cyan-800",
  completed: "bg-green-100 border-l-4 border-green-500 text-green-800",
  cancelled: "bg-red-100 border-l-4 border-red-500 text-red-800",
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface ProfileScheduleGridProps {
  userId: number;
  role: "student" | "teacher";
}

export default function ProfileScheduleGrid({
  userId,
  role,
}: ProfileScheduleGridProps) {
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
  const [loading, setLoading] = useState(false);

  const weekStart = useMemo(() => getWeekStart(currentWeek), [currentWeek]);
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekEnd = weekDates[6];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const from = formatLocal(weekDates[0]) + "T00:00:00";
        const to = formatLocal(weekDates[6]) + "T23:59:59";
        const data = await lessonsApi.getSchedule(
          from,
          to,
          role === "teacher" ? userId : undefined,
          role === "student" ? userId : undefined
        );
        setLessons(data);

        if (role === "teacher") {
          try {
            const av = await teacherApi.getAvailabilityByTeacherId(userId);
            setAvailability(av.items || []);
          } catch {
            setAvailability([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, role, weekStart]);

  const getLessonsForSlot = (date: Date, hour: number): ScheduleLesson[] => {
    return lessons.filter((l) => {
      const d = new Date(l.scheduled_at);
      return (
        d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getHours() === hour
      );
    });
  };

  const isWithinAvailability = (date: Date, hour: number): boolean => {
    if (role !== "teacher" || availability.length === 0) return false;
    const dayNames: Record<number, string> = {
      0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
      4: "thursday", 5: "friday", 6: "saturday",
    };
    const dayName = dayNames[date.getDay()];
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    return availability.some(
      (slot) => slot.day_of_week === dayName && timeStr >= slot.start_time && timeStr < slot.end_time
    );
  };

  // Auto-detect hour range from lessons and availability
  const { startHour, endHour } = useMemo(() => {
    let min = 8;
    let max = 20;
    for (const l of lessons) {
      const h = new Date(l.scheduled_at).getHours();
      if (h < min) min = h;
      if (h >= max) max = h + 1;
    }
    for (const a of availability) {
      const sh = parseInt(a.start_time.split(":")[0]);
      const eh = parseInt(a.end_time.split(":")[0]);
      if (sh < min) min = sh;
      if (eh > max) max = eh;
    }
    return { startHour: min, endHour: max };
  }, [lessons, availability]);

  const timeSlots = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const goToPrevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const goToNextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Расписание</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium text-sm">
            {weekStart.getDate()} {MONTHS[weekStart.getMonth()]} —{" "}
            {weekEnd.getDate()} {MONTHS[weekEnd.getMonth()]} {weekEnd.getFullYear()}
          </span>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto schedule-scroll">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="w-14 p-2 text-left text-xs text-gray-500 border-b" />
                {weekDates.map((date, i) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th
                      key={i}
                      className={`p-2 text-center border-b min-w-[110px] ${isToday ? "bg-cyan-50" : ""}`}
                    >
                      <div className="text-xs text-gray-500">{WEEKDAYS[i]}</div>
                      <div className={`text-sm font-medium ${isToday ? "text-cyan-600" : ""}`}>
                        {date.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((hour) => (
                <tr key={hour} className="border-b border-gray-100">
                  <td className="p-2 text-xs text-gray-400 align-top">{hour}:00</td>
                  {weekDates.map((date, dayIndex) => {
                    const slotLessons = getLessonsForSlot(date, hour);
                    const avail = isWithinAvailability(date, hour);
                    return (
                      <td
                        key={dayIndex}
                        className={`p-1 align-top ${avail ? "bg-green-50" : ""}`}
                      >
                        {slotLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className={`rounded px-2 py-1 mb-1 text-xs ${STATUS_COLORS[lesson.status] || "bg-gray-100 text-gray-700"}`}
                          >
                            <div className="font-medium truncate">
                              {new Date(lesson.scheduled_at).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              {lesson.lesson_type_name}
                            </div>
                            <div className="truncate opacity-75">
                              {role === "student"
                                ? lesson.teacher_name
                                : lesson.student_names?.join(", ") ||
                                  (lesson.group_name ? `Гр: ${lesson.group_name}` : "")}
                            </div>
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3 pt-3 border-t">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-cyan-100 rounded border-l-2 border-cyan-500" />
          <span>Запланирован</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 rounded border-l-2 border-green-500" />
          <span>Завершён</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 rounded border-l-2 border-red-500" />
          <span>Отменён</span>
        </div>
        {role === "teacher" && availability.length > 0 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
            <div className="w-3 h-3 bg-green-50 rounded border border-green-200" />
            <span>Рабочее время</span>
          </div>
        )}
      </div>
    </div>
  );
}
