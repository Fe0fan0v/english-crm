import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { teacherApi, usersApi, lessonsApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import Avatar from "../components/Avatar";
import AttendanceModal from "../components/AttendanceModal";
import GroupChat from "../components/GroupChat";
import LessonCreateModal, { type LessonFormData } from "../components/LessonCreateModal";
import TeacherAvailabilityEditor from "../components/TeacherAvailabilityEditor";
import type {
  TeacherDashboardResponse,
  TeacherLesson,
  TeacherStudentInfo,
  TeacherAvailability,
  User,
} from "../types";

type TabType = "info" | "groups" | "students" | "availability" | "materials";

// Icons
const StatIcon = {
  lessons: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  ),
  workload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const startOfWeek = new Date(baseDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const timeSlots = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export default function TeacherDashboardPage() {
  const { id: teacherIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  // If viewing another teacher (manager mode)
  const isManagerView = !!teacherIdParam;
  const teacherId = teacherIdParam ? parseInt(teacherIdParam) : undefined;

  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [schedule, setSchedule] = useState<TeacherLesson[]>([]);
  const [students, setStudents] = useState<TeacherStudentInfo[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<TeacherLesson | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);

  // Check if current user can create lessons (only admin/manager can create lessons)
  const canCreateLesson = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Handle cell click to create lesson with prefilled date/time
  const handleCellClick = (date: Date, hour: number) => {
    if (!canCreateLesson) return;
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    setPrefillDate(dateStr);
    setPrefillTime(timeStr);
    setShowCreateLessonModal(true);
  };

  // Close create modal and reset prefill
  const handleCloseCreateModal = () => {
    setShowCreateLessonModal(false);
    setPrefillDate(undefined);
    setPrefillTime(undefined);
  };

  // Determine which user to display
  const displayUser = isManagerView ? teacher : currentUser;

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isManagerView && teacherId) {
          // Manager viewing teacher - fetch teacher data
          const teacherData = await usersApi.get(teacherId);
          setTeacher(teacherData);
          const response = await teacherApi.getDashboardByTeacherId(teacherId);
          setData(response);
        } else {
          // Teacher viewing own dashboard
          const response = await teacherApi.getDashboard();
          setData(response);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isManagerView, teacherId]);

  useEffect(() => {
    const fetchSchedule = async () => {
      const dateFrom = weekDates[0].toISOString();
      const dateTo = weekDates[6].toISOString();
      try {
        const lessons = isManagerView && teacherId
          ? await teacherApi.getScheduleByTeacherId(teacherId, dateFrom, dateTo)
          : await teacherApi.getSchedule(dateFrom, dateTo);
        setSchedule(lessons);
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      }
    };
    fetchSchedule();
  }, [weekDates, isManagerView, teacherId]);

  useEffect(() => {
    if (activeTab === "students") {
      const fetchStudents = async () => {
        try {
          const result = isManagerView && teacherId
            ? await teacherApi.getStudentsByTeacherId(teacherId)
            : await teacherApi.getStudents();
          setStudents(result);
        } catch (error) {
          console.error("Failed to fetch students:", error);
        }
      };
      fetchStudents();
    }
  }, [activeTab, isManagerView, teacherId]);

  // Load teacher availability
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const data = isManagerView && teacherId
          ? await teacherApi.getAvailabilityByTeacherId(teacherId)
          : await teacherApi.getAvailability();
        setAvailability(data.items);
      } catch (error) {
        console.error("Failed to fetch availability:", error);
      }
    };
    fetchAvailability();
  }, [isManagerView, teacherId]);

  const handleLessonClick = (lesson: TeacherLesson) => {
    setSelectedLesson(lesson);
    setShowAttendanceModal(true);
  };

  // Refresh schedule helper
  const refreshSchedule = async () => {
    const dateFrom = weekDates[0].toISOString();
    const dateTo = weekDates[6].toISOString();
    const lessons = isManagerView && teacherId
      ? await teacherApi.getScheduleByTeacherId(teacherId, dateFrom, dateTo)
      : await teacherApi.getSchedule(dateFrom, dateTo);
    setSchedule(lessons);
  };

  const handleAttendanceSave = async () => {
    setShowAttendanceModal(false);
    await refreshSchedule();
    // Refresh dashboard
    const response = isManagerView && teacherId
      ? await teacherApi.getDashboardByTeacherId(teacherId)
      : await teacherApi.getDashboard();
    setData(response);
    // Refresh teacher data if manager view
    if (isManagerView && teacherId) {
      const teacherData = await usersApi.get(teacherId);
      setTeacher(teacherData);
    }
  };

  const handleCreateLesson = async (formData: LessonFormData) => {
    if (isManagerView && teacherId) {
      // Admin/manager creating lesson for teacher - use lessonsApi
      await lessonsApi.createLesson({
        title: formData.title,
        lesson_type_id: formData.lesson_type_id,
        teacher_id: teacherId,
        scheduled_at: formData.scheduled_at,
        duration_minutes: formData.duration_minutes,
        meeting_url: formData.meeting_url,
        group_id: formData.group_id,
        student_ids: formData.student_ids,
      });
    } else {
      // Teacher creating own lesson
      await teacherApi.createLesson({
        title: formData.title,
        lesson_type_id: formData.lesson_type_id,
        scheduled_at: formData.scheduled_at,
        duration_minutes: formData.duration_minutes,
        meeting_url: formData.meeting_url,
        group_id: formData.group_id,
        student_ids: formData.student_ids,
      });
    }
    await refreshSchedule();
    // Also refresh dashboard to update stats
    const response = isManagerView && teacherId
      ? await teacherApi.getDashboardByTeacherId(teacherId)
      : await teacherApi.getDashboard();
    setData(response);
  };

  const getLessonsForSlot = (date: Date, hour: number): TeacherLesson[] => {
    return schedule.filter((lesson) => {
      const lessonDate = new Date(lesson.scheduled_at);
      return (
        lessonDate.getDate() === date.getDate() &&
        lessonDate.getMonth() === date.getMonth() &&
        lessonDate.getHours() === hour
      );
    });
  };

  // Check if hour is within teacher's availability for a given day
  const isWithinAvailability = (date: Date, hour: number): boolean => {
    const dayOfWeek = date.getDay();
    const dayNames: Record<number, string> = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };
    const dayName = dayNames[dayOfWeek];
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;

    return availability.some((slot) => {
      if (slot.day_of_week !== dayName) return false;
      return timeStr >= slot.start_time && timeStr < slot.end_time;
    });
  };

  const goToPrevWeek = () => {
    const prev = new Date(currentWeek);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeek(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + 7);
    setCurrentWeek(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  const stats = data?.stats;
  const groups = data?.groups || [];

  // If a group is selected for chat, show the chat view
  if (selectedGroupId) {
    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    return (
      <div className="h-[calc(100vh-120px)]">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setSelectedGroupId(null)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-gray-800">
            Чат группы: {selectedGroup?.name}
          </h2>
        </div>
        <GroupChat groupId={selectedGroupId} />
      </div>
    );
  }

  return (
    <div>
      {/* Back button for manager view */}
      {isManagerView && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>
      )}

      {/* Profile Header */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          <Avatar name={displayUser?.name || ""} photo={displayUser?.photo_url} size="xl" />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{displayUser?.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-gray-500">
                  {displayUser?.phone && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {displayUser.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {displayUser?.email}
                  </span>
                </div>
              </div>
              {/* Balance */}
              <div className="text-right">
                <p className="text-sm text-gray-500">Баланс</p>
                <p
                  className={`text-2xl font-bold ${
                    parseFloat(displayUser?.balance || "0") >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {parseFloat(displayUser?.balance || "0").toLocaleString("ru-RU")} тг
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "info" as TabType, label: "Учитель" },
          { key: "groups" as TabType, label: "Группы" },
          { key: "students" as TabType, label: "Ученики" },
          { key: "availability" as TabType, label: "Свободное время" },
          { key: "materials" as TabType, label: "Личные материалы" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab ${activeTab === tab.key ? "tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                {StatIcon.lessons}
              </div>
              <div>
                <p className="text-sm text-gray-500">Проведено уроков</p>
                <p className="text-2xl font-bold text-gray-800">{stats?.lessons_conducted || 0}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                {StatIcon.workload}
              </div>
              <div>
                <p className="text-sm text-gray-500">Загруженность</p>
                <p className="text-2xl font-bold text-gray-800">{stats?.workload_percentage || 0}%</p>
              </div>
            </div>
          </div>

          {/* Schedule Calendar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Расписание уроков</h2>
              <div className="flex items-center gap-4">
                {canCreateLesson && (
                  <button
                    onClick={() => setShowCreateLessonModal(true)}
                    className="btn btn-primary btn-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Создать урок
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={goToPrevWeek} className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="font-medium">
                    {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                  </span>
                  <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 p-2 text-left text-xs text-gray-500 border-b"></th>
                    {weekDates.map((date, i) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <th
                          key={i}
                          className={`p-2 text-center border-b ${isToday ? "bg-cyan-50" : ""}`}
                        >
                          <div className="text-xs text-gray-500">{dayNames[i]}</div>
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
                      <td className="p-2 text-xs text-gray-500 align-top">{hour}:00</td>
                      {weekDates.map((date, dayIndex) => {
                        const lessons = getLessonsForSlot(date, hour);
                        const available = isWithinAvailability(date, hour);
                        return (
                          <td
                            key={dayIndex}
                            className={`p-1 align-top min-w-[120px] ${
                              available ? "bg-green-50" : ""
                            } ${canCreateLesson ? "cursor-pointer hover:bg-gray-100" : ""}`}
                            onClick={() => handleCellClick(date, hour)}
                          >
                            {lessons.map((lesson) => (
                              <button
                                key={lesson.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLessonClick(lesson);
                                }}
                                className={`w-full p-2 mb-1 rounded-lg text-left text-xs transition-colors ${
                                  lesson.status === "completed"
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : lesson.status === "cancelled"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                }`}
                              >
                                <div className="font-medium truncate">{lesson.title}</div>
                                <div className="text-[10px] opacity-75">
                                  {lesson.students.length} уч.
                                </div>
                              </button>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            {availability.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-50 rounded border border-green-200"></div>
                  <span>Свободен для занятий</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "groups" && (
        <div className="card">
          <h2 className="section-title mb-4">Мои группы</h2>
          {groups.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="p-4 bg-gray-50 rounded-xl text-left hover:bg-gray-100 transition-colors"
                >
                  <h3 className="font-medium text-gray-800">{group.name}</h3>
                  <p className="text-sm text-gray-500">{group.students_count} учеников</p>
                  <div className="flex items-center gap-1 mt-2 text-cyan-600 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Открыть чат
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">У вас пока нет групп</p>
          )}
        </div>
      )}

      {activeTab === "students" && (
        <div className="card">
          <h2 className="section-title mb-4">Мои ученики</h2>
          {students.length > 0 ? (
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                >
                  <Avatar name={student.name} size="md" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-500">{student.email}</p>
                    <p className="text-xs text-gray-400">
                      Группы: {student.group_names.join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">У вас пока нет учеников</p>
          )}
        </div>
      )}

      {activeTab === "availability" && (
        <div className="card">
          <h2 className="section-title mb-4">Моё свободное время</h2>
          <p className="text-sm text-gray-500 mb-4">
            Укажите когда вы свободны для проведения занятий. Это поможет менеджерам при планировании расписания.
          </p>
          <TeacherAvailabilityEditor readOnly={isManagerView} teacherId={teacherId} />
        </div>
      )}

      {activeTab === "materials" && (
        <div className="card">
          <h2 className="section-title mb-4">Личные материалы</h2>
          <p className="text-gray-500 text-center py-8">
            Функция в разработке
          </p>
        </div>
      )}

      {/* Attendance Modal */}
      {selectedLesson && (
        <AttendanceModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          lesson={selectedLesson}
          onSave={handleAttendanceSave}
        />
      )}

      {/* Create Lesson Modal */}
      {showCreateLessonModal && (
        <LessonCreateModal
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateLesson}
          teacherId={isManagerView && teacherId ? teacherId : currentUser?.id}
          prefillDate={prefillDate}
          prefillTime={prefillTime}
        />
      )}
    </div>
  );
}
