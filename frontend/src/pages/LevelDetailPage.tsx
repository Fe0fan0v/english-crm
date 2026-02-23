import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { levelsApi } from "../services/api";
import type { LevelPaymentMatrix, LevelPaymentUpdate } from "../types";

export default function LevelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<LevelPaymentMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [payments, setPayments] = useState<Record<number, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const levelId = id ? parseInt(id) : null;

  const fetchPayments = async () => {
    if (!levelId) return;

    setIsLoading(true);
    try {
      const response = await levelsApi.getPayments(levelId);
      setData(response);

      // Initialize payments state from fetched data
      const initialPayments: Record<number, string> = {};
      response.items.forEach((item) => {
        initialPayments[item.lesson_type_id] = item.teacher_payment ?? "";
      });
      setPayments(initialPayments);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [levelId]);

  const handlePaymentChange = (lessonTypeId: number, value: string) => {
    setPayments((prev) => ({
      ...prev,
      [lessonTypeId]: value,
    }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!levelId || !data) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Build payment updates - only include items with values
      const updates: LevelPaymentUpdate[] = [];

      Object.entries(payments).forEach(([lessonTypeIdStr, value]) => {
        const lessonTypeId = parseInt(lessonTypeIdStr);
        const numValue = parseFloat(value);

        if (!isNaN(numValue) && numValue >= 0) {
          updates.push({
            lesson_type_id: lessonTypeId,
            teacher_payment: numValue,
          });
        }
      });

      if (updates.length === 0) {
        setSaveError("Необходимо указать хотя бы одно значение оплаты");
        setIsSaving(false);
        return;
      }

      const response = await levelsApi.updatePayments(levelId, updates);
      setData(response);

      // Update local state
      const newPayments: Record<number, string> = {};
      response.items.forEach((item) => {
        newPayments[item.lesson_type_id] = item.teacher_payment ?? "";
      });
      setPayments(newPayments);
      setHasChanges(false);
      setSaveSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save payments:", error);
      setSaveError("Не удалось сохранить изменения");
    } finally {
      setIsSaving(false);
    }
  };

  if (!levelId) {
    return (
      <div className="card text-center py-12 text-gray-500">
        Уровень не найден
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/levels")}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h1 className="page-title mb-0">
            {isLoading ? "Загрузка..." : data?.level_name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Настройка оплат преподавателям за проведенные занятия
          </p>
        </div>
      </div>

      {/* Messages */}
      {saveError && (
        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 bg-green-50 text-green-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Изменения сохранены
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-6 font-medium text-gray-600">
                  Тип занятия
                </th>
                <th className="text-right py-4 px-6 font-medium text-gray-600">
                  Цена для ученика
                </th>
                <th className="text-right py-4 px-6 font-medium text-gray-600">
                  Оплата преподавателю
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr
                  key={item.lesson_type_id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {item.lesson_type_name}
                  </td>
                  <td className="py-4 px-6 text-right text-gray-600">
                    {parseFloat(item.lesson_type_price).toLocaleString("ru-RU")}{" "}
                    тг
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end">
                      <div className="relative w-40">
                        <input
                          type="number"
                          value={payments[item.lesson_type_id] || ""}
                          onChange={(e) =>
                            handlePaymentChange(
                              item.lesson_type_id,
                              e.target.value,
                            )
                          }
                          className="input w-full text-right pr-10"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          тг
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500">
                    Типы занятий не найдены. Сначала создайте типы занятий.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Save button */}
      {data && data.items.length > 0 && (
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => navigate("/levels")}
            className="btn btn-secondary"
            disabled={isSaving}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Сохранение...
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Сохранить изменения
              </>
            )}
          </button>
        </div>
      )}

      {/* Info block */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Как работает матрица оплат?</p>
            <p>
              Каждому преподавателю присваивается уровень (например, "1-6
              месяцев" или "12+ месяцев"). Когда преподаватель проводит занятие
              с учеником, оплата преподавателю рассчитывается на основе уровня
              преподавателя и типа занятия.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
