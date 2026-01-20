import { useState, useEffect } from "react";
import { teacherApi } from "../services/api";
import type { TeacherAvailability, DayOfWeek } from "../types";

interface TeacherAvailabilityEditorProps {
  readOnly?: boolean;
  teacherId?: number; // For manager view
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Пн" },
  { value: "tuesday", label: "Вт" },
  { value: "wednesday", label: "Ср" },
  { value: "thursday", label: "Чт" },
  { value: "friday", label: "Пт" },
  { value: "saturday", label: "Сб" },
  { value: "sunday", label: "Вс" },
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
  sunday: "Воскресенье",
};

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const hour = 8 + i;
  return `${hour.toString().padStart(2, "0")}:00`;
});

export default function TeacherAvailabilityEditor({
  readOnly = false,
  teacherId,
}: TeacherAvailabilityEditorProps) {
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSlot, setNewSlot] = useState<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
  }>({
    day_of_week: "monday",
    start_time: "09:00",
    end_time: "18:00",
  });

  const loadAvailability = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = teacherId
        ? await teacherApi.getAvailabilityByTeacherId(teacherId)
        : await teacherApi.getAvailability();
      setAvailability(data.items);
    } catch (err) {
      console.error("Failed to load availability:", err);
      setError("Не удалось загрузить данные");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [teacherId]);

  const handleAddSlot = async () => {
    if (newSlot.start_time >= newSlot.end_time) {
      setError("Время начала должно быть раньше времени окончания");
      return;
    }

    try {
      setError("");
      await teacherApi.createAvailability(newSlot);
      await loadAvailability();
      setIsAdding(false);
      setNewSlot({
        day_of_week: "monday",
        start_time: "09:00",
        end_time: "18:00",
      });
    } catch (err) {
      console.error("Failed to add availability:", err);
      setError("Не удалось добавить слот");
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      await teacherApi.deleteAvailability(slotId);
      await loadAvailability();
    } catch (err) {
      console.error("Failed to delete availability:", err);
      setError("Не удалось удалить слот");
    }
  };

  // Group availability by day
  const groupedByDay = DAYS.map((day) => ({
    day,
    slots: availability.filter((a) => a.day_of_week === day.value),
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Weekly grid view */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {DAYS.map((day) => (
                <th
                  key={day.value}
                  className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-200"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {groupedByDay.map(({ day, slots }) => (
                <td
                  key={day.value}
                  className="p-2 align-top border-r border-gray-100 last:border-r-0 min-w-[100px]"
                >
                  {slots.length > 0 ? (
                    <div className="space-y-1">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="group relative p-2 bg-green-100 text-green-700 rounded-lg text-xs"
                        >
                          <div className="font-medium">
                            {slot.start_time} - {slot.end_time}
                          </div>
                          {!readOnly && (
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-4">
                      -
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add new slot */}
      {!readOnly && (
        <div>
          {isAdding ? (
            <div className="p-4 bg-gray-50 rounded-xl space-y-4">
              <h4 className="font-medium text-gray-700">Добавить свободное время</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">День недели</label>
                  <select
                    value={newSlot.day_of_week}
                    onChange={(e) =>
                      setNewSlot((prev) => ({
                        ...prev,
                        day_of_week: e.target.value as DayOfWeek,
                      }))
                    }
                    className="input w-full"
                  >
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {DAY_LABELS[day.value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Начало</label>
                  <select
                    value={newSlot.start_time}
                    onChange={(e) =>
                      setNewSlot((prev) => ({ ...prev, start_time: e.target.value }))
                    }
                    className="input w-full"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Конец</label>
                  <select
                    value={newSlot.end_time}
                    onChange={(e) =>
                      setNewSlot((prev) => ({ ...prev, end_time: e.target.value }))
                    }
                    className="input w-full"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddSlot}
                  className="btn btn-primary"
                >
                  Добавить
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Добавить свободное время
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded"></div>
          <span>Свободен для занятий</span>
        </div>
      </div>
    </div>
  );
}
