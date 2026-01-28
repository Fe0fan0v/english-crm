import { useState, useEffect, useMemo } from "react";
import { lessonTypesApi, groupsApi, usersApi, lessonsApi, teacherApi } from "../services/api";
import SearchableSelect, { type SearchableSelectOption } from "./SearchableSelect";
import type { LessonType, Group, User, LessonBatchResponse } from "../types";
import { useAuthStore } from "../store/authStore";

interface LessonCreateModalProps {
  onClose: () => void;
  onSubmit: (data: LessonFormData) => Promise<void>;
  onBatchSubmit?: (result: LessonBatchResponse) => void; // Callback after batch creation
  teacherId?: number; // Pre-selected teacher (for teacher dashboard)
  teachers?: User[]; // List of teachers (for admin/manager)
  prefillDate?: string; // Pre-fill date (YYYY-MM-DD)
  prefillTime?: string; // Pre-fill time (HH:mm)
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

// Weekday configuration
const WEEKDAYS = [
  { key: "monday", label: "Пн", fullLabel: "Понедельник" },
  { key: "tuesday", label: "Вт", fullLabel: "Вторник" },
  { key: "wednesday", label: "Ср", fullLabel: "Среда" },
  { key: "thursday", label: "Чт", fullLabel: "Четверг" },
  { key: "friday", label: "Пт", fullLabel: "Пятница" },
  { key: "saturday", label: "Сб", fullLabel: "Суббота" },
  { key: "sunday", label: "Вс", fullLabel: "Воскресенье" },
];

// Helper to generate preview dates
function generatePreviewDates(
  startDate: string,
  weekdays: string[],
  weeks: number,
  time: string
): Date[] {
  if (!startDate || weekdays.length === 0) return [];

  const WEEKDAY_MAP: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };

  const dates: Date[] = [];
  const baseDate = new Date(startDate);
  const [hours, minutes] = time.split(":").map(Number);

  for (const weekdayName of weekdays) {
    const weekdayNum = WEEKDAY_MAP[weekdayName];
    if (weekdayNum === undefined) continue;

    // Find first occurrence of this weekday on or after start_date
    const baseDayOfWeek = baseDate.getDay();
    const daysUntilWeekday = (weekdayNum - baseDayOfWeek + 7) % 7;

    for (let week = 0; week < weeks; week++) {
      const lessonDate = new Date(baseDate);
      lessonDate.setDate(baseDate.getDate() + daysUntilWeekday + week * 7);
      lessonDate.setHours(hours, minutes, 0, 0);
      dates.push(lessonDate);
    }
  }

