import { useEffect, useState } from "react";
import axios from "axios";

interface News {
  id: number;
  title: string;
  content: string;
  banner_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function NewsManagementPage() {
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get<{ items: News[]; total: number }>("/api/news?show_unpublished=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNews(response.data.items);
    } catch (error) {
      console.error("Failed to fetch news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/news/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchNews();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete news:", error);
      alert("Не удалось удалить новость");
    }
  };

  const openCreateModal = () => {
    setEditingNews(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: News) => {
    setEditingNews(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNews(null);
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="page-title">Управление новостями</h1>
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">Управление новостями</h1>
        <button onClick={openCreateModal} className="btn btn-primary">
          + Создать новость
        </button>
      </div>

      {news.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Новостей пока нет. Создайте первую новость!
        </div>
      ) : (
        <div className="grid gap-6">
          {news.map((item) => (
            <div key={item.id} className="card">
              <div className="flex gap-4">
                {item.banner_url && (
                  <img
                    src={item.banner_url}
                    alt={item.title}
                    className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {item.title}
                        </h3>
                        {!item.is_published && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            Черновик
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                        {item.content}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"
                        title="Редактировать"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {deleteConfirm === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Удалить"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        news={editingNews}
        onSuccess={fetchNews}
      />
    </div>
  );
}

// Modal Component
interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  news: News | null;
  onSuccess: () => void;
}

function NewsModal({ isOpen, onClose, news, onSuccess }: NewsModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    banner_url: "",
    is_published: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bannerInputType, setBannerInputType] = useState<"url" | "file">("url");
  const [uploadingFile, setUploadingFile] = useState(false);

  const isEditing = !!news;

  useEffect(() => {
    if (news) {
      setFormData({
        title: news.title,
        content: news.content,
        banner_url: news.banner_url || "",
        is_published: news.is_published,
      });
      setBannerInputType("url");
    } else {
      setFormData({
        title: "",
        content: "",
        banner_url: "",
        is_published: true,
      });
      setBannerInputType("url");
    }
    setErrors({});
  }, [news, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("Файл слишком большой. Максимальный размер: 10 МБ");
      return;
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Неподдерживаемый формат файла. Разрешены: JPG, PNG, GIF, WebP");
      return;
    }

    setUploadingFile(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post<{ file_url: string }>("/api/uploads/chat", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setFormData((prev) => ({ ...prev, banner_url: response.data.file_url }));
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Не удалось загрузить файл");
    } finally {
      setUploadingFile(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = "Введите заголовок";
    }
    if (!formData.content.trim()) {
      newErrors.content = "Введите содержание";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const data = {
        ...formData,
        banner_url: formData.banner_url || null,
      };

      if (isEditing) {
        await axios.patch(`/api/news/${news.id}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post("/api/news", data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      await onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save news:", error);
      alert("Не удалось сохранить новость");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? "Редактировать новость" : "Создать новость"}
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Заголовок *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`input w-full ${errors.title ? "border-red-500" : ""}`}
              placeholder="Заголовок новости"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Содержание *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className={`input w-full min-h-[150px] ${errors.content ? "border-red-500" : ""}`}
              placeholder="Текст новости"
            />
            {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Баннер (необязательно)
            </label>

            {/* Toggle between URL and File */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setBannerInputType("url")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  bannerInputType === "url"
                    ? "bg-cyan-100 text-cyan-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Ссылка
              </button>
              <button
                type="button"
                onClick={() => setBannerInputType("file")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  bannerInputType === "file"
                    ? "bg-cyan-100 text-cyan-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Загрузить файл
              </button>
            </div>

            {bannerInputType === "url" ? (
              <input
                type="url"
                value={formData.banner_url}
                onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                className="input w-full"
                placeholder="https://example.com/image.jpg"
              />
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer"
                />
                {uploadingFile && (
                  <p className="text-sm text-gray-500 mt-2">Загрузка...</p>
                )}
              </div>
            )}

            {/* Preview */}
            {formData.banner_url && (
              <div className="mt-3">
                <img
                  src={formData.banner_url}
                  alt="Banner preview"
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, banner_url: "" })}
                  className="text-sm text-red-500 hover:text-red-600 mt-2"
                >
                  Удалить баннер
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_published"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="is_published" className="text-sm text-gray-700">
              Опубликовать новость
            </label>
          </div>
        </form>

        <div className="border-t border-gray-100 p-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn btn-secondary"
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Сохранение..." : isEditing ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
