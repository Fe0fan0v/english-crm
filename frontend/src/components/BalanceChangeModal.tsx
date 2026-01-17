import { useState, useEffect } from "react";
import clsx from "clsx";

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

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setError("");
    }
  }, [isOpen]);

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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Изменить баланс
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Ученик</p>
          <p className="font-medium text-gray-800">{userName}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">Текущий баланс:</span>
            <span className="font-semibold text-gray-800">{currentBalance} тг</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick amounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Быстрый выбор
            </label>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleQuickAmount(item.value)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
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

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              placeholder="Введите сумму (положительную для пополнения, отрицательную для списания)"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Новый баланс:</span>
                <span className={clsx(
                  "font-semibold text-lg",
                  newBalance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {newBalance.toFixed(2)} тг
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-500">Изменение:</span>
                <span className={clsx(
                  "font-medium",
                  numericAmount > 0 ? "text-green-600" : "text-red-600"
                )}>
                  {numericAmount > 0 ? "+" : ""}{numericAmount.toFixed(2)} тг
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
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
              className="flex-1 btn btn-primary"
              disabled={isSubmitting || numericAmount === 0}
            >
              {isSubmitting ? "Сохранение..." : "Применить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
