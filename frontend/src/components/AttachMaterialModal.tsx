import { useState, useEffect, useMemo } from "react";
import { materialsApi } from "../services/api";
import type { Material } from "../types";

interface AttachMaterialModalProps {
  attachedMaterialIds: number[];
  onClose: () => void;
  onAttach: (materialId: number) => Promise<void>;
}

export default function AttachMaterialModal({
  attachedMaterialIds,
  onClose,
  onAttach,
}: AttachMaterialModalProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await materialsApi.list();
      setMaterials(data.items);
    } catch (error) {
      console.error("Failed to load materials:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter PDF materials only
  const pdfMaterials = useMemo(() => {
    return materials.filter((m) => m.file_url.toLowerCase().endsWith(".pdf"));
  }, [materials]);

  // Filter by search query
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return pdfMaterials;

    const query = searchQuery.toLowerCase();
    return pdfMaterials.filter((m) =>
      m.title.toLowerCase().includes(query)
    );
  }, [pdfMaterials, searchQuery]);

  // Separate attached and available materials
  const { attached, available } = useMemo(() => {
    const attached = filteredMaterials.filter((m) =>
      attachedMaterialIds.includes(m.id)
    );
    const available = filteredMaterials.filter(
      (m) => !attachedMaterialIds.includes(m.id)
    );
    return { attached, available };
  }, [filteredMaterials, attachedMaterialIds]);

  const handleAttach = async (materialId: number) => {
    try {
      setAttaching(true);
      await onAttach(materialId);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { detail?: string } } })?.response
              ?.data?.detail || "Не удалось прикрепить материал";
      alert(errorMessage);
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Прикрепить материал PDF
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

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск материалов..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Materials List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Загрузка материалов...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Available materials */}
              {available.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Доступные материалы ({available.length})
                  </h3>
                  <div className="space-y-2">
                    {available.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg
                            className="w-5 h-5 text-red-500 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-gray-800 truncate">
                            {material.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAttach(material.id)}
                          disabled={attaching}
                          className="btn btn-primary btn-sm flex-shrink-0 ml-3"
                        >
                          Прикрепить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already attached materials */}
              {attached.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Уже прикреплено ({attached.length})
                  </h3>
                  <div className="space-y-2">
                    {attached.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg
                            className="w-5 h-5 text-green-600 flex-shrink-0"
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
                          <span className="text-gray-800 truncate">
                            {material.title}
                          </span>
                        </div>
                        <span className="text-sm text-green-600 font-medium flex-shrink-0 ml-3">
                          Прикреплено
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {filteredMaterials.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p>
                    {searchQuery
                      ? "Материалов не найдено"
                      : "PDF материалов нет в базе"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
