import { useEffect, useMemo, useState } from "react";
import { studentApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import DirectChat, { ConversationList } from "../components/DirectChat";
import GroupChat from "../components/GroupChat";
import PhotoUpload from "../components/PhotoUpload";
import type {
  StudentDashboardResponse,
  StudentLessonInfo,
  StudentMaterialInfo,
  StudentTestInfo,
} from "../types";

type TabType = "info" | "tests" | "materials" | "messages";

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
  const [materials, setMaterials] = useState<StudentMaterialInfo[]>([]);
  const [tests, setTests] = useState<StudentTestInfo[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [chatPartner, setChatPartner] = useState<{ id: number; name: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photo_url || null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Find today's index in the week (0=Mon, 6=Sun)
    const today = new Date();
    const dayOfWeek = today.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6, Mon (1) to 0, etc.
  });

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
    const fetchSchedule = async () => {
      const dateFrom = weekDates[0].toISOString();
      const dateTo = weekDates[6].toISOString();
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
    if (activeTab === "materials") {
      const fetchMaterials = async () => {
        try {
          const result = await studentApi.getMaterials();
          setMaterials(result);
        } catch (error) {
          console.error("Failed to fetch materials:", error);
        }
      };
      fetchMaterials();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "tests") {
      const fetchTests = async () => {
        try {
          const result = await studentApi.getTests();
          setTests(result);
        } catch (error) {
          console.error("Failed to fetch tests:", error);
        }
      };
      fetchTests();
    }
  }, [activeTab]);

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
              <div className="text-center lg:text-right mt-2 lg:mt-0">
                <p className="text-sm text-gray-500">Баланс</p>
                <p
                  className={`text-xl lg:text-2xl font-bold ${
                    parseFloat(stats?.balance || "0") >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {parseFloat(stats?.balance || "0").toLocaleString("ru-RU")} тг
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 lg:mb-6 overflow-x-auto scrollbar-hide pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
        {[
          { key: "info" as TabType, label: "Моя страница" },
          { key: "tests" as TabType, label: "Тесты" },
          { key: "materials" as TabType, label: "Материалы" },
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
            <div className="card flex items-center gap-4 p-4 lg:p-6 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Баланс</p>
                <p className={`text-xl lg:text-2xl font-bold ${parseFloat(stats?.balance || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {parseFloat(stats?.balance || "0").toLocaleString("ru-RU")} тг
                </p>
              </div>
            </div>
          </div>

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
                      className={`p-4 rounded-xl ${
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
                        {lesson.meeting_url && lesson.status !== "cancelled" && !hasInsufficientBalance && (
                          <a
                            href={lesson.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors touch-target"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Войти
                          </a>
                        )}
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
                                  className={`w-full p-2 mb-1 rounded-lg text-left text-xs ${
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
                                  {lesson.meeting_url && lesson.status !== "cancelled" && !hasInsufficientBalance && (
                                    <a
                                      href={lesson.meeting_url}
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
                                  )}
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
          <h2 className="section-title mb-4">Мои тесты</h2>
          {tests.length > 0 ? (
            <div className="space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{test.title}</h3>
                      <p className="text-xs text-gray-500">
                        Доступен с {new Date(test.granted_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm">
                    Пройти тест
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">У вас пока нет доступных тестов</p>
          )}
        </div>
      )}

      {activeTab === "materials" && (
        <div className="card">
          <h2 className="section-title mb-4">Мои материалы</h2>
          {materials.length > 0 ? (
            <div className="space-y-3">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{material.title}</h3>
                      <p className="text-xs text-gray-500">
                        Доступен с {new Date(material.granted_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    Скачать
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">У вас пока нет доступных материалов</p>
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
    </div>
  );
}
