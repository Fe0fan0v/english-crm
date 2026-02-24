import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { liveSessionApi } from "../services/liveSessionApi";

export default function LiveSessionBanner() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<{
    lesson_id: number;
    interactive_lesson_id: number;
    teacher_name: string;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isStudent = user?.role === "student";

  useEffect(() => {
    if (!isStudent) return;

    const check = async () => {
      try {
        const data = await liveSessionApi.checkActive();
        if (data.active && data.lesson_id && data.interactive_lesson_id && data.teacher_name) {
          setSession({
            lesson_id: data.lesson_id,
            interactive_lesson_id: data.interactive_lesson_id,
            teacher_name: data.teacher_name,
          });
        } else {
          setSession(null);
        }
      } catch {
        // Ignore polling errors
      }
    };

    check();
    intervalRef.current = setInterval(check, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStudent]);

  if (!session) return null;

  // Don't show banner if already on the live session page
  const livePath = `/courses/lessons/${session.interactive_lesson_id}`;
  if (location.pathname === livePath && location.search.includes(`session=${session.lesson_id}`)) {
    return null;
  }

  const handleJoin = () => {
    navigate(`${livePath}?session=${session.lesson_id}`);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] lg:ml-64">
      <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {/* Pulsing dot */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <span className="text-sm font-medium">
            Преподаватель {session.teacher_name} приглашает к совместной работе
          </span>
        </div>
        <button
          onClick={handleJoin}
          className="px-4 py-1.5 bg-white text-purple-700 font-medium rounded-lg text-sm hover:bg-purple-50 transition-colors"
        >
          Присоединиться
        </button>
      </div>
    </div>
  );
}
