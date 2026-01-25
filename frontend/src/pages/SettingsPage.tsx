import { useEffect, useState } from "react";
import axios from "axios";

interface Setting {
  id: number;
  key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get<Setting[]>("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Settings loaded:", response.data);
      setSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response:", error.response?.data);
        console.error("Status:", error.response?.status);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleEdit = (setting: Setting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value || "");
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const handleSave = async (key: string) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `/api/settings/${key}`,
        { value: editValue },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await fetchSettings();
      setEditingKey(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update setting:", error);
      alert("Не удалось сохранить настройку");
    } finally {
      setIsSaving(false);
    }
  };

  const getSettingLabel = (key: string): string => {
    const labels: Record<string, string> = {
      whatsapp_manager_phone: "Телефон менеджера (WhatsApp)",
    };
    return labels[key] || key;
  };

  const getSettingDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      whatsapp_manager_phone:
        "Номер телефона в формате +7XXXXXXXXXX для связи с менеджером через WhatsApp",
    };
    return descriptions[key] || "";
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="page-title">Настройки</h1>
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Настройки системы</h1>

      <div className="card">
        <div className="space-y-6">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="pb-6 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 mb-1">
                    {getSettingLabel(setting.key)}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {getSettingDescription(setting.key)}
                  </p>

                  {editingKey === setting.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="input flex-1 max-w-md"
                        placeholder={`Введите ${getSettingLabel(setting.key).toLowerCase()}`}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(setting.key)}
                        disabled={isSaving}
                        className="btn btn-primary"
                      >
                        {isSaving ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="btn btn-secondary"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-800 font-mono bg-gray-50 px-3 py-1.5 rounded-lg">
                        {setting.value || "(не задано)"}
                      </span>
                      <button
                        onClick={() => handleEdit(setting)}
                        className="text-cyan-500 hover:text-cyan-600 text-sm font-medium transition-colors"
                      >
                        Изменить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {settings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Настройки не найдены
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
