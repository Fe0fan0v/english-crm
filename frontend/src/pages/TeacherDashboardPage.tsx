import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { teacherApi, usersApi, lessonsApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import Avatar from "../components/Avatar";
import DirectChat, { ConversationList } from "../components/DirectChat";
import GroupChat from "../components/GroupChat";
import PhotoUpload from "../components/PhotoUpload";
import LessonCreateModal, { type LessonFormData } from "../components/LessonCreateModal";
import LessonDetailModal from "../components/LessonDetailModal";
import TeacherAvailabilityEditor from "../components/TeacherAvailabilityEditor";
import AttachMaterialModal from "../components/AttachMaterialModal";
import AttachCourseMaterialModal from "../components/AttachCourseMaterialModal";
import type {
  TeacherDashboardResponse,
  TeacherLesson,
  TeacherStudentInfo,
  TeacherAvailability,
  User,
  LessonWithMaterials,
} from "../types";

type TabType = "info" | "students" | "availability" | "materials" | "messages";

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
const timeSlots = Array.from({ length: 24 }, (_, i) => i); // 0:00 - 23:00

type LessonVisualStatus =
  | 'completed'    // Завершён (зелёный)
  | 'cancelled'    // Отменён (красный)
  | 'today'        // Сегодняшний (синий)
  | 'past'         // Прошедший, требует отметки (оранжевый)
  | 'upcoming';    // Будущий (жёлтый)

function getLessonVisualStatus(lesson: TeacherLesson): LessonVisualStatus {
  if (lesson.status === 'completed') return 'completed';
  if (lesson.status === 'cancelled') return 'cancelled';

  const now = new Date();
  const lessonDate = new Date(lesson.scheduled_at);
  const lessonEnd = new Date(lessonDate.getTime() + lesson.duration_minutes * 60 * 1000);

  const isToday = lessonDate.toDateString() === now.toDateString();
  const isPast = lessonEnd < now;

  if (isPast) return 'past';
  if (isToday) return 'today';
  return 'upcoming';
}

function getLessonStyles(status: LessonVisualStatus): string {
  const baseStyles = 'border-l-4 transition-all';

  switch (status) {
    case 'completed':
      return `${baseStyles} bg-green-100 text-green-700 hover:bg-green-200 border-green-500`;
    case 'cancelled':
      return `${baseStyles} bg-red-100 text-red-700 hover:bg-red-200 border-red-500`;
    case 'today':
      return `${baseStyles} bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-500 ring-2 ring-blue-300`;
    case 'past':
      return `${baseStyles} bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-500`;
    case 'upcoming':
      return `${baseStyles} bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-500`;
  }
}

function getLessonStatusLabel(status: LessonVisualStatus): string {
  const labels = {
    completed: 'Завершён',
    cancelled: 'Отменён',
    today: 'Сегодня',
    past: 'Требует отметки',
    upcoming: 'Предстоит'
  };
  return labels[status];
}

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
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [chatPartner, setChatPartner] = useState<{ id: number; name: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
  const [lessonsWithMaterials, setLessonsWithMaterials] = useState<LessonWithMaterials[]>([]);
  const [selectedLessonForMaterial, setSelectedLessonForMaterial] = useState<number | null>(null);
  const [selectedLessonForCourseMaterial, setSelectedLessonForCourseMaterial] = useState<number | null>(null);
  const [lessonsFilter, setLessonsFilter] = useState<{ type: 'student' | 'group'; id: number; name: string } | null>(null);
  const [studentSearchFilter, setStudentSearchFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Check if current user can create lessons
  // Teachers can create lessons in their own dashboard
  // Admins/managers can create lessons when viewing other teachers
  const canCreateLesson = !isManagerView || currentUser?.role === "admin" || currentUser?.role === "manager";

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
          setPhotoUrl(teacherData.photo_url);
          const response = await teacherApi.getDashboardByTeacherId(teacherId);
          setData(response);
        } else {
          // Teacher viewing own dashboard
          setPhotoUrl(currentUser?.photo_url || null);
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
  }, [isManagerView, teacherId, currentUser?.photo_url]);

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
          setStudentsLoading(true);
          setStudentsError(null);

          console.log('Fetching students...', { isManagerView, teacherId });

          const result = isManagerView && teacherId
            ? await teacherApi.getStudentsByTeacherId(teacherId)
            : await teacherApi.getStudents();

          console.log('Students loaded:', result.length);
          setStudents(result);
        } catch (error) {
          console.error("Failed to fetch students:", error);
          const errorMessage = error instanceof Error
            ? error.message
            : 'Не удалось загрузить список учеников';
          setStudentsError(errorMessage);
        } finally {
          setStudentsLoading(false);
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

  // Load lessons with materials when materials tab is active
  useEffect(() => {
    if (activeTab === "materials") {
      const fetchLessonsWithMaterials = async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch("/api/teacher/lessons-with-materials", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          setLessonsWithMaterials(data);
        } catch (error) {
          console.error("Failed to fetch lessons with materials:", error);
        }
      };
      fetchLessonsWithMaterials();
    }
  }, [activeTab]);

  const handleLessonClick = (lesson: TeacherLesson) => {
    setSelectedLessonId(lesson.id);
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
    setSelectedLessonId(null);
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
          <PhotoUpload
            userId={displayUser?.id || 0}
            userName={displayUser?.name || ""}
            currentPhotoUrl={photoUrl}
            onPhotoUpdated={setPhotoUrl}
            size="xl"
            canEdit={!isManagerView || canCreateLesson}
          />
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
          { key: "students" as TabType, label: "Ученики" },
          { key: "availability" as TabType, label: "Свободное время" },
          { key: "materials" as TabType, label: "Уроки" },
          { key: "messages" as TabType, label: "Сообщения" },
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
                            {lessons.map((lesson) => {
                              const visualStatus = getLessonVisualStatus(lesson);
                              const statusLabel = getLessonStatusLabel(visualStatus);

                              return (
                                <button
                                  key={lesson.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLessonClick(lesson);
                                  }}
                                  className={`w-full p-2 mb-1 rounded-lg text-left text-xs ${getLessonStyles(visualStatus)}`}
                                  title={statusLabel}
                                >
                                  <div className="font-medium truncate flex items-center justify-between">
                                    <span>{lesson.title}</span>
                                    {visualStatus === 'past' && (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="text-[10px] opacity-75 flex justify-between">
                                    <span>{lesson.students.length} уч.</span>
                                    <span className="uppercase font-semibold">{statusLabel}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-4 pt-4 border-t">
              <span className="font-medium">Статусы:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 rounded border-l-4 border-green-500"></div>
                <span>Завершён</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 rounded border-l-4 border-blue-500"></div>
                <span>Сегодня</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 rounded border-l-4 border-orange-500"></div>
                <span>Требует отметки</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 rounded border-l-4 border-yellow-500"></div>
                <span>Предстоит</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 rounded border-l-4 border-red-500"></div>
                <span>Отменён</span>
              </div>
              {availability.length > 0 && (
                <>
                  <span className="border-l pl-4 border-gray-300"></span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-50 rounded border border-green-200"></div>
                    <span>Свободен для занятий</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "students" && (
        <div className="space-y-6">
          {/* Error message */}
          {studentsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Ошибка загрузки</p>
                <p className="text-sm mt-1">{studentsError}</p>
              </div>
              <button
                onClick={() => {
                  setActiveTab("info");
                  setTimeout(() => setActiveTab("students"), 100);
                }}
                className="btn btn-secondary btn-sm"
              >
                Повторить
              </button>
            </div>
          )}

          {/* Loading */}
          {studentsLoading && (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Загрузка учеников...</p>
              </div>
            </div>
          )}

          {/* Content */}
          {!studentsLoading && !studentsError && (
            <>
              {/* Groups Section */}
              <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">Группы</h2>
              <select
                value={groupFilter || ""}
                onChange={(e) => setGroupFilter(e.target.value ? parseInt(e.target.value) : null)}
                className="input max-w-xs"
              >
                <option value="">Все группы</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            {(() => {
              const filteredGroups = groupFilter
                ? groups.filter((g) => g.id === groupFilter)
                : groups;

              return filteredGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="p-4 bg-gray-50 rounded-xl"
                  >
                    <h3 className="font-medium text-gray-800 mb-2">{group.name}</h3>
                    <p className="text-sm text-gray-500 mb-3">{group.students_count} учеников</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedGroupId(group.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-cyan-100 text-cyan-700 rounded-lg text-sm hover:bg-cyan-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Чат
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
                        onClick={() => {
                          setLessonsFilter({ type: 'group', id: group.id, name: group.name });
                          setActiveTab('materials');
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Уроки
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {groupFilter ? "Группа не найдена" : "У вас пока нет групп"}
              </p>
            );
            })()}
          </div>

          {/* All Students Section */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="section-title mb-0">Все ученики</h2>
              <div className="relative max-w-xs">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Поиск по имени или email"
                  value={studentSearchFilter}
                  onChange={(e) => setStudentSearchFilter(e.target.value)}
                  className="input pl-9 w-full"
                />
              </div>
            </div>
            {(() => {
              const filteredStudents = students.filter((student) => {
                const searchLower = studentSearchFilter.toLowerCase();
                return (
                  student.name.toLowerCase().includes(searchLower) ||
                  student.email.toLowerCase().includes(searchLower)
                );
              });

              return filteredStudents.length > 0 ? (
              <div className="space-y-3">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <Avatar name={student.name} size="md" />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{student.name}</h3>
                      <p className="text-sm text-gray-500">{student.email}</p>
                      {student.group_names.length > 0 ? (
                        <p className="text-xs text-gray-400">
                          Группы: {student.group_names.join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">Индивидуальное обучение</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setChatPartner({ id: student.id, name: student.name })}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Чат
                      </button>
                      <button
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                        onClick={() => {
                          setLessonsFilter({ type: 'student', id: student.id, name: student.name });
                          setActiveTab('materials');
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Уроки
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {studentSearchFilter ? "Ученики не найдены" : "У вас пока нет учеников"}
              </p>
            );
            })()}
          </div>
            </>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title mb-1">Уроки с материалами</h2>
              {lessonsFilter && (
                <p className="text-sm text-cyan-600">
                  Фильтр: {lessonsFilter.type === 'group' ? 'Группа' : 'Ученик'} - {lessonsFilter.name}
                </p>
              )}
            </div>
            {lessonsFilter && (
              <button
                onClick={() => setLessonsFilter(null)}
                className="btn btn-secondary btn-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Сбросить фильтр
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Прикрепляйте материалы из "Базы PDF" к урокам. Материалы будут доступны ученикам с момента начала урока и в течение 30 дней.
          </p>
          {(() => {
            const filteredLessons = lessonsFilter
              ? lessonsWithMaterials.filter((lesson) => {
                  if (lessonsFilter.type === 'group') {
                    // Filter by group - check if lesson has students from this group
                    return lesson.group_id === lessonsFilter.id;
                  } else {
                    // Filter by student - check if this student is in the lesson
                    return lesson.students?.includes(lessonsFilter.name);
                  }
                })
              : lessonsWithMaterials;

            return filteredLessons.length > 0 ? (
            <div className="space-y-4">
              {filteredLessons.map((lesson) => {
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
                const lessonAsTeacherLesson = {
                  ...lesson,
                  scheduled_at: lesson.scheduled_at,
                  duration_minutes: lesson.duration_minutes || 60,
                  status: lesson.status || 'scheduled',
                } as unknown as TeacherLesson;
                const visualStatus = getLessonVisualStatus(lessonAsTeacherLesson);
                const statusLabel = getLessonStatusLabel(visualStatus);

                const statusBorderColor: Record<LessonVisualStatus, string> = {
                  completed: 'border-green-400',
                  cancelled: 'border-red-400',
                  today: 'border-cyan-400 border-2 shadow-lg',
                  past: 'border-orange-400',
                  upcoming: 'border-yellow-400',
                };

                const statusBgColor: Record<LessonVisualStatus, string> = {
                  completed: 'bg-gradient-to-r from-green-50 to-emerald-50',
                  cancelled: 'bg-gradient-to-r from-red-50 to-pink-50',
                  today: 'bg-gradient-to-r from-cyan-50 to-blue-50',
                  past: 'bg-gradient-to-r from-orange-50 to-amber-50',
                  upcoming: 'bg-gradient-to-r from-purple-50 to-pink-50',
                };

                const statusBadgeColor: Record<LessonVisualStatus, string> = {
                  completed: 'bg-green-100 text-green-700',
                  cancelled: 'bg-red-100 text-red-700',
                  today: 'bg-blue-100 text-blue-700',
                  past: 'bg-orange-100 text-orange-700',
                  upcoming: 'bg-yellow-100 text-yellow-700',
                };

                return (
                  <div key={lesson.id} className={`border rounded-xl overflow-hidden ${
                    statusBorderColor[visualStatus] || "border-gray-200"
                  }`}>
                    {/* Lesson Header */}
                    <div className={`p-4 border-b border-gray-200 ${
                      statusBgColor[visualStatus] || "bg-gradient-to-r from-purple-50 to-pink-50"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-800 text-lg">{lesson.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeColor[visualStatus]}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formattedDate}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>{formattedTime}</span>
                            <span className="text-gray-400">•</span>
                            <span>{lesson.students?.join(", ") || "Нет учеников"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLessonForMaterial(lesson.id)}
                            className="btn btn-secondary btn-sm flex items-center gap-1"
                            title="Прикрепить PDF материал"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            PDF
                          </button>
                          <button
                            onClick={() => setSelectedLessonForCourseMaterial(lesson.id)}
                            className="btn btn-primary btn-sm flex items-center gap-1"
                            title="Прикрепить материал из курса"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Курс
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Materials List */}
                    <div className="p-4 bg-white">
                      {lesson.materials.length > 0 ? (
                        <div className="space-y-2">
                          {lesson.materials.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">
                                  {material.title}
                                </p>
                                <p className="text-xs text-gray-500">PDF документ</p>
                              </div>
                              <a
                                href={material.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Открыть
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm">Нет материалов</p>
                          <p className="text-xs mt-1">Нажмите "Добавить материал" чтобы прикрепить PDF из базы</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-gray-500">
                {lessonsFilter ? 'Нет уроков с выбранным фильтром' : 'У вас пока нет уроков'}
              </p>
            </div>
          );
          })()}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="card">
          <h2 className="section-title mb-4">Личные сообщения</h2>
          <ConversationList
            onSelectConversation={(userId, userName) =>
              setChatPartner({ id: userId, name: userName })
            }
          />
        </div>
      )}

      {/* Direct Chat Modal */}
      {chatPartner && (
        <DirectChat
          partnerId={chatPartner.id}
          partnerName={chatPartner.name}
          onClose={() => setChatPartner(null)}
        />
      )}

      {/* Lesson Detail Modal (with attendance, PDF materials, course materials) */}
      {selectedLessonId && (
        <LessonDetailModal
          lessonId={selectedLessonId}
          onClose={() => setSelectedLessonId(null)}
          onUpdate={handleAttendanceSave}
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

      {/* Attach Material Modal */}
      {selectedLessonForMaterial && (
        <AttachMaterialModal
          attachedMaterialIds={
            lessonsWithMaterials
              .find((l) => l.id === selectedLessonForMaterial)
              ?.materials.map((m) => m.id) || []
          }
          onClose={() => setSelectedLessonForMaterial(null)}
          onAttach={async (materialId: number) => {
            const token = localStorage.getItem("token");
            await fetch(`/api/lessons/${selectedLessonForMaterial}/materials`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ material_id: materialId }),
            });
            // Refresh lessons with materials
            const response = await fetch("/api/teacher/lessons-with-materials", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setLessonsWithMaterials(data);
          }}
        />
      )}

      {/* Attach Course Material Modal */}
      {selectedLessonForCourseMaterial && (
        <AttachCourseMaterialModal
          isOpen={true}
          lessonId={selectedLessonForCourseMaterial}
          onClose={() => setSelectedLessonForCourseMaterial(null)}
          onAttached={async () => {
            // Refresh lessons with materials
            const token = localStorage.getItem("token");
            const response = await fetch("/api/teacher/lessons-with-materials", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setLessonsWithMaterials(data);
          }}
        />
      )}
    </div>
  );
}
