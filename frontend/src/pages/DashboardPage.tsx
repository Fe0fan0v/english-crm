import { useAuthStore } from "../store/authStore";

// Иконки для статистики
const StatIcon = {
  balance: (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  students: (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  teachers: (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  lessons: (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
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
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
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

  // Mock data - в реальности данные будут из API
  const stats = {
    balance: 0,
    students: 4514,
    teachers: 353,
    lessons: 261648,
  };

  return (
    <div>
      <h1 className="page-title">Показатели</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={StatIcon.balance}
          label="Баланс (USD)"
          value={stats.balance}
          color="bg-cyan-100 text-cyan-600"
        />
        <StatCard
          icon={StatIcon.students}
          label="Учеников"
          value={stats.students.toLocaleString()}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={StatIcon.teachers}
          label="Учителей"
          value={stats.teachers}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          icon={StatIcon.lessons}
          label="Уроков"
          value={stats.lessons.toLocaleString()}
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Students chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">Учеников</span>
              <span className="text-green-500 text-sm font-medium">+64</span>
            </div>
            <select className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400">
              <option>В этом месяце</option>
              <option>За неделю</option>
              <option>За год</option>
            </select>
          </div>
          <div className="h-48 flex items-end justify-between gap-1">
            {/* Simple bar chart mockup */}
            {[12, 8, 15, 10, 5, 3, 2, 1, 1, 2].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-cyan-400 to-cyan-200 rounded-t"
                style={{ height: `${h * 10}%` }}
              />
            ))}
          </div>
        </div>

        {/* Lessons chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">Уроков</span>
              <span className="text-cyan-500 text-sm font-medium">8166</span>
            </div>
            <select className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400">
              <option>В этом месяце</option>
              <option>За неделю</option>
              <option>За год</option>
            </select>
          </div>
          <div className="h-48 flex items-center">
            {/* Simple line chart mockup */}
            <svg
              className="w-full h-full"
              viewBox="0 0 400 150"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                points="0,100 20,80 40,90 60,70 80,85 100,60 120,75 140,50 160,65 180,40 200,55 220,35 240,50 260,30 280,45 300,25 320,40 340,20 360,35 380,15 400,30"
              />
              <circle cx="180" cy="40" r="4" fill="#22d3ee" />
              <circle cx="260" cy="30" r="4" fill="#22d3ee" />
              <circle cx="340" cy="20" r="4" fill="#22d3ee" />
            </svg>
          </div>
        </div>
      </div>

      {/* Upcoming lessons */}
      <div className="card">
        <h2 className="section-title">Ближайшие уроки</h2>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost p-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="text-gray-700 font-medium">8 дек. - 14 дек.</span>
            <button className="btn btn-ghost p-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
              <option>06:48 (UTC+5)</option>
            </select>
            <button className="btn btn-ghost p-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-4 text-center mb-4">
          {[
            "Пн, 8",
            "Вт, 9",
            "Ср, 10",
            "Чт, 11",
            "Пт, 12",
            "Сб, 13",
            "Вс, 14",
          ].map((day, i) => (
            <div
              key={day}
              className={`py-2 rounded-full text-sm font-medium ${
                i === 2 ? "bg-pink-500 text-white" : "text-gray-600"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Schedule grid */}
        <div className="border-t border-gray-100">
          {["7:00", "8:00", "9:00", "10:00", "11:00"].map((time) => (
            <div
              key={time}
              className="grid grid-cols-8 border-b border-gray-50"
            >
              <div className="py-3 text-sm text-gray-400">{time}</div>
              {[3, 8, 15, 18, 12, 9, 0].map((count, i) => (
                <div key={i} className="py-3 text-center">
                  {count > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm text-yellow-500">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                      </svg>
                      {count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
