import { useEffect, useState } from "react";
import { homeworkTemplatesApi, courseMaterialsApi } from "../services/api";
import type { HomeworkTemplate } from "../services/api";
import type { CourseTreeItem } from "../types";

export default function TestsPage() {
  const [templates, setTemplates] = useState<HomeworkTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<HomeworkTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await homeworkTemplatesApi.list();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await homeworkTemplatesApi.delete(id);
      setDeleteConfirm(null);
      await fetchTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  return (
    <div>
      <h1 className="page-title">Домашние задания</h1>

      {/* Create button */}
      <div className="card mb-6 flex justify-center">
        <button
          onClick={() => {
            setEditingTemplate(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 text-cyan-500 font-medium hover:text-cyan-600 transition-colors py-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать шаблон ДЗ
        </button>
      </div>

      {/* Templates list */}
      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Шаблоны домашних заданий не найдены
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{tmpl.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Курс: <span className="font-medium">{tmpl.course_title}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tmpl.items.length} урок(ов) в шаблоне
                  </p>
                  {tmpl.items.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {tmpl.items.map((item) => (
                        <div key={item.id} className="text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {item.interactive_lesson_title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditingTemplate(tmpl);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"
                    title="Редактировать"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {deleteConfirm === tmpl.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(tmpl.id)}
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
                      onClick={() => setDeleteConfirm(tmpl.id)}
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
          ))}
        </div>
      )}

      <p className="text-gray-500 text-sm mt-4">Всего шаблонов: {templates.length}</p>

      {/* Modal */}
      <HomeworkTemplateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTemplate(null);
        }}
        onSave={fetchTemplates}
        template={editingTemplate}
      />
    </div>
  );
}

// Modal Component
interface HomeworkTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  template?: HomeworkTemplate | null;
}

function HomeworkTemplateModal({ isOpen, onClose, onSave, template }: HomeworkTemplateModalProps) {
  const [title, setTitle] = useState("");
  const [courseTree, setCourseTree] = useState<CourseTreeItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!template;

  useEffect(() => {
    if (isOpen) {
      loadTree();
      if (template) {
        setTitle(template.title);
        setSelectedCourseId(template.course_id);
        setSelectedLessonIds(new Set(template.items.map((i) => i.interactive_lesson_id)));
      } else {
        setTitle("");
        setSelectedCourseId(null);
        setSelectedLessonIds(new Set());
      }
    }
  }, [isOpen, template]);

  const loadTree = async () => {
    setIsLoading(true);
    try {
      const tree = await courseMaterialsApi.getCourseTree();
      setCourseTree(tree);
    } catch (error) {
      console.error("Failed to load course tree:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCourse = courseTree.find((c) => c.id === selectedCourseId);

  // Collect all interactive lessons from course tree
  const collectLessons = (node: CourseTreeItem): { id: number; title: string; path: string }[] => {
    const results: { id: number; title: string; path: string }[] = [];
    if (node.type === "lesson") {
      results.push({ id: node.id, title: node.title, path: node.title });
    }
    for (const child of node.children || []) {
      const childResults = collectLessons(child);
      for (const r of childResults) {
        results.push({
          ...r,
          path: node.type !== "course" ? `${node.title} > ${r.path}` : r.path,
        });
      }
    }
    return results;
  };

  const availableLessons = selectedCourse ? collectLessons(selectedCourse) : [];

  const toggleLesson = (id: number) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedCourseId) return;

    setIsSaving(true);
    try {
      if (isEditing && template) {
        await homeworkTemplatesApi.update(template.id, {
          title: title.trim(),
          interactive_lesson_ids: Array.from(selectedLessonIds),
        });
      } else {
        await homeworkTemplatesApi.create({
          title: title.trim(),
          course_id: selectedCourseId,
          interactive_lesson_ids: Array.from(selectedLessonIds),
        });
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? "Редактировать шаблон ДЗ" : "Создать шаблон ДЗ"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Название шаблона ДЗ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Курс *</label>
            {isLoading ? (
              <p className="text-gray-500 text-sm">Загрузка...</p>
            ) : (
              <select
                value={selectedCourseId || ""}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value ? Number(e.target.value) : null);
                  if (!isEditing) setSelectedLessonIds(new Set());
                }}
                className="input w-full"
                disabled={isEditing}
              >
                <option value="">Выберите курс</option>
                {courseTree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedCourseId && (
            <div className="flex-1 min-h-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Уроки ({selectedLessonIds.size} выбрано)
              </label>
              <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-[300px] p-2 space-y-1">
                {availableLessons.length === 0 ? (
                  <p className="text-gray-500 text-sm p-2">Нет доступных уроков</p>
                ) : (
                  availableLessons.map((lesson) => (
                    <label
                      key={lesson.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLessonIds.has(lesson.id)}
                        onChange={() => toggleLesson(lesson.id)}
                        className="mt-0.5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{lesson.title}</p>
                        <p className="text-xs text-gray-400 truncate">{lesson.path}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary" disabled={isSaving}>
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary"
              disabled={isSaving || !title.trim() || !selectedCourseId}
            >
              {isSaving ? "Сохранение..." : isEditing ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
