import { useEffect, useState } from "react";
import { materialsApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { Material, MaterialFolder } from "../types";

interface MaterialFormData {
  title: string;
  file_url: string;
  folder_id?: number | null;
}

export default function MaterialsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  // Folder management state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameFolderTitle, setRenameFolderTitle] = useState("");
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<number | null>(null);

  const fetchFolders = async () => {
    try {
      const data = await materialsApi.listFolders();
      setFolders(data);
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    }
  };

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const response = await materialsApi.list(
        search || undefined,
        activeFolderId ?? undefined
      );
      setMaterials(response.items);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [search, activeFolderId]);

  const handleCreate = async (formData: MaterialFormData) => {
    await materialsApi.create({
      title: formData.title,
      file_url: formData.file_url,
      folder_id: activeFolderId,
    });
    await fetchMaterials();
  };

  const handleUpdate = async (formData: MaterialFormData) => {
    if (!editingMaterial) return;
    await materialsApi.update(editingMaterial.id, formData);
    await fetchMaterials();
  };

  const handleDelete = async (id: number) => {
    await materialsApi.delete(id);
    setDeleteConfirm(null);
    await fetchMaterials();
  };

  const openCreateModal = () => {
    setEditingMaterial(null);
    setIsModalOpen(true);
  };

  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
  };

  // Folder actions
  const handleCreateFolder = async () => {
    if (!newFolderTitle.trim()) return;
    try {
      await materialsApi.createFolder({
        title: newFolderTitle.trim(),
        position: folders.length,
      });
      setNewFolderTitle("");
      setShowCreateFolder(false);
      await fetchFolders();
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const handleRenameFolder = async (id: number) => {
    if (!renameFolderTitle.trim()) return;
    try {
      await materialsApi.updateFolder(id, { title: renameFolderTitle.trim() });
      setRenamingFolderId(null);
      setRenameFolderTitle("");
      await fetchFolders();
    } catch (error) {
      console.error("Failed to rename folder:", error);
    }
  };

  const handleDeleteFolder = async (id: number) => {
    try {
      await materialsApi.deleteFolder(id);
      setDeleteFolderConfirm(null);
      if (activeFolderId === id) setActiveFolderId(null);
      await fetchFolders();
      await fetchMaterials();
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const activeFolderTitle = activeFolderId
    ? folders.find((f) => f.id === activeFolderId)?.title
    : null;

  return (
    <div>
      <h1 className="page-title">Материалы</h1>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {folders.map((folder) => (
          <div key={folder.id} className="relative group">
            {renamingFolderId === folder.id ? (
              <div className="card p-4">
                <input
                  type="text"
                  value={renameFolderTitle}
                  onChange={(e) => setRenameFolderTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(folder.id);
                    if (e.key === "Escape") setRenamingFolderId(null);
                  }}
                  className="input w-full mb-2"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRenameFolder(folder.id)}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setRenamingFolderId(null)}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : deleteFolderConfirm === folder.id ? (
              <div className="card p-4 text-center">
                <p className="text-sm text-gray-600 mb-2">Удалить папку?</p>
                <p className="text-xs text-gray-400 mb-3">Материалы останутся без папки</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex-1"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => setDeleteFolderConfirm(null)}
                    className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex-1"
                  >
                    Нет
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setActiveFolderId(folder.id)}
                className={`card hover:shadow-lg transition-all duration-200 cursor-pointer group w-full ${
                  activeFolderId === folder.id ? "ring-2 ring-cyan-400" : ""
                }`}
              >
                <div className="flex flex-col items-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-center text-sm">
                    {folder.title}
                  </h3>
                </div>
              </button>
            )}

            {/* Folder actions (admin only) */}
            {isAdmin && renamingFolderId !== folder.id && deleteFolderConfirm !== folder.id && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFolderId(folder.id);
                    setRenameFolderTitle(folder.title);
                  }}
                  className="p-1 bg-white rounded shadow hover:bg-gray-100"
                  title="Переименовать"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteFolderConfirm(folder.id);
                  }}
                  className="p-1 bg-white rounded shadow hover:bg-gray-100"
                  title="Удалить"
                >
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Create folder button (admin only) */}
        {isAdmin && (
          showCreateFolder ? (
            <div className="card p-4">
              <input
                type="text"
                value={newFolderTitle}
                onChange={(e) => setNewFolderTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") setShowCreateFolder(false);
                }}
                placeholder="Название папки"
                className="input w-full mb-2"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateFolder}
                  className="btn btn-primary btn-sm flex-1"
                >
                  Создать
                </button>
                <button
                  onClick={() => { setShowCreateFolder(false); setNewFolderTitle(""); }}
                  className="btn btn-secondary btn-sm flex-1"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateFolder(true)}
              className="card hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-dashed border-gray-300 hover:border-cyan-400"
            >
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-400 text-center text-sm">
                  Создать папку
                </h3>
              </div>
            </button>
          )
        )}
      </div>

      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {activeFolderTitle || "Все материалы"}
          </h2>
          {activeFolderId && (
            <button
              onClick={() => setActiveFolderId(null)}
              className="btn btn-secondary btn-sm"
            >
              Все материалы
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Поиск"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-12"
            />
          </div>
        </div>

        {/* Create button (admin only) */}
        {isAdmin && (
          <div className="card mb-6 flex justify-center">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 text-cyan-500 font-medium hover:text-cyan-600 transition-colors py-2"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Добавить материал PDF
            </button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="card text-center py-12 text-gray-500">Загрузка...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-6 font-medium text-gray-600">
                  Название
                </th>
                <th className="text-center py-4 px-6 font-medium text-gray-600">
                  Открыть
                </th>
                {isAdmin && (
                  <th className="text-center py-4 px-6 font-medium text-gray-600">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr
                  key={material.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {material.title}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <a
                      href={material.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-500 hover:text-cyan-600 transition-colors"
                    >
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
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      Открыть
                    </a>
                  </td>
                  {isAdmin && (
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(material)}
                          className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"
                          title="Редактировать"
                        >
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        {deleteConfirm === material.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(material.id)}
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
                            onClick={() => setDeleteConfirm(material.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Удалить"
                          >
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {materials.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="py-12 text-center text-gray-500">
                    Материалы не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal */}
      <MaterialModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingMaterial ? handleUpdate : handleCreate}
        material={editingMaterial}
      />
    </div>
  );
}

// Modal Component
interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MaterialFormData) => Promise<void>;
  material?: Material | null;
}

function MaterialModal({
  isOpen,
  onClose,
  onSubmit,
  material,
}: MaterialModalProps) {
  const [formData, setFormData] = useState<MaterialFormData>({
    title: "",
    file_url: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof MaterialFormData, string>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");

  const isEditing = !!material;

  useEffect(() => {
    if (material) {
      setFormData({
        title: material.title,
        file_url: material.file_url,
      });
      setUploadMode("url");
    } else {
      setFormData({ title: "", file_url: "" });
      setUploadMode("file");
      setSelectedFile(null);
    }
    setErrors({});
  }, [material, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof MaterialFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Введите название";
    }

    if (uploadMode === "file") {
      if (!selectedFile && !isEditing) {
        newErrors.file_url = "Выберите PDF файл";
      }
    } else {
      if (!formData.file_url.trim()) {
        newErrors.file_url = "Введите ссылку на файл";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      let fileUrl = formData.file_url;

      // Upload file if in file mode and file is selected
      if (uploadMode === "file" && selectedFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", selectedFile);

        const token = localStorage.getItem("token");
        const response = await fetch("/api/uploads/materials", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formDataUpload,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Failed to upload file");
        }

        const uploadResult = await response.json();
        fileUrl = uploadResult.file_url;
      }

      await onSubmit({ ...formData, file_url: fileUrl });
      setFormData({ title: "", file_url: "" });
      setSelectedFile(null);
      setErrors({});
      onClose();
    } catch (error) {
      console.error("Failed to save material:", error);
      alert(error instanceof Error ? error.message : "Не удалось сохранить материал");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof MaterialFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setErrors((prev) => ({ ...prev, file_url: "Допускаются только PDF файлы" }));
        return;
      }

      // Validate file size (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, file_url: "Файл слишком большой (максимум 50 МБ)" }));
        return;
      }

      setSelectedFile(file);
      // Auto-fill title if empty
      if (!formData.title) {
        const titleFromFilename = file.name.replace(/\.pdf$/i, "");
        setFormData((prev) => ({ ...prev, title: titleFromFilename }));
      }
      setErrors((prev) => ({ ...prev, file_url: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? "Редактировать материал" : "Добавить материал PDF"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`input w-full ${errors.title ? "border-red-500" : ""}`}
              placeholder="Название материала"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          {!isEditing && (
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  uploadMode === "file"
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("url")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  uploadMode === "url"
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Указать URL
              </button>
            </div>
          )}

          {uploadMode === "file" && !isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF файл *
              </label>
              <div className="mt-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-cyan-500 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      {selectedFile ? (
                        <span className="font-semibold text-cyan-600">{selectedFile.name}</span>
                      ) : (
                        <>
                          <span className="font-semibold">Нажмите для выбора</span> или перетащите файл
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">PDF (максимум 50 МБ)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              {errors.file_url && (
                <p className="text-red-500 text-sm mt-1">{errors.file_url}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на файл (URL) *
              </label>
              <input
                type="url"
                name="file_url"
                value={formData.file_url}
                onChange={handleChange}
                className={`input w-full ${errors.file_url ? "border-red-500" : ""}`}
                placeholder="https://..."
              />
              {errors.file_url && (
                <p className="text-red-500 text-sm mt-1">{errors.file_url}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn btn-secondary"
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary"
              disabled={isLoading}
            >
              {isLoading
                ? "Сохранение..."
                : isEditing
                  ? "Сохранить"
                  : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
