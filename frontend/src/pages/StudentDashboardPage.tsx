import { useEffect, useMemo, useState } from "react";
import { studentApi, settingsApi, lessonsApi, courseMaterialsApi, homeworkApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import DirectChat, { ConversationList } from "../components/DirectChat";
import GroupChat from "../components/GroupChat";
import PhotoUpload from "../components/PhotoUpload";
import type {
  StudentDashboardResponse,
  StudentLessonInfo,
  StudentHomeworkItem,
  LessonWithMaterials,
  LessonMaterial,
  LessonCourseMaterial,
} from "../types";

type TabType = "info" | "lessons" | "tests" | "homework" | "messages";

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

export default function StudentDashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [schedule, setSchedule] = useState<StudentLessonInfo[]>([]);
  const [lessonsWithMaterials, setLessonsWithMaterials] = useState<LessonWithMaterials[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [homework, setHomework] = useState<any[]>([]);
  const [myHomeworkAssignments, setMyHomeworkAssignments] = useState<StudentHomeworkItem[]>([]);
  const [isSubmittingHomework, setIsSubmittingHomework] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [chatPartner, setChatPartner] = useState<{ id: number; name: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photo_url || null);
  const [selectedLesson, setSelectedLesson] = useState<StudentLessonInfo | null>(null);
  const [selectedLessonMaterials, setSelectedLessonMaterials] = useState<LessonMaterial[]>([]);
  const [selectedLessonCourseMaterials, setSelectedLessonCourseMaterials] = useState<LessonCourseMaterial[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Find today's index in the week (0=Mon, 6=Sun)
    const today = new Date();
    const dayOfWeek = today.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6, Mon (1) to 0, etc.
  });
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [myTeachers, setMyTeachers] = useState<{ id: number; name: string; photo_url: string | null; groups: string[] }[]>([]);

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await studentApi.getDashboard();
        setData(response);
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await settingsApi.getPublic();
        setWhatsappPhone(settings.whatsapp_manager_phone);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const teachers = await studentApi.getMyTeachers();
        setMyTeachers(teachers);
      } catch (error) {
        console.error("Failed to fetch teachers:", error);
      }
    };
    fetchTeachers();
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      // Use local date format to avoid timezone shift issues with toISOString()
      const formatLocal = (d: Date) => {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const dateFrom = formatLocal(weekDates[0]) + "T00:00:00";
      const dateTo = formatLocal(weekDates[6]) + "T23:59:59";
      try {
        const lessons = await studentApi.getSchedule(dateFrom, dateTo);
        setSchedule(lessons);
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      }
    };
    fetchSchedule();
  }, [weekDates]);

  useEffect(() => {
    if (activeTab === "lessons") {
      const fetchLessonsWithMaterials = async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch("/api/student/lessons-with-materials", {
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

  useEffect(() => {
    if (activeTab === "tests") {
      const fetchHomeworkAssignments = async () => {
        try {
          const result = await homeworkApi.getMyHomework();
          setMyHomeworkAssignments(result);
        } catch (error) {
          console.error("Failed to fetch homework assignments:", error);
        }
      };
      fetchHomeworkAssignments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "homework") {
      const fetchHomework = async () => {
        try {
          const result = await studentApi.getHomework();
          setHomework(result);
        } catch (error) {
          console.error("Failed to fetch homework:", error);
        }
      };
      fetchHomework();
    }
  }, [activeTab]);

  const openLessonModal = (lesson: StudentLessonInfo) => {
    setSelectedLesson(lesson);
    setSelectedLessonMaterials([]);
    setSelectedLessonCourseMaterials([]);
    setIsMaterialsLoading(true);
    Promise.all([
      lessonsApi.getLessonMaterials(lesson.id).catch(() => []),
      courseMaterialsApi.getLessonCourseMaterials(lesson.id).catch(() => []),
    ]).then(([mats, courseMats]) => {
      setSelectedLessonMaterials(mats);
      setSelectedLessonCourseMaterials(courseMats);
      setIsMaterialsLoading(false);
    });
  };

  // Meeting URL button state: 'active' | 'disabled' | 'hidden'
  const getMeetingUrlState = (lesson: StudentLessonInfo): 'active' | 'disabled' | 'hidden' => {
    if (!lesson.meeting_url || lesson.status === "cancelled") return 'hidden';
    const now = new Date();
    const lessonStart = new Date(lesson.scheduled_at);
    const lessonEnd = new Date(lessonStart.getTime() + (lesson.duration_minutes || 60) * 60 * 1000);
    if (now > lessonEnd) return 'hidden';
    const tenMinBefore = new Date(lessonStart.getTime() - 10 * 60 * 1000);
    if (now >= tenMinBefore) return 'active';
    return 'disabled';
  };

  const getLessonsForSlot = (date: Date, hour: number): StudentLessonInfo[] => {
    return schedule.filter((lesson) => {
      const lessonDate = new Date(lesson.scheduled_at);
      return (
        lessonDate.getDate() === date.getDate() &&
        lessonDate.getMonth() === date.getMonth() &&
        lessonDate.getHours() === hour
      );
    });
  };

  const getLessonsForDay = (date: Date): StudentLessonInfo[] => {
    return schedule
      .filter((lesson) => {
        const lessonDate = new Date(lesson.scheduled_at);
        return (
          lessonDate.getDate() === date.getDate() &&
          lessonDate.getMonth() === date.getMonth() &&
          lessonDate.getFullYear() === date.getFullYear()
        );
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
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
  const balance = parseFloat(stats?.balance || "0");

  // Block access if balance is 0 or negative
  if (balance <= 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card max-w-md w-full text-center py-12 px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Доступ ограничен</h2>
          <p className="text-gray-600 mb-6">
            Ваш баланс составляет <span className="font-semibold text-red-600">{balance.toLocaleString("ru-RU")} тг</span>.
            <br />
            Для восстановления доступа к платформе, пожалуйста, пополните баланс.
          </p>
          {whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 mb-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Связаться с менеджером в WhatsApp
            </a>
          )}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Как пополнить баланс?</span>
            </div>
            <p>Свяжитесь с менеджером школы для пополнения баланса.</p>
          </div>
        </div>
      </div>
    );
  }

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
      {/* Profile Header */}
      <div className="card mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-6">
          <PhotoUpload
            userId={user?.id || 0}
            userName={user?.name || ""}
            currentPhotoUrl={photoUrl}
            onPhotoUpdated={setPhotoUrl}
            size="xl"
            canEdit={true}
          />
          <div className="flex-1 text-center lg:text-left w-full">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-0">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-800">{user?.name}</h1>
                <div className="flex flex-col sm:flex-row items-center sm:gap-4 mt-2 text-gray-500 text-sm">
                  {user?.phone && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {user.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate max-w-[200px]">{user?.email}</span>
                  </span>
                </div>
              </div>
              {/* Баланс скрыт по запросу заказчика (HIDE_BALANCE) */}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 lg:mb-6 overflow-x-auto scrollbar-hide pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
        {[
          { key: "info" as TabType, label: "Моя страница" },
          { key: "lessons" as TabType, label: "Материалы" },
          { key: "tests" as TabType, label: "Домашнее задание" },
          { key: "homework" as TabType, label: "Уроки" },
          { key: "messages" as TabType, label: "Сообщения" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab whitespace-nowrap touch-target flex items-center justify-center ${activeTab === tab.key ? "tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div className="space-y-4 lg:space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="card flex items-center gap-4 p-4 lg:p-6">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Предстоящие уроки</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-800">{stats?.upcoming_lessons_count || 0}</p>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-4 lg:p-6">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Мои группы</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-800">{stats?.groups_count || 0}</p>
              </div>
            </div>
            {/* Карточка баланса скрыта по запросу заказчика (HIDE_BALANCE) */}
          </div>

          {/* Секция «Остаток уроков по балансу» скрыта по запросу заказчика (HIDE_BALANCE) */}

          {/* My Groups */}
          <div className="card p-4 lg:p-6">
            <h2 className="section-title mb-3 lg:mb-4">Мои группы</h2>
            {groups.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 lg:p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-800 truncate">{group.name}</h3>
                        {group.teacher_name && (
                          <p className="text-sm text-gray-500 truncate">Преподаватель: {group.teacher_name}</p>
                        )}
                      </div>
                      {group.has_unread_messages && (
                        <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2"></span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      className="flex items-center gap-1 mt-3 text-cyan-600 text-sm hover:text-cyan-700 touch-target"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Открыть чат
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6 lg:py-8">Вы пока не состоите в группах</p>
            )}
          </div>

          {/* My Teachers */}
          {myTeachers.length > 0 && (
            <div className="card p-4 lg:p-6">
              <h2 className="section-title mb-3 lg:mb-4">Мои преподаватели</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {myTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="p-3 lg:p-4 bg-gray-50 rounded-xl flex items-center gap-3"
                  >
                    {teacher.photo_url ? (
                      <img
                        src={teacher.photo_url}
                        alt={teacher.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                        {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-gray-800 truncate">{teacher.name}</h3>
                      {teacher.groups.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">{teacher.groups.join(', ')}</p>
                      )}
                      <button
                        onClick={() => {
                          setChatPartner({ id: teacher.id, name: teacher.name });
                          setActiveTab("messages");
                        }}
                        className="flex items-center gap-1 mt-1 text-cyan-600 text-sm hover:text-cyan-700"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Написать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Calendar */}
          <div className="card p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 gap-3">
              <h2 className="section-title mb-0">Мое расписание</h2>
              <div className="flex items-center justify-center gap-2">
                <button onClick={goToPrevWeek} className="p-2 hover:bg-gray-100 rounded-lg touch-target">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-medium text-sm lg:text-base">
                  {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                </span>
                <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded-lg touch-target">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Day Picker */}
            <div className="lg:hidden mb-4">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                {weekDates.map((date, i) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isSelected = selectedDayIndex === i;
                  const dayLessons = getLessonsForDay(date);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDayIndex(i)}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] transition-colors ${
                        isSelected
                          ? "bg-cyan-500 text-white"
                          : isToday
                          ? "bg-cyan-50 text-cyan-600"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-xs font-medium">{dayNames[i]}</span>
                      <span className={`text-lg font-bold ${isSelected ? "text-white" : ""}`}>
                        {date.getDate()}
                      </span>
                      {dayLessons.length > 0 && !isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-0.5"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Lessons List */}
            <div className="lg:hidden space-y-3">
              {(() => {
                const selectedDate = weekDates[selectedDayIndex];
                const dayLessons = getLessonsForDay(selectedDate);

                if (dayLessons.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>Нет уроков в этот день</p>
                    </div>
                  );
                }

                return dayLessons.map((lesson) => {
                  const lessonBalance = parseFloat(stats?.balance || "0");
                  const lessonPrice = parseFloat(lesson.lesson_price || "0");
                  const hasInsufficientBalance = lessonBalance < lessonPrice && lesson.status !== "completed" && lesson.status !== "cancelled";
                  const lessonTime = new Date(lesson.scheduled_at);

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => openLessonModal(lesson)}
                      className={`p-4 rounded-xl cursor-pointer transition-shadow hover:shadow-md ${
                        lesson.status === "completed"
                          ? "bg-green-50 border border-green-200"
                          : lesson.status === "cancelled"
                          ? "bg-red-50 border border-red-200"
                          : hasInsufficientBalance
                          ? "bg-orange-50 border border-orange-200"
                          : "bg-yellow-50 border border-yellow-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              lesson.status === "completed" ? "text-green-700" :
                              lesson.status === "cancelled" ? "text-red-700" :
                              hasInsufficientBalance ? "text-orange-700" : "text-yellow-700"
                            }`}>
                              {lessonTime.getHours().toString().padStart(2, '0')}:{lessonTime.getMinutes().toString().padStart(2, '0')}
                            </span>
                            {lesson.lesson_type_name && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {lesson.lesson_type_name}
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-gray-800 mt-1 truncate">{lesson.title}</h4>
                          <p className="text-sm text-gray-500">{lesson.teacher_name}</p>
                          {hasInsufficientBalance && (
                            <div className="flex items-center gap-1 mt-2 text-orange-600 text-sm">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Пополните баланс
                            </div>
                          )}
                        </div>
                        {(() => {
                          const meetState = getMeetingUrlState(lesson);
                          if (meetState === 'hidden' || hasInsufficientBalance) return null;
                          return meetState === 'active' ? (
                            <a
                              href={lesson.meeting_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors touch-target"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Войти
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 px-3 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Войти
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Desktop Schedule Table */}
            <div className="hidden lg:block overflow-x-auto">
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
                        return (
                          <td key={dayIndex} className="p-1 align-top min-w-[120px]">
                            {lessons.map((lesson) => {
                              const balance = parseFloat(stats?.balance || "0");
                              const price = parseFloat(lesson.lesson_price || "0");
                              const hasInsufficientBalance = balance < price && lesson.status !== "completed" && lesson.status !== "cancelled";

                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => openLessonModal(lesson)}
                                  className={`w-full p-2 mb-1 rounded-lg text-left text-xs cursor-pointer transition-shadow hover:shadow-md ${
                                    lesson.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : lesson.status === "cancelled"
                                      ? "bg-red-100 text-red-700"
                                      : hasInsufficientBalance
                                      ? "bg-orange-100 text-orange-700 border border-orange-300"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    {hasInsufficientBalance && (
                                      <svg className="w-3 h-3 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                    )}
                                    <span className="font-medium truncate">{lesson.title}</span>
                                  </div>
                                  <div className="text-[10px] opacity-75">
                                    {lesson.teacher_name}
                                  </div>
                                  {hasInsufficientBalance && (
                                    <div className="text-[10px] text-orange-600 mt-1">
                                      Пополните баланс
                                    </div>
                                  )}
                                  {(() => {
                                    const meetState = getMeetingUrlState(lesson);
                                    if (meetState === 'hidden' || hasInsufficientBalance) return null;
                                    return meetState === 'active' ? (
                                      <a
                                        href={lesson.meeting_url!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-cyan-600 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Ссылка
                                      </a>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Ссылка
                                      </span>
                                    );
                                  })()}
                                </div>
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
          </div>
        </div>
      )}

      {activeTab === "tests" && (
        <div className="card">
          <h2 className="section-title mb-4">Домашнее задание</h2>
          {myHomeworkAssignments.length > 0 ? (
            <div className="space-y-3">
              {myHomeworkAssignments.map((hw) => {
                const progressPercent = hw.total_blocks > 0 ? Math.round((hw.progress / hw.total_blocks) * 100) : 0;
                const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                  pending: { bg: "bg-gray-100", text: "text-gray-600", label: "Не начато" },
                  in_progress: { bg: "bg-blue-100", text: "text-blue-600", label: "В процессе" },
                  submitted: { bg: "bg-yellow-100", text: "text-yellow-700", label: "На проверке" },
                  accepted: { bg: "bg-green-100", text: "text-green-700", label: "Принято" },
                };
                const sc = statusConfig[hw.status] || statusConfig.pending;

                return (
                  <div key={hw.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{hw.interactive_lesson_title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {hw.teacher_name} • {new Date(hw.assigned_at).toLocaleDateString("ru-RU")}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${hw.status === "accepted" ? "bg-green-500" : "bg-cyan-500"}`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{hw.progress}/{hw.total_blocks}</span>
                          </div>
                          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 ml-3">
                        <a
                          href={`/courses/lessons/${hw.interactive_lesson_id}`}
                          className="btn btn-primary btn-sm text-center"
                        >
                          Открыть
                        </a>
                        {hw.status === "pending" && hw.progress > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                setIsSubmittingHomework(hw.id);
                                await homeworkApi.submit(hw.id);
                                const updated = await homeworkApi.getMyHomework();
                                setMyHomeworkAssignments(updated);
                              } catch (err) {
                                console.error("Failed to submit homework:", err);
                              } finally {
                                setIsSubmittingHomework(null);
                              }
                            }}
                            disabled={isSubmittingHomework === hw.id}
                            className="btn btn-sm bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 text-center"
                          >
                            {isSubmittingHomework === hw.id ? "..." : "Сдать"}
                          </button>
                        )}
                        {hw.status === "in_progress" && (
                          <button
                            onClick={async () => {
                              try {
                                setIsSubmittingHomework(hw.id);
                                await homeworkApi.submit(hw.id);
                                const updated = await homeworkApi.getMyHomework();
                                setMyHomeworkAssignments(updated);
                              } catch (err) {
                                console.error("Failed to submit homework:", err);
                              } finally {
                                setIsSubmittingHomework(null);
                              }
                            }}
                            disabled={isSubmittingHomework === hw.id}
                            className="btn btn-sm bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 text-center"
                          >
                            {isSubmittingHomework === hw.id ? "..." : "Сдать"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-gray-500">Нет назначенных домашних заданий</p>
              <p className="text-sm text-gray-400 mt-2">Когда преподаватель задаст ДЗ, оно появится здесь</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "lessons" && (
        <div className="card">
          <h2 className="section-title mb-4">Материалы к урокам</h2>
          <p className="text-sm text-gray-500 mb-6">
            Материалы к урокам доступны с момента начала урока и в течение 30 дней после
          </p>
          {lessonsWithMaterials.length > 0 ? (
            <div className="space-y-4">
              {lessonsWithMaterials.map((lesson) => {
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
                  <div key={lesson.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Lesson Header - Folder Title */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 text-lg">{lesson.title}</h3>
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
                            <span>{lesson.teacher_name}</span>
                          </div>
                        </div>
                      </div>
                      {lesson.meeting_url && (
                        <div className="mt-3">
                          <a
                            href={lesson.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Подключиться к уроку
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Materials List */}
                    <div className="p-4 bg-white">
                      <div className="space-y-2">
                        {lesson.materials.map((material) => (
                          <a
                            key={material.id}
                            href={material.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate group-hover:text-cyan-600 transition-colors">
                                {material.title}
                              </p>
                              <p className="text-xs text-gray-500">PDF документ</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
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
              <p className="text-gray-500">Нет доступных материалов к урокам</p>
              <p className="text-sm text-gray-400 mt-2">Материалы появятся после начала урока</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "homework" && (
        <div className="card">
          <h2 className="section-title mb-4">Домашнее задание</h2>
          <p className="text-sm text-gray-500 mb-6">
            Все курсовые материалы, прикреплённые к вашим урокам
          </p>
          {homework.length > 0 ? (
            <div className="space-y-4">
              {homework.map((lesson: { id: number; title: string; scheduled_at: string; teacher_name: string; lesson_type_name: string; course_materials: { id: number; material_type: string; course_id?: number; course_title?: string; section_id?: number; section_title?: string; interactive_lesson_id?: number; interactive_lesson_title?: string }[] }) => {
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
                  <div key={lesson.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 text-lg">{lesson.title}</h3>
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
                            <span>{lesson.teacher_name}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white">
                      <div className="space-y-2">
                        {lesson.course_materials.map((m) => (
                          <a
                            key={m.id}
                            href={
                              m.material_type === "lesson" && m.interactive_lesson_id
                                ? `/courses/lessons/${m.interactive_lesson_id}`
                                : `/student/course-material/${m.id}`
                            }
                            className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate group-hover:text-purple-600 transition-colors">
                                {m.course_title || m.section_title || m.interactive_lesson_title || "Материал курса"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {m.material_type === "course" ? "Курс" : m.material_type === "section" ? "Секция" : m.material_type === "topic" ? "Топик" : "Урок"}
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-gray-500">Нет прикреплённых курсовых материалов</p>
              <p className="text-sm text-gray-400 mt-2">Материалы появятся после того, как преподаватель прикрепит их к уроку</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="space-y-6">
          {/* My Teachers - for starting new conversations */}
          {groups.some(g => g.teacher_id) && (
            <div className="card">
              <h2 className="section-title mb-4">Мои преподаватели</h2>
              <div className="flex flex-wrap gap-2">
                {/* Get unique teachers from groups */}
                {Array.from(
                  new Map(
                    groups
                      .filter(g => g.teacher_id && g.teacher_name)
                      .map(g => [g.teacher_id, { id: g.teacher_id!, name: g.teacher_name! }])
                  ).values()
                ).map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => setChatPartner(teacher)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-medium text-sm">
                      {teacher.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{teacher.name}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing conversations */}
          <div className="card">
            <h2 className="section-title mb-4">Переписки</h2>
            <ConversationList
              onSelectConversation={(userId, userName) =>
                setChatPartner({ id: userId, name: userName })
              }
            />
          </div>
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

      {/* Student Lesson Detail Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLesson(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{selectedLesson.title}</h2>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                    selectedLesson.status === "completed" ? "bg-green-100 text-green-700" :
                    selectedLesson.status === "cancelled" ? "bg-red-100 text-red-700" :
                    "bg-cyan-100 text-cyan-700"
                  }`}>
                    {selectedLesson.status === "completed" ? "Завершён" :
                     selectedLesson.status === "cancelled" ? "Отменён" : "Запланирован"}
                  </span>
                </div>
                <button onClick={() => setSelectedLesson(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(selectedLesson.scheduled_at).toLocaleString("ru-RU", {
                    day: "numeric", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {selectedLesson.teacher_name}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {selectedLesson.lesson_type_name}
                </div>
                {selectedLesson.group_name && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Группа: {selectedLesson.group_name}
                  </div>
                )}
              </div>

              {/* Meeting URL */}
              {(() => {
                const meetState = getMeetingUrlState(selectedLesson);
                if (meetState === 'hidden') return null;
                return (
                  <div className="mt-4">
                    {meetState === 'active' ? (
                      <a
                        href={selectedLesson.meeting_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Подключиться к уроку
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-200 text-gray-500 rounded-xl font-medium cursor-not-allowed">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Ссылка доступна за 10 мин до начала
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Materials */}
              {isMaterialsLoading ? (
                <div className="mt-4 text-center text-sm text-gray-400">Загрузка материалов...</div>
              ) : (selectedLessonMaterials.length > 0 || selectedLessonCourseMaterials.length > 0) && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Материалы к уроку</h3>
                  {selectedLessonMaterials.map((m) => (
                    <a
                      key={`pdf-${m.id}`}
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                        <p className="text-xs text-gray-500">PDF</p>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                  {selectedLessonCourseMaterials.map((m) => (
                    <a
                      key={`course-${m.id}`}
                      href={
                        m.material_type === "lesson" && m.interactive_lesson_id
                          ? `/courses/lessons/${m.interactive_lesson_id}`
                          : `/student/course-material/${m.id}`
                      }
                      className="flex items-center gap-3 p-3 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {m.course_title || m.section_title || m.topic_title || m.interactive_lesson_title || "Материал курса"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {m.material_type === "course" ? "Курс" : m.material_type === "section" ? "Секция" : m.material_type === "topic" ? "Топик" : "Урок"}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <button onClick={() => setSelectedLesson(null)} className="btn btn-secondary w-full">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
