import { useState, useEffect } from "react";
import { reportsApi } from "../services/api";
import type { TeacherReportResponse, TransactionReportResponse } from "../types";

type TabType = "teachers" | "transactions";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("teachers");

  return (
    <div>
      {/* Header */}
      <h1 className="page-title">Отчёты</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("teachers")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "teachers"
                  ? "border-cyan-500 text-cyan-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Преподаватели
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "transactions"
                  ? "border-cyan-500 text-cyan-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Транзакции
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "teachers" && <TeachersReport />}
      {activeTab === "transactions" && <TransactionsReport />}
    </div>
  );
}

// Teachers Report Component
function TeachersReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<TeacherReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      setError("Выберите даты");
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      await reportsApi.exportTeacherReport(dateFrom, dateTo);
    } catch (err) {
      console.error("Failed to export report:", err);
      setError("Не удалось выгрузить отчёт");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
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

          {report && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? "Выгрузка..." : "Выгрузить в Excel"}
            </button>
          )}
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

// Transactions Report Component
function TransactionsReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [report, setReport] = useState<TransactionReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadData = async (newPage: number = page) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsApi.transactionsReport({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
        page: newPage,
        size: pageSize,
      });
      setReport(data);
      setPage(newPage);
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setError("Не удалось загрузить транзакции");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [dateFrom, dateTo, search]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const formatMoney = (value: string) => {
    return parseFloat(value).toLocaleString("ru-RU") + " тг";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Отчёт по транзакциям учеников
        </h2>

        <div className="space-y-4">
          {/* Date filters */}
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

            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="btn btn-secondary"
              >
                Сбросить даты
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Поиск по ученику, описанию или менеджеру..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="input flex-1"
            />
            <button onClick={handleSearch} className="btn btn-primary">
              Найти
            </button>
            {search && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
                className="btn btn-secondary"
              >
                Очистить
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>

      {/* Results */}
      {isLoading && (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {!isLoading && report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              Найдено транзакций: {report.total}
            </p>
            <p className="text-lg font-semibold text-cyan-600">
              Общая сумма: {formatMoney(report.total_amount)}
            </p>
          </div>

          {report.items.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              Нет данных
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                        Дата
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                        Ученик
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">
                        Сумма
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                        Описание
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">
                        Менеджер
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((txn) => (
                      <tr
                        key={txn.transaction_id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {formatDate(txn.created_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-800">
                          {txn.student_name}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-semibold">
                          +{formatMoney(txn.amount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {txn.description || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {txn.created_by_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {report.pages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => loadData(page - 1)}
                    disabled={page === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <span className="py-2 px-4 text-gray-600">
                    Страница {page} из {report.pages}
                  </span>
                  <button
                    onClick={() => loadData(page + 1)}
                    disabled={page === report.pages}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Вперёд
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
