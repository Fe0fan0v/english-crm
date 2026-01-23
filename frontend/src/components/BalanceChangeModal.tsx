import { useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import { lessonTypesApi } from "../services/api";
import SearchableSelect, { type SearchableSelectOption } from "./SearchableSelect";
import type { LessonType } from "../types";

interface BalanceChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number, description: string) => Promise<void>;
  currentBalance: string;
  userName: string;
}

const quickAmounts = [
  { value: 1000, label: "+1 000" },
  { value: 5000, label: "+5 000" },
  { value: 10000, label: "+10 000" },
  { value: -1000, label: "-1 000" },
  { value: -5000, label: "-5 000" },
];

export default function BalanceChangeModal({
  isOpen,
  onClose,
  onSubmit,
  currentBalance,
  userName,
}: BalanceChangeModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Lesson type selection for auto-calculation
  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
  const [selectedLessonTypeId, setSelectedLessonTypeId] = useState<number | null>(null);
  const [lessonsCount, setLessonsCount] = useState<string>("");
  const [useAutoCalc, setUseAutoCalc] = useState(false);

  // Load lesson types
  useEffect(() => {
    if (isOpen) {
      const loadLessonTypes = async () => {
        try {
          const data = await lessonTypesApi.list();
          setLessonTypes(data.items);
        } catch (err) {
          console.error("Failed to load lesson types:", err);
        }
      };
      loadLessonTypes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setError("");
      setSelectedLessonTypeId(null);
      setLessonsCount("");
      setUseAutoCalc(false);
    }
  }, [isOpen]);

  // Convert lesson types to SearchableSelect options
  const lessonTypeOptions: SearchableSelectOption[] = useMemo(() => {
    return lessonTypes.map((lt) => ({
      value: lt.id,
      label: lt.name,
      description: `${parseFloat(lt.price).toLocaleString("ru-RU")} тг`,
    }));
  }, [lessonTypes]);

  // Get selected lesson type
  const selectedLessonType = useMemo(() => {
    if (!selectedLessonTypeId) return null;
    return lessonTypes.find((lt) => lt.id === selectedLessonTypeId) || null;
  }, [selectedLessonTypeId, lessonTypes]);

  // Auto-calculate amount when lesson type and count change
  useEffect(() => {
    if (useAutoCalc && selectedLessonType && lessonsCount) {
      const count = parseInt(lessonsCount) || 0;
      const price = parseFloat(selectedLessonType.price) || 0;
      const calculatedAmount = price * count;
      setAmount(calculatedAmount.toString());
      setDescription(`Оплата за ${count} занятий (${selectedLessonType.name})`);
    }
  }, [selectedLessonType, lessonsCount, useAutoCalc]);

  const numericAmount = parseFloat(amount) || 0;
  const currentBalanceNum = parseFloat(currentBalance) || 0;
  const newBalance = currentBalanceNum + numericAmount;

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || numericAmount === 0) {
      setError("Введите сумму");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(numericAmount, description);
      onClose();
    } catch (error) {
      console.error("Failed to change balance:", error);
      setError("Не удалось изменить баланс");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Изменить баланс
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* User info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">Ученик</p>
            <p className="font-medium text-gray-800">{userName}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">Текущий баланс:</span>
              <span className="font-semibold text-gray-800">{currentBalance} тг</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setUseAutoCalc(false);
                setSelectedLessonTypeId(null);
                setLessonsCount("");
              }}
              className={clsx(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                !useAutoCalc
                  ? "bg-cyan-100 text-cyan-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Ручной ввод
            </button>
            <button
              type="button"
              onClick={() => setUseAutoCalc(true)}
              className={clsx(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                useAutoCalc
                  ? "bg-cyan-100 text-cyan-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              По типу занятий
            </button>
          </div>

          {/* Auto-calculation mode */}
          {useAutoCalc && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Тип занятия
                </label>
                <SearchableSelect
                  options={lessonTypeOptions}
                  value={selectedLessonTypeId}
                  onChange={(val) => setSelectedLessonTypeId(val as number | null)}
                  placeholder="Выберите тип занятия"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Количество занятий
                </label>
                <input
                  type="number"
                  min="1"
                  value={lessonsCount}
                  onChange={(e) => setLessonsCount(e.target.value)}
                  className="input w-full"
                  placeholder="Введите количество"
                />
              </div>
              {selectedLessonType && lessonsCount && (
                <div className="text-xs text-gray-600">
                  {lessonsCount} × {parseFloat(selectedLessonType.price).toLocaleString("ru-RU")} тг ={" "}
                  <span className="font-semibold text-green-600">
                    {(parseInt(lessonsCount) * parseFloat(selectedLessonType.price)).toLocaleString("ru-RU")} тг
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick amounts (only in manual mode) */}
          {!useAutoCalc && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Быстрый выбор
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickAmounts.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleQuickAmount(item.value)}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                      item.value > 0
                        ? "bg-green-50 text-green-600 hover:bg-green-100"
                        : "bg-red-50 text-red-600 hover:bg-red-100",
                      numericAmount === item.value && "ring-2 ring-offset-1",
                      numericAmount === item.value && item.value > 0 && "ring-green-500",
                      numericAmount === item.value && item.value < 0 && "ring-red-500"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Сумма *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              className={`input w-full ${error ? "border-red-500" : ""}`}
              placeholder="Введите сумму"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Описание
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              placeholder="Причина изменения баланса"
            />
          </div>

          {/* Preview */}
          {numericAmount !== 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Новый баланс:</span>
                <span className={clsx(
                  "font-semibold",
                  newBalance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {newBalance.toFixed(2)} тг
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-gray-500">Изменение:</span>
                <span className={clsx(
                  "font-medium text-sm",
                  numericAmount > 0 ? "text-green-600" : "text-red-600"
                )}>
                  {numericAmount > 0 ? "+" : ""}{numericAmount.toFixed(2)} тг
                </span>
              </div>
            </div>
          )}
          </form>
        </div>

        {/* Fixed footer with buttons */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn btn-secondary"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 btn btn-primary"
              disabled={isSubmitting || numericAmount === 0}
            >
              {isSubmitting ? "Сохранение..." : "Применить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
