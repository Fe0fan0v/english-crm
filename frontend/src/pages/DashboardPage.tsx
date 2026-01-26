import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { dashboardApi, usersApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { DashboardResponse } from "../types";

// Icons
const StatIcon = {
  balance: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  students: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  teachers: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  lessons: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  ),
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const handleResetTeachersBalances = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    setIsResetting(true);
    try {
      const result = await usersApi.resetTeachersBalances();
      setResetResult(result.message);
      setResetConfirm(false);
      setTimeout(() => setResetResult(null), 5000);
    } catch (error) {
      console.error("Failed to reset balances:", error);
      setResetResult("Ошибка при обнулении балансов");
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await dashboardApi.get();
        setData(response);
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  const stats = data?.stats || {
    total_balance: "0",
    students_count: 0,
    teachers_count: 0,
    lessons_this_month: 0,
  };

  return (
    <div>
      <h1 className="page-title">Показатели</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={StatIcon.balance}
          label="Баланс"
          value={`${parseFloat(stats.total_balance).toLocaleString("ru-RU")} тг`}
          color="bg-cyan-100 text-cyan-600"
        />
        <StatCard
          icon={StatIcon.students}
          label="Учеников"
          value={stats.students_count.toLocaleString()}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={StatIcon.teachers}
          label="Учителей"
          value={stats.teachers_count}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          icon={StatIcon.lessons}
          label="Уроков в месяце"
          value={stats.lessons_this_month.toLocaleString()}
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Lessons chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Проведено уроков</h3>
          <div className="h-64" style={{ minHeight: '256px' }}>
            {data?.charts.lessons_chart && data.charts.lessons_chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <AreaChart data={data.charts.lessons_chart}>
                  <defs>
                    <linearGradient id="lessonsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#lessonsGradient)"
                    name="Уроков"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Нет данных для отображения
              </div>
            )}
          </div>
        </div>

        {/* Income chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Доход от уроков</h3>
          <div className="h-64" style={{ minHeight: '256px' }}>
            {data?.charts.income_chart && data.charts.income_chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <LineChart data={data.charts.income_chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [
                      `${Number(value).toLocaleString("ru-RU")} тг`,
                      "Доход",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Доход"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Нет данных для отображения
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin actions - only for admin role */}
      {isAdmin && (
        <div className="card mb-8">
          <h2 className="section-title mb-4">Администрирование</h2>
          <div className="flex items-center gap-4">
            {resetConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-medium">Обнулить баланс ВСЕХ преподавателей?</span>
                <button
                  onClick={handleResetTeachersBalances}
                  disabled={isResetting}
                  className="btn bg-red-500 text-white hover:bg-red-600"
                >
                  {isResetting ? "Обнуление..." : "Да, обнулить"}
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={handleResetTeachersBalances}
                className="btn btn-secondary"
              >
                Обнулить баланс преподавателей
              </button>
            )}
            {resetResult && (
              <span className="text-green-600 font-medium">{resetResult}</span>
            )}
          </div>
        </div>
      )}

      {/* Upcoming lessons */}
      <div className="card">
        <h2 className="section-title mb-4">Ближайшие уроки</h2>

        {data?.upcoming_lessons && data.upcoming_lessons.length > 0 ? (
          <div className="space-y-3">
            {data.upcoming_lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-800">
                      {new Date(lesson.scheduled_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(lesson.scheduled_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">{lesson.title}</h4>
                    <p className="text-sm text-gray-500">
                      Учитель: {lesson.teacher_name}
                    </p>
                    {lesson.student_names.length > 0 && (
                      <p className="text-sm text-gray-500">
                        Ученики: {lesson.student_names.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                {lesson.meeting_url && (
                  <a
                    href={lesson.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Войти
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Нет запланированных уроков на ближайшую неделю
          </p>
        )}
      </div>
    </div>
  );
}
