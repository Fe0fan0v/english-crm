import { useState, useEffect } from "react";
import { usersApi } from "../services/api";
import DirectChat, { ConversationList } from "../components/DirectChat";
import type { User } from "../types";

type Tab = "active" | "all";

export default function ManagerMessagesPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("active");

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list(1, 10000, undefined, "student");
      setStudents(response.items);
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectConversation = (userId: number, userName: string) => {
    setSelectedStudent({ id: userId, name: userName });
  };

  return (
    <div>
      <h1 className="page-title">Сообщения</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-1">
          <div className="card">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setActiveTab("active")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "active"
                    ? "border-cyan-500 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Активные чаты
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "all"
                    ? "border-cyan-500 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Все ученики
              </button>
            </div>

            {activeTab === "active" ? (
              <div className="max-h-[600px] overflow-y-auto">
                <ConversationList
                  onSelectConversation={handleSelectConversation}
                  selectedUserId={selectedStudent?.id}
                />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Поиск учеников..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input w-full"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {search ? "Ученики не найдены" : "Нет учеников"}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        onClick={() =>
                          setSelectedStudent({
                            id: student.id,
                            name: student.name,
                          })
                        }
                        className={`
                          w-full text-left p-3 rounded-lg transition-colors
                          ${
                            selectedStudent?.id === student.id
                              ? "bg-cyan-50 border-cyan-200"
                              : "hover:bg-gray-50 border-transparent"
                          }
                          border
                        `}
                      >
                        <div className="font-medium text-gray-800">
                          {student.name}
                        </div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Баланс: {parseFloat(student.balance).toLocaleString("ru-RU")} тг
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <DirectChat
              partnerId={selectedStudent.id}
              partnerName={selectedStudent.name}
              onClose={() => setSelectedStudent(null)}
            />
          ) : (
            <div className="card text-center py-12 text-gray-500">
              Выберите ученика для начала общения
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