  // Sort by date
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

export default function LessonCreateModal({
  onClose,
  onSubmit,
  onBatchSubmit,
  teacherId,
  teachers,
  prefillDate,
  prefillTime,
}: LessonCreateModalProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(teacherId);
  const [lessonTypeId, setLessonTypeId] = useState<number | "">("");
  const [scheduledDate, setScheduledDate] = useState(prefillDate || "");
  const [scheduledTime, setScheduledTime] = useState(prefillTime || "10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Recurring lessons state
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [weeksCount, setWeeksCount] = useState(4);

  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchResult, setBatchResult] = useState<LessonBatchResponse | null>(null);
  const { user } = useAuthStore();

  // Load lesson types, groups, and students
  useEffect(() => {
    const loadData = async () => {
      try {
        const lessonTypesRes = await lessonTypesApi.list();
        setLessonTypes(lessonTypesRes.items);

        // If teacher is creating lesson, load only their students and groups
        if (user?.role === "teacher") {
          const [myStudents, myGroups] = await Promise.all([
            teacherApi.getMyStudentsForLessons(),
            teacherApi.getMyGroupsForLessons(),
          ]);
          setStudents(myStudents);
          setGroups(myGroups);
        } else {
          // Admin/Manager can see all students
          const studentsRes = await usersApi.list(1, 100, undefined, "student");
          setStudents(studentsRes.items);

          // Load groups for the selected teacher
          if (selectedTeacherId) {
            const groupsRes = await groupsApi.list(1, 100, undefined, selectedTeacherId);
            setGroups(groupsRes.items);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Не удалось загрузить данные");
      }
    };
    loadData();
  }, [selectedTeacherId, user?.role]);

  // When group is selected, load its students
  useEffect(() => {
    if (groupId !== null) {
      const loadGroupStudents = async () => {
        try {
          const group = await groupsApi.get(groupId);
          setSelectedStudentIds(group.students.map((s) => s.student_id));
        } catch (err) {
          console.error("Failed to load group students:", err);
        }
      };
      loadGroupStudents();
    }
  }, [groupId]);

  // Convert teachers to SearchableSelect options
  const teacherOptions: SearchableSelectOption[] = useMemo(() => {
    if (!teachers) return [];
    return teachers.map((teacher) => ({
      value: teacher.id,
      label: teacher.name,
      description: teacher.email,
    }));
  }, [teachers]);

  // Convert groups to SearchableSelect options
  const groupOptions: SearchableSelectOption[] = useMemo(() => {
    return groups.map((group) => ({
      value: group.id,
      label: group.name,
      description: `${group.students_count} уч.`,
    }));
  }, [groups]);

  // Convert students to SearchableSelect options
  const studentOptions: SearchableSelectOption[] = useMemo(() => {
    return students.map((student) => ({
      value: student.id,
      label: student.name,
      description: student.phone ? `${student.email} • ${student.phone}` : student.email,
    }));
  }, [students]);

  // Generate preview dates for recurring lessons
  const previewDates = useMemo(() => {
    if (!isRecurring) return [];
    return generatePreviewDates(scheduledDate, selectedWeekdays, weeksCount, scheduledTime);
  }, [isRecurring, scheduledDate, selectedWeekdays, weeksCount, scheduledTime]);

  // Toggle weekday selection
  const toggleWeekday = (weekday: string) => {
    setSelectedWeekdays((prev) =>
      prev.includes(weekday)
        ? prev.filter((w) => w !== weekday)
        : [...prev, weekday]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBatchResult(null);

    if (!lessonTypeId) {
      setError("Выберите тип урока");
      return;
    }
    if (!scheduledDate) {
      setError("Выберите дату начала");
      return;
    }
    if (!teacherId && !selectedTeacherId) {
      setError("Выберите преподавателя");
      return;
    }
    if (selectedStudentIds.length === 0 && groupId === null) {
      setError("Выберите хотя бы одного ученика или группу");
      return;
    }

    // Recurring mode validations
    if (isRecurring) {
      if (selectedWeekdays.length === 0) {
        setError("Выберите хотя бы один день недели");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRecurring) {
        // Batch creation
        const result = await lessonsApi.createLessonsBatch({
          teacher_id: selectedTeacherId!,
          lesson_type_id: Number(lessonTypeId),
          weekdays: selectedWeekdays,
          time: scheduledTime,
          start_date: scheduledDate,
          weeks: weeksCount,
          duration_minutes: durationMinutes,
          group_id: groupId !== null ? groupId : undefined,
          student_ids: selectedStudentIds,
        });
        setBatchResult(result);
        onBatchSubmit?.(result);
        // Don't close if there were conflicts - show results
        if (result.conflicts.length === 0) {
          onClose();
        }
      } else {
        // Single lesson creation
        const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
        const selectedLessonType = lessonTypes.find((t) => t.id === Number(lessonTypeId));
        const title = selectedLessonType?.name || "Урок";
        await onSubmit({
          title,
          teacher_id: selectedTeacherId,
          lesson_type_id: Number(lessonTypeId),
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          group_id: groupId !== null ? groupId : undefined,
          student_ids: selectedStudentIds,
        });
        onClose();
      }
    } catch (err: unknown) {
      console.error("Failed to create lesson:", err);
      const errorMessage = err instanceof Error ? err.message : "Не удалось создать урок";
      // Try to extract error detail from axios response
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync scheduledDate with prefillDate prop
  useEffect(() => {
    if (prefillDate) {
      setScheduledDate(prefillDate);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, "0")}-${tomorrow.getDate().toString().padStart(2, "0")}`;
      setScheduledDate(dateStr);
    }
  }, [prefillDate]);

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
            {/* Teacher (for admin/manager) */}
            {teachers && !teacherId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Преподаватель *
                </label>
                <SearchableSelect
                  options={teacherOptions}
                  value={selectedTeacherId ?? null}
                  onChange={(val) => setSelectedTeacherId(val as number | undefined)}
                  placeholder="Выберите преподавателя"
                />
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

            {/* Recurring toggle */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 transition-colors">
                  <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                </div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  Расписание на несколько недель
                </span>
              </label>
            </div>

            {/* Date, Time and Duration */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRecurring ? "Дата начала *" : "Дата *"}
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

            {/* Recurring options */}
            {isRecurring && (
              <>
                {/* Weekday selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дни недели *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleWeekday(day.key)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          selectedWeekdays.includes(day.key)
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                        }`}
                        title={day.fullLabel}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weeks count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Количество недель
                  </label>
                  <select
                    value={weeksCount}
                    onChange={(e) => setWeeksCount(Number(e.target.value))}
                    className="input w-full"
                  >
                    <option value={1}>1 неделя</option>
                    <option value={2}>2 недели</option>
                    <option value={3}>3 недели</option>
                    <option value={4}>4 недели</option>
                    <option value={6}>6 недель</option>
                    <option value={8}>8 недель</option>
                    <option value={12}>12 недель</option>
                  </select>
                </div>

                {/* Preview dates */}
                {previewDates.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 mb-2">
                      Будет создано {previewDates.length} уроков:
                    </div>
                    <div className="max-h-32 overflow-y-auto text-sm text-blue-700 space-y-1">
                      {previewDates.map((date, index) => (
                        <div key={index}>
                          {date.toLocaleDateString("ru-RU", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          в {scheduledTime}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Группа (опционально)
              </label>
              <SearchableSelect
                options={groupOptions}
                value={groupId}
                onChange={(val) => setGroupId(val as number | null)}
                placeholder="Без группы (индивидуальный)"
              />
            </div>

            {/* Students */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ученики {groupId !== null ? "(из группы)" : "*"}
              </label>
              <SearchableSelect
                options={studentOptions}
                value={selectedStudentIds}
                onChange={(val) => setSelectedStudentIds(val as number[])}
                placeholder="Выберите учеников"
                multiSelect
              />
            </div>

            {/* Batch result */}
            {batchResult && (
              <div className="space-y-3">
                {batchResult.created.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      Создано уроков: {batchResult.created.length}
                    </div>
                    <div className="text-sm text-green-700">
                      Уроки успешно добавлены в расписание
                    </div>
                  </div>
                )}
                {batchResult.conflicts.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-sm font-medium text-yellow-800 mb-2">
                      Не удалось создать {batchResult.conflicts.length} уроков:
                    </div>
                    <div className="max-h-32 overflow-y-auto text-sm text-yellow-700 space-y-1">
                      {batchResult.conflicts.map((conflict, index) => (
                        <div key={index}>
                          {new Date(conflict.date).toLocaleDateString("ru-RU", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}: {conflict.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              {batchResult ? "Закрыть" : "Отмена"}
            </button>
            {!batchResult && (
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary flex-1"
              >
                {isLoading
                  ? "Создание..."
                  : isRecurring
                    ? `Создать ${previewDates.length} уроков`
                    : "Создать урок"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
