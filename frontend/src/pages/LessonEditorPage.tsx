import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { interactiveLessonApi, blockApi } from "../services/courseApi";
import { useAuthStore } from "../store/authStore";
import type {
  InteractiveLessonDetail,
  ExerciseBlock,
  ExerciseBlockType,
} from "../types/course";
import {
  BLOCK_TYPE_LABELS,
  CONTENT_BLOCK_TYPES,
  INTERACTIVE_BLOCK_TYPES,
} from "../types/course";
import BlockEditor from "../components/blocks/BlockEditor";

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [lesson, setLesson] = useState<InteractiveLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ExerciseBlock | null>(null);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  // Only admin can edit lessons
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/courses");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (id) loadLesson();
  }, [id]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const data = await interactiveLessonApi.get(Number(id));
      setLesson(data);
    } catch (error) {
      console.error("Failed to load lesson:", error);
      alert("Не удалось загрузить урок");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async (blockType: ExerciseBlockType) => {
    if (!lesson) return;
    try {
      setSaving(true);
      const defaultContent = getDefaultContent(blockType);
      const pos = insertPosition;
      const block = await blockApi.create(lesson.id, {
        block_type: blockType,
        content: defaultContent,
        ...(pos !== null ? { position: pos } : {}),
      });

      let newBlocks: ExerciseBlock[];
      if (pos !== null) {
        // Insert at position and reorder
        newBlocks = [...lesson.blocks];
        newBlocks.splice(pos, 0, block);
        const reorderItems = newBlocks.map((b, i) => ({
          id: b.id,
          position: i,
        }));
        await blockApi.reorder(lesson.id, reorderItems);
        newBlocks = newBlocks.map((b, i) => ({ ...b, position: i }));
      } else {
        newBlocks = [...lesson.blocks, block];
      }

      setLesson({ ...lesson, blocks: newBlocks });
      setShowAddBlockModal(false);
      setInsertPosition(null);
      setEditingBlock(block);
    } catch (error) {
      console.error("Failed to create block:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBlock = async (
    block: ExerciseBlock,
    content: Record<string, unknown>,
    title?: string | null,
  ) => {
    if (!lesson) return;
    try {
      setSaving(true);
      const updated = await blockApi.update(block.id, { content, title });
      setLesson({
        ...lesson,
        blocks: lesson.blocks.map((b) => (b.id === updated.id ? updated : b)),
      });
      setEditingBlock(null);
    } catch (error) {
      console.error("Failed to update block:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeBlockType = async (
    block: ExerciseBlock,
    newType: ExerciseBlockType,
  ) => {
    if (!lesson || newType === block.block_type) return;

    // Groups of compatible types with preservable fields
    const compatibilityGroups: { types: string[]; fields: string[] }[] = [
      { types: ["text", "teaching_guide", "remember", "article"], fields: ["html"] },
      { types: ["video", "audio"], fields: ["url", "title"] },
      { types: ["test", "true_false", "image_choice"], fields: ["explanation"] },
    ];

    const oldContent = block.content as Record<string, unknown>;
    const preservedFields: Record<string, unknown> = {};

    for (const group of compatibilityGroups) {
      if (group.types.includes(block.block_type) && group.types.includes(newType)) {
        for (const field of group.fields) {
          if (oldContent[field]) {
            preservedFields[field] = oldContent[field];
          }
        }
        break;
      }
    }

    const hasPreservable = Object.keys(preservedFields).length > 0;
    if (
      !hasPreservable &&
      !confirm("Содержимое блока будет сброшено. Продолжить?")
    )
      return;
    try {
      setSaving(true);
      const defaultContent = getDefaultContent(newType);
      const newContent = hasPreservable
        ? { ...defaultContent, ...preservedFields }
        : defaultContent;
      const updated = await blockApi.update(block.id, {
        block_type: newType,
        content: newContent,
      });
      setLesson({
        ...lesson,
        blocks: lesson.blocks.map((b) => (b.id === updated.id ? updated : b)),
      });
      if (editingBlock?.id === block.id) {
        setEditingBlock(updated);
      }
    } catch (error) {
      console.error("Failed to change block type:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: number) => {
    if (!lesson || !confirm("Удалить блок?")) return;
    try {
      await blockApi.delete(blockId);
      setLesson({
        ...lesson,
        blocks: lesson.blocks.filter((b) => b.id !== blockId),
      });
      if (editingBlock?.id === blockId) {
        setEditingBlock(null);
      }
    } catch (error) {
      console.error("Failed to delete block:", error);
    }
  };

  const handleMoveBlock = async (blockId: number, direction: "up" | "down") => {
    if (!lesson) return;
    const index = lesson.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === lesson.blocks.length - 1) return;

    const newBlocks = [...lesson.blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[swapIndex]] = [
      newBlocks[swapIndex],
      newBlocks[index],
    ];

    // Update positions
    const reorderItems = newBlocks.map((b, i) => ({ id: b.id, position: i }));
    try {
      await blockApi.reorder(lesson.id, reorderItems);
      setLesson({
        ...lesson,
        blocks: newBlocks.map((b, i) => ({ ...b, position: i })),
      });
    } catch (error) {
      console.error("Failed to reorder blocks:", error);
    }
  };

  const handleTogglePublished = async () => {
    if (!lesson) return;
    try {
      setSaving(true);
      await interactiveLessonApi.update(lesson.id, {
        is_published: !lesson.is_published,
      });
      setLesson({ ...lesson, is_published: !lesson.is_published });
    } catch (error) {
      console.error("Failed to toggle published:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-12 text-gray-500">Урок не найден</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Назад
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-gray-600 mt-1">{lesson.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lesson.is_published}
                onChange={handleTogglePublished}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Опубликован</span>
            </label>
            <button
              onClick={() => navigate(`/courses/lessons/${lesson.id}`)}
              className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Предпросмотр
            </button>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {lesson.blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
            В этом уроке пока нет блоков
          </div>
        ) : (
          lesson.blocks.map((block, index) => (
            <div key={block.id}>
              {/* Insert button before block */}
              <div className="group flex items-center gap-2 py-1 -my-1">
                <div className="flex-1 h-px bg-transparent group-hover:bg-purple-200 transition-colors" />
                <button
                  onClick={() => {
                    setInsertPosition(index);
                    setShowAddBlockModal(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-full"
                  title="Вставить блок здесь"
                >
                  <svg
                    className="w-4 h-4"
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
                </button>
                <div className="flex-1 h-px bg-transparent group-hover:bg-purple-200 transition-colors" />
              </div>

              <div
                className={`bg-white rounded-xl border ${
                  editingBlock?.id === block.id
                    ? "border-purple-300 ring-2 ring-purple-100"
                    : "border-gray-100"
                }`}
              >
                {/* Block Header */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-cyan-600">
                      1.{index + 1}
                    </span>
                    {block.title && (
                      <span className="text-sm font-medium text-gray-800">
                        {block.title}
                      </span>
                    )}
                    <select
                      value={block.block_type}
                      onChange={(e) =>
                        handleChangeBlockType(
                          block,
                          e.target.value as ExerciseBlockType,
                        )
                      }
                      className="text-xs bg-transparent border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:border-purple-300 focus:border-purple-400 focus:ring-1 focus:ring-purple-200 cursor-pointer"
                    >
                      <optgroup label="Контент">
                        {CONTENT_BLOCK_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {BLOCK_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Упражнения">
                        {INTERACTIVE_BLOCK_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {BLOCK_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveBlock(block.id, "up")}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Вверх"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveBlock(block.id, "down")}
                      disabled={index === lesson.blocks.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Вниз"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        setEditingBlock(
                          editingBlock?.id === block.id ? null : block,
                        )
                      }
                      className={`p-1 ${editingBlock?.id === block.id ? "text-purple-600" : "text-gray-400 hover:text-purple-600"}`}
                      title="Редактировать"
                    >
                      <svg
                        className="w-4 h-4"
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
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Удалить"
                    >
                      <svg
                        className="w-4 h-4"
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
                  </div>
                </div>

                {/* Block Content / Editor */}
                <div className="p-4">
                  {editingBlock?.id === block.id ? (
                    <BlockEditor
                      block={block}
                      onSave={(content, title) =>
                        handleUpdateBlock(block, content, title)
                      }
                      onCancel={() => setEditingBlock(null)}
                      saving={saving}
                    />
                  ) : (
                    <BlockPreview block={block} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Add Block Button */}
        <button
          onClick={() => {
            setInsertPosition(null);
            setShowAddBlockModal(true);
          }}
          className="w-full py-4 text-purple-600 border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
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
          Добавить блок
        </button>
      </div>

      {/* Add Block Modal */}
      {showAddBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Добавить блок</h2>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Контент
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_BLOCK_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAddBlock(type)}
                    disabled={saving}
                    className="p-3 text-left border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <div className="font-medium text-gray-800">
                      {BLOCK_TYPE_LABELS[type]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getBlockDescription(type)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Упражнения
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {INTERACTIVE_BLOCK_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAddBlock(type)}
                    disabled={saving}
                    className="p-3 text-left border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <div className="font-medium text-gray-800">
                      {BLOCK_TYPE_LABELS[type]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getBlockDescription(type)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowAddBlockModal(false);
                  setInsertPosition(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Block Preview Component
function BlockPreview({ block }: { block: ExerciseBlock }) {
  const content = block.content as Record<string, unknown>;

  switch (block.block_type) {
    case "text":
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: (content.html as string) || "<em>Пустой текст</em>",
          }}
        />
      );

    case "video":
      return (
        <div className="text-gray-600">
          {content.url ? (
            <span>Видео: {content.url as string}</span>
          ) : (
            <em>URL не указан</em>
          )}
        </div>
      );

    case "audio":
      return (
        <div className="text-gray-600">
          {content.url ? (
            <span>Аудио: {content.url as string}</span>
          ) : (
            <em>URL не указан</em>
          )}
        </div>
      );

    case "article":
      return (
        <div className="flex gap-4">
          {typeof content.image_url === "string" && content.image_url && (
            <img
              src={content.image_url}
              alt=""
              className="w-24 h-24 object-cover rounded"
            />
          )}
          <div
            className="prose prose-sm max-w-none flex-1"
            dangerouslySetInnerHTML={{
              __html: (content.html as string) || "<em>Пустой текст</em>",
            }}
          />
        </div>
      );

    case "divider":
      return <hr className="border-gray-200" />;

    case "page_break":
      return (
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 border-t-2 border-dashed border-orange-400" />
          <span className="text-xs font-medium text-orange-500">
            Разрыв страницы{content.label ? `: ${content.label}` : ""}
          </span>
          <div className="flex-1 border-t-2 border-dashed border-orange-400" />
        </div>
      );

    case "fill_gaps":
      return (
        <div className="text-gray-600">
          {content.text ? (
            <span>{(content.text as string).substring(0, 100)}...</span>
          ) : (
            <em>Текст не указан</em>
          )}
        </div>
      );

    case "test":
      return (
        <div>
          <div className="font-medium">
            {(content.question as string) || <em>Вопрос не указан</em>}
          </div>
          {Array.isArray(content.options) && (
            <div className="mt-2 text-sm text-gray-500">
              {(content.options as { text: string }[]).length} вариантов ответа
            </div>
          )}
        </div>
      );

    case "true_false":
      return (
        <div>
          <div className="font-medium">
            {(content.statement as string) || <em>Утверждение не указано</em>}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Ответ: {content.is_true ? "Верно" : "Неверно"}
          </div>
        </div>
      );

    case "word_order":
      return (
        <div className="text-gray-600">
          {content.correct_sentence ? (
            <span>Предложение: {content.correct_sentence as string}</span>
          ) : (
            <em>Предложение не указано</em>
          )}
        </div>
      );

    case "matching":
      return (
        <div className="text-gray-600">
          {Array.isArray(content.pairs) ? (
            <span>
              {(content.pairs as unknown[]).length} пар для сопоставления
            </span>
          ) : (
            <em>Пары не указаны</em>
          )}
        </div>
      );

    case "essay":
      return (
        <div className="text-gray-600">
          {content.prompt ? (
            <span>{(content.prompt as string).substring(0, 100)}...</span>
          ) : (
            <em>Задание не указано</em>
          )}
        </div>
      );

    case "image":
      return (
        <div>
          {content.url ? (
            <img
              src={content.url as string}
              alt=""
              className="max-w-full h-auto max-h-32 rounded"
            />
          ) : (
            <em className="text-gray-500">Изображение не добавлено</em>
          )}
          {typeof content.caption === "string" && content.caption && (
            <p className="text-sm text-gray-500 mt-1">{content.caption}</p>
          )}
        </div>
      );

    case "teaching_guide":
      return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-xs text-red-500 font-medium mb-1">
            Только для учителя
          </div>
          <div
            className="text-sm text-red-700"
            dangerouslySetInnerHTML={{
              __html: (content.html as string) || "<em>Пусто</em>",
            }}
          />
        </div>
      );

    case "remember":
      return (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-500 font-medium mb-1">Запомни!</div>
          <div
            className="text-sm text-blue-700"
            dangerouslySetInnerHTML={{
              __html: (content.html as string) || "<em>Пусто</em>",
            }}
          />
        </div>
      );

    case "table":
      return (
        <div className="text-gray-600">
          {Array.isArray(content.rows) ? (
            <span>Таблица: {(content.rows as unknown[]).length} строк</span>
          ) : (
            <em>Таблица пуста</em>
          )}
        </div>
      );

    case "image_choice":
      return (
        <div>
          <div className="font-medium">
            {(content.question as string) || <em>Вопрос не указан</em>}
          </div>
          {Array.isArray(content.options) && (
            <div className="mt-2 text-sm text-gray-500">
              {(content.options as unknown[]).length} изображений
            </div>
          )}
        </div>
      );

    case "flashcards":
      return (
        <div className="text-gray-600">
          {typeof content.title === "string" && content.title && (
            <span className="font-medium">{content.title}: </span>
          )}
          {Array.isArray(content.cards) ? (
            <span>{(content.cards as unknown[]).length} карточек</span>
          ) : (
            <em>Карточки не добавлены</em>
          )}
        </div>
      );

    case "vocabulary":
      return (
        <div className="text-gray-600">
          {Array.isArray(content.words) ? (
            <span>{(content.words as unknown[]).length} слов</span>
          ) : (
            <em>Слова не добавлены</em>
          )}
        </div>
      );

    default:
      return <div className="text-gray-500">Неизвестный тип блока</div>;
  }
}

// Helper functions
function getDefaultContent(
  blockType: ExerciseBlockType,
): Record<string, unknown> {
  switch (blockType) {
    case "text":
      return { html: "" };
    case "video":
      return { url: "", title: "" };
    case "audio":
      return { url: "", title: "" };
    case "image":
      return { url: "", caption: "" };
    case "article":
      return { html: "", image_url: "", image_position: "right" };
    case "divider":
      return { style: "line" };
    case "teaching_guide":
      return { html: "" };
    case "remember":
      return { html: "", icon: "info" };
    case "table":
      return { rows: [], has_header: true };
    case "fill_gaps":
      return { text: "", gaps: [] };
    case "test":
      return {
        question: "",
        options: [],
        multiple_answers: false,
        explanation: "",
      };
    case "true_false":
      return { statement: "", is_true: true, explanation: "" };
    case "word_order":
      return { correct_sentence: "", shuffled_words: [], hint: "" };
    case "matching":
      return { pairs: [], shuffle_right: true };
    case "image_choice":
      return { question: "", options: [], explanation: "" };
    case "flashcards":
      return { title: "", cards: [], shuffle: true };
    case "essay":
      return {
        prompt: "",
        min_words: null,
        max_words: null,
        sample_answer: "",
      };
    case "vocabulary":
      return { words: [], show_transcription: false };
    case "page_break":
      return { label: "" };
    case "drag_words":
      return { text: "", words: [], distractors: [] };
    case "sentence_choice":
      return { questions: [] };
    default:
      return {};
  }
}

function getBlockDescription(blockType: ExerciseBlockType): string {
  switch (blockType) {
    case "text":
      return "Форматированный текст";
    case "video":
      return "YouTube или Vimeo";
    case "audio":
      return "Аудиофайл";
    case "image":
      return "Изображение или карусель";
    case "article":
      return "Текст с изображением";
    case "divider":
      return "Визуальный разделитель";
    case "teaching_guide":
      return "Инструкция для учителя";
    case "remember":
      return "Важная информация";
    case "table":
      return "Грамматическая таблица";
    case "vocabulary":
      return "Список слов с переводом";
    case "fill_gaps":
      return "Заполнить пропуски";
    case "test":
      return "Тест с выбором";
    case "true_false":
      return "Верно или неверно";
    case "word_order":
      return "Составить предложение";
    case "matching":
      return "Сопоставить пары";
    case "image_choice":
      return "Выбрать изображение";
    case "flashcards":
      return "Интерактивные карточки";
    case "essay":
      return "Свободный текст";
    case "page_break":
      return "Разделяет урок на страницы";
    case "drag_words":
      return "Перетащить слова на места";
    case "sentence_choice":
      return "Выбор из выпадающего списка";
    default:
      return "";
  }
}
