import { useState } from "react";
import { reportsApi } from "../services/api";
import type { TeacherReportResponse } from "../types";

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<TeacherReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      setError("Выберите даты");
      return;
    }

    if (dateFrom > dateTo) {
      setError('Дата "С" должна быть раньше даты "По"');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const data = await reportsApi.teacherReport(dateFrom, dateTo);
      setReport(data);
    } catch (err) {
      console.error("Failed to generate report:", err);
      setError("Не удалось сформировать отчёт");
    } finally {
      setIsLoading(false);
    }
  };

  const formatMoney = (value: string) => {
    return parseFloat(value).toLocaleString("ru-RU") + " тг";
  };

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Отчёты</h1>

      {/* Date Filter */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Отчёт по преподавателям
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата "С"
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата "По"
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? "Формирование..." : "Сформировать"}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Report Results */}
      {report && (
        <div className="space-y-6">
          {/* Period info */}
          <p className="text-gray-600">
            Период: {new Date(report.date_from).toLocaleDateString("ru-RU")} —{" "}
            {new Date(report.date_to).toLocaleDateString("ru-RU")}
          </p>

          {report.teachers.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              Нет данных за выбранный период
            </div>
          ) : (
            <>
              {/* Teachers tables */}
              {report.teachers.map((teacher) => (
                <div key={teacher.teacher_id} className="card overflow-hidden">
                  {/* Teacher header */}
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">
                      {teacher.teacher_name}
                    </h3>
                  </div>

                  {/* Table */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-6 font-medium text-gray-600 text-sm">
                          Имя ученика
                        </th>
                        <th className="text-left py-3 px-6 font-medium text-gray-600 text-sm">
                          Вид занятия
                        </th>
                        <th className="text-center py-3 px-6 font-medium text-gray-600 text-sm">
                          Кол-во занятий
                        </th>
                        <th className="text-right py-3 px-6 font-medium text-gray-600 text-sm">
                          Оплата преподавателю
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacher.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="py-3 px-6 text-gray-800">
                            {row.student_name}
                          </td>
                          <td className="py-3 px-6 text-gray-600">
                            {row.lesson_type}
                          </td>
                          <td className="py-3 px-6 text-center text-gray-600">
                            {row.lessons_count}
                          </td>
                          <td className="py-3 px-6 text-right text-gray-800">
                            {formatMoney(row.teacher_payment)}
                          </td>
                        </tr>
                      ))}
                      {/* Teacher total */}
                      <tr className="bg-cyan-50">
                        <td
                          colSpan={3}
                          className="py-3 px-6 font-semibold text-gray-800"
                        >
                          Итого за преподавателя
                        </td>
                        <td className="py-3 px-6 text-right font-semibold text-cyan-600">
                          {formatMoney(teacher.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Grand total */}
              <div className="card bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Общий итог</span>
                  <span className="text-2xl font-bold">
                    {formatMoney(report.grand_total)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
