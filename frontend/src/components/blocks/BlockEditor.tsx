import { useState, useRef, useEffect, useCallback } from "react";
import type { ExerciseBlock } from "../../types/course";
import { courseUploadApi } from "../../services/courseApi";
import { vocabularyApi } from "../../services/api";
import HtmlEditor from "../HtmlEditor";

interface BlockEditorProps {
  block: ExerciseBlock;
  onSave: (content: Record<string, unknown>, title?: string | null) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function BlockEditor({
  block,
  onSave,
  onCancel,
  saving,
}: BlockEditorProps) {
  const [content, setContent] = useState<Record<string, unknown>>(
    block.content,
  );
  const [title, setTitle] = useState<string>(block.title || "");

  const handleSave = () => {
    onSave(content, title || null);
  };

  const updateField = (field: string, value: unknown) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const renderEditor = () => {
    switch (block.block_type) {
      case "text":
        return (
          <TextEditor
            html={(content.html as string) || ""}
            onChange={(html) => updateField("html", html)}
          />
        );

      case "video":
        return (
          <VideoEditor
            url={(content.url as string) || ""}
            title={(content.title as string) || ""}
            onUrlChange={(url) => updateField("url", url)}
            onTitleChange={(title) => updateField("title", title)}
          />
        );

      case "audio":
        return (
          <AudioEditor
            url={(content.url as string) || ""}
            title={(content.title as string) || ""}
            onUrlChange={(url) => updateField("url", url)}
            onTitleChange={(title) => updateField("title", title)}
          />
        );

      case "article":
        return (
          <ArticleEditor
            html={(content.html as string) || ""}
            imageUrl={(content.image_url as string) || ""}
            imagePosition={(content.image_position as string) || "right"}
            onHtmlChange={(html) => updateField("html", html)}
            onImageUrlChange={(url) => updateField("image_url", url)}
            onImagePositionChange={(pos) => updateField("image_position", pos)}
          />
        );

      case "divider":
        return (
          <DividerEditor
            style={(content.style as string) || "line"}
            onChange={(style) => updateField("style", style)}
          />
        );

      case "page_break":
        return (
          <PageBreakEditor
            label={(content.label as string) || ""}
            onChange={(label) => updateField("label", label)}
          />
        );

      case "fill_gaps":
        return (
          <FillGapsEditor
            text={(content.text as string) || ""}
            gaps={(content.gaps as GapItem[]) || []}
            onTextChange={(text) => updateField("text", text)}
            onGapsChange={(gaps) => updateField("gaps", gaps)}
          />
        );

      case "test":
        return (
          <TestEditor
            question={(content.question as string) || ""}
            options={(content.options as TestOption[]) || []}
            multipleAnswers={(content.multiple_answers as boolean) || false}
            explanation={(content.explanation as string) || ""}
            onQuestionChange={(q) => updateField("question", q)}
            onOptionsChange={(opts) => updateField("options", opts)}
            onMultipleAnswersChange={(m) => updateField("multiple_answers", m)}
            onExplanationChange={(e) => updateField("explanation", e)}
          />
        );

      case "true_false":
        return (
          <TrueFalseEditor
            statement={(content.statement as string) || ""}
            isTrue={(content.is_true as boolean) ?? true}
            explanation={(content.explanation as string) || ""}
            onStatementChange={(s) => updateField("statement", s)}
            onIsTrueChange={(t) => updateField("is_true", t)}
            onExplanationChange={(e) => updateField("explanation", e)}
          />
        );

      case "word_order":
        return (
          <WordOrderEditor
            content={content}
            onContentChange={setContent}
          />
        );

      case "matching":
        return (
          <MatchingEditor
            pairs={(content.pairs as MatchingPair[]) || []}
            shuffleRight={(content.shuffle_right as boolean) ?? true}
            onPairsChange={(p) => updateField("pairs", p)}
            onShuffleRightChange={(s) => updateField("shuffle_right", s)}
          />
        );

      case "essay":
        return (
          <EssayEditor
            prompt={(content.prompt as string) || ""}
            minWords={content.min_words as number | null}
            maxWords={content.max_words as number | null}
            sampleAnswer={(content.sample_answer as string) || ""}
            onPromptChange={(p) => updateField("prompt", p)}
            onMinWordsChange={(m) => updateField("min_words", m)}
            onMaxWordsChange={(m) => updateField("max_words", m)}
            onSampleAnswerChange={(s) => updateField("sample_answer", s)}
          />
        );

      case "image":
        return (
          <ImageEditor
            url={(content.url as string) || ""}
            caption={(content.caption as string) || ""}
            images={(content.images as CarouselImageItem[]) || []}
            onUrlChange={(url) => updateField("url", url)}
            onCaptionChange={(caption) => updateField("caption", caption)}
            onImagesChange={(images) => updateField("images", images)}
          />
        );

      case "teaching_guide":
        return (
          <TeachingGuideEditor
            html={(content.html as string) || ""}
            onChange={(html) => updateField("html", html)}
          />
        );

      case "remember":
        return (
          <RememberEditor
            html={(content.html as string) || ""}
            icon={(content.icon as string) || ""}
            onHtmlChange={(html) => updateField("html", html)}
            onIconChange={(icon) => updateField("icon", icon)}
          />
        );

      case "table":
        return (
          <TableEditor
            rows={(content.rows as TableRow[]) || []}
            hasHeader={(content.has_header as boolean) ?? true}
            onRowsChange={(rows) => updateField("rows", rows)}
            onHasHeaderChange={(h) => updateField("has_header", h)}
          />
        );

      case "image_choice":
        return (
          <ImageChoiceEditor
            question={(content.question as string) || ""}
            options={(content.options as ImageOption[]) || []}
            explanation={(content.explanation as string) || ""}
            onQuestionChange={(q) => updateField("question", q)}
            onOptionsChange={(opts) => updateField("options", opts)}
            onExplanationChange={(e) => updateField("explanation", e)}
          />
        );

      case "flashcards":
        return (
          <FlashcardsEditor
            title={(content.title as string) || ""}
            cards={(content.cards as FlashcardItem[]) || []}
            shuffle={(content.shuffle as boolean) ?? true}
            onTitleChange={(t) => updateField("title", t)}
            onCardsChange={(c) => updateField("cards", c)}
            onShuffleChange={(s) => updateField("shuffle", s)}
          />
        );

      case "vocabulary":
        return (
          <VocabularyEditor
            words={(content.words as VocabularyWord[]) || []}
            showTranscription={(content.show_transcription as boolean) ?? false}
            onWordsChange={(w) => updateField("words", w)}
            onShowTranscriptionChange={(s) =>
              updateField("show_transcription", s)
            }
          />
        );

      case "drag_words":
        return (
          <DragWordsEditor
            text={(content.text as string) || ""}
            words={(content.words as DragWordItem[]) || []}
            distractors={(content.distractors as string[]) || []}
            onTextChange={(text) => updateField("text", text)}
            onWordsChange={(words) => updateField("words", words)}
            onDistractorsChange={(d) => updateField("distractors", d)}
          />
        );

      case "sentence_choice":
        return (
          <SentenceChoiceEditor
            questions={
              (content.questions as SentenceChoiceQuestionItem[]) || []
            }
            onQuestionsChange={(questions) =>
              updateField("questions", questions)
            }
          />
        );

      default:
        return (
          <div className="text-gray-500">
            Редактор для этого типа блока не реализован
          </div>
        );
    }
  };

  return (
    <div>
      {/* Block Title Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название блока{" "}
          <span className="text-gray-400 font-normal">(необязательно)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Например: Introduce yourself"
        />
        <p className="text-xs text-gray-400 mt-1">
          Название отображается над блоком (как на Edvibe: "1.1 Introduce
          yourself")
        </p>
      </div>

      {/* Block Content Editor */}
      {renderEditor()}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

// Types for editors
interface GapItem {
  index: number;
  answer: string;
  hint?: string;
  alternatives?: string[];
}

interface TestOption {
  id: string;
  text: string;
  is_correct: boolean;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface TableCell {
  text: string;
  colspan?: number;
  rowspan?: number;
  style?: string;
}

interface TableRow {
  cells: TableCell[];
}

interface ImageOption {
  id: string;
  url: string;
  caption?: string;
  is_correct: boolean;
}

interface FlashcardItem {
  front: string;
  back: string;
  image_url?: string;
}

interface VocabularyWord {
  word: string;
  translation: string;
  transcription?: string;
}

interface CarouselImageItem {
  url: string;
  caption?: string | null;
}

interface DragWordItem {
  index: number;
  word: string;
}

interface SentenceChoiceQuestionItem {
  id: string;
  options: string[];
  correct_index: number;
}

// File Upload Button Component
function FileUploadButton({
  onUpload,
  accept,
  label,
}: {
  onUpload: (url: string) => void;
  accept: string;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await courseUploadApi.upload(file);
      onUpload(result.file_url);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Ошибка загрузки";
      setError(errorMessage);
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id={`file-upload-${label}`}
      />
      <label
        htmlFor={`file-upload-${label}`}
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-purple-300 text-purple-600 rounded-lg cursor-pointer hover:bg-purple-50 ${
          uploading ? "opacity-50 cursor-wait" : ""
        }`}
      >
        {uploading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Загрузка...
          </>
        ) : (
          <>
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {label}
          </>
        )}
      </label>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}

// Individual Editors

function TextEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Текст
      </label>
      <HtmlEditor
        html={html}
        onChange={onChange}
        placeholder="Введите текст..."
      />
    </div>
  );
}

function VideoEditor({
  url,
  title,
  onUrlChange,
  onTitleChange,
}: {
  url: string;
  title: string;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL видео
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название (необязательно)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Название видео"
        />
      </div>
    </div>
  );
}

function AudioEditor({
  url,
  title,
  onUrlChange,
  onTitleChange,
}: {
  url: string;
  title: string;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Аудио файл
        </label>
        <div className="flex items-center gap-3 mb-2">
          <FileUploadButton
            onUpload={onUrlChange}
            accept="audio/*"
            label="Загрузить"
          />
          <span className="text-sm text-gray-500">или укажите URL</span>
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="https://..."
        />
        {url && (
          <audio controls className="w-full mt-2">
            <source src={url} />
            Ваш браузер не поддерживает аудио
          </audio>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название (необязательно)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Название аудио"
        />
      </div>
    </div>
  );
}

function ArticleEditor({
  html,
  imageUrl,
  imagePosition,
  onHtmlChange,
  onImageUrlChange,
  onImagePositionChange,
}: {
  html: string;
  imageUrl: string;
  imagePosition: string;
  onHtmlChange: (html: string) => void;
  onImageUrlChange: (url: string) => void;
  onImagePositionChange: (pos: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Текст
        </label>
        <HtmlEditor html={html} onChange={onHtmlChange} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Изображение
        </label>
        <div className="flex items-center gap-3 mb-2">
          <FileUploadButton
            onUpload={onImageUrlChange}
            accept="image/*"
            label="Загрузить"
          />
          <span className="text-sm text-gray-500">или укажите URL</span>
        </div>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="https://..."
        />
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            className="mt-2 max-w-full h-auto rounded-lg max-h-32 object-contain"
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Позиция изображения
        </label>
        <select
          value={imagePosition}
          onChange={(e) => onImagePositionChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="left">Слева</option>
          <option value="right">Справа</option>
          <option value="top">Сверху</option>
          <option value="bottom">Снизу</option>
        </select>
      </div>
    </div>
  );
}

function DividerEditor({
  style,
  onChange,
}: {
  style: string;
  onChange: (style: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Стиль разделителя
      </label>
      <select
        value={style}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="line">Линия</option>
        <option value="space">Отступ</option>
        <option value="dots">Точки</option>
      </select>
    </div>
  );
}

function PageBreakEditor({
  label,
  onChange,
}: {
  label: string;
  onChange: (label: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Метка страницы (необязательно)
      </label>
      <input
        type="text"
        value={label}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Например: Listening, Grammar..."
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      <p className="mt-2 text-xs text-gray-500">
        Разделяет урок на страницы. Студенты переключают страницы кнопками
        «Назад» / «Вперёд».
      </p>
    </div>
  );
}

function FillGapsEditor({
  text,
  gaps,
  onTextChange,
  onGapsChange,
}: {
  text: string;
  gaps: GapItem[];
  onTextChange: (text: string) => void;
  onGapsChange: (gaps: GapItem[]) => void;
}) {
  const addGap = () => {
    const newIndex = gaps.length;
    onGapsChange([
      ...gaps,
      { index: newIndex, answer: "", hint: "", alternatives: [] },
    ]);
  };

  const updateGap = (
    index: number,
    field: keyof GapItem,
    value: string | string[],
  ) => {
    const newGaps = gaps.map((g, i) =>
      i === index ? { ...g, [field]: value } : g,
    );
    onGapsChange(newGaps);
  };

  const removeGap = (index: number) => {
    onGapsChange(gaps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Текст с пропусками (используйте {"{0}"}, {"{1}"} и т.д.)
        </label>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={6}
          placeholder={
            "1. I'm not Tom. I'm Tony.\n2. {0} in class 5. You're in class 4.\n3. {1} in room 6. You're in room 7."
          }
        />
        <p className="text-xs text-gray-400 mt-1">
          Нажмите Enter для переноса на новую строку
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Пропуски</label>
          <button
            type="button"
            onClick={addGap}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить
          </button>
        </div>
        <div className="space-y-2">
          {gaps.map((gap, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-500 mt-2">{`{${index}}`}</span>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={gap.answer}
                  onChange={(e) => updateGap(index, "answer", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Правильный ответ"
                />
                <input
                  type="text"
                  value={gap.hint || ""}
                  onChange={(e) => updateGap(index, "hint", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Подсказка (необязательно)"
                />
                <input
                  type="text"
                  value={(gap.alternatives || []).join(", ")}
                  onChange={(e) => {
                    const alts = e.target.value
                      ? e.target.value
                          .split(",")
                          .map((a: string) => a.trim())
                          .filter(Boolean)
                      : [];
                    updateGap(index, "alternatives", alts);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Альтернативные ответы через запятую (необязательно)"
                />
              </div>
              <button
                type="button"
                onClick={() => removeGap(index)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestEditor({
  question,
  options,
  multipleAnswers,
  explanation,
  onQuestionChange,
  onOptionsChange,
  onMultipleAnswersChange,
  onExplanationChange,
}: {
  question: string;
  options: TestOption[];
  multipleAnswers: boolean;
  explanation: string;
  onQuestionChange: (q: string) => void;
  onOptionsChange: (opts: TestOption[]) => void;
  onMultipleAnswersChange: (m: boolean) => void;
  onExplanationChange: (e: string) => void;
}) {
  const addOption = () => {
    onOptionsChange([
      ...options,
      { id: crypto.randomUUID(), text: "", is_correct: false },
    ]);
  };

  const updateOption = (
    id: string,
    field: keyof TestOption,
    value: string | boolean,
  ) => {
    onOptionsChange(
      options.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  };

  const removeOption = (id: string) => {
    onOptionsChange(options.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Вопрос
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Введите вопрос..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="multipleAnswers"
          checked={multipleAnswers}
          onChange={(e) => onMultipleAnswersChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600"
        />
        <label htmlFor="multipleAnswers" className="text-sm text-gray-600">
          Несколько правильных ответов
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Варианты ответа
          </label>
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить
          </button>
        </div>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={option.is_correct}
                onChange={(e) =>
                  updateOption(option.id, "is_correct", e.target.checked)
                }
                className="w-4 h-4 rounded border-gray-300 text-green-600"
                title="Правильный ответ"
              />
              <input
                type="text"
                value={option.text}
                onChange={(e) =>
                  updateOption(option.id, "text", e.target.value)
                }
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Вариант ответа"
              />
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пояснение (показывается после ответа)
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Объяснение правильного ответа..."
        />
      </div>
    </div>
  );
}

function TrueFalseEditor({
  statement,
  isTrue,
  explanation,
  onStatementChange,
  onIsTrueChange,
  onExplanationChange,
}: {
  statement: string;
  isTrue: boolean;
  explanation: string;
  onStatementChange: (s: string) => void;
  onIsTrueChange: (t: boolean) => void;
  onExplanationChange: (e: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Утверждение
        </label>
        <textarea
          value={statement}
          onChange={(e) => onStatementChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Введите утверждение..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Правильный ответ
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={isTrue}
              onChange={() => onIsTrueChange(true)}
              className="w-4 h-4 text-purple-600"
            />
            <span>Верно</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!isTrue}
              onChange={() => onIsTrueChange(false)}
              className="w-4 h-4 text-purple-600"
            />
            <span>Неверно</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пояснение
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Объяснение..."
        />
      </div>
    </div>
  );
}

interface WordOrderSentenceItem {
  correct_sentence: string;
  shuffled_words: string[];
  hint?: string;
}

function WordOrderEditor({
  content,
  onContentChange,
}: {
  content: Record<string, unknown>;
  onContentChange: (c: Record<string, unknown>) => void;
}) {
  // Initialize sentences from content
  const initSentences = (): WordOrderSentenceItem[] => {
    const existing = content.sentences as WordOrderSentenceItem[] | undefined;
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing.map((s) => ({
        correct_sentence: s.correct_sentence || "",
        shuffled_words: s.shuffled_words || [],
        hint: s.hint || "",
      }));
    }
    // Backward compat: single sentence from old fields
    return [
      {
        correct_sentence: (content.correct_sentence as string) || "",
        shuffled_words: (content.shuffled_words as string[]) || [],
        hint: (content.hint as string) || "",
      },
    ];
  };

  const [sentences, setSentences] = useState<WordOrderSentenceItem[]>(initSentences);

  const generateShuffled = (sentence: string): string[] => {
    const words = sentence.split(/\s+/).filter(Boolean);
    return [...words].sort(() => Math.random() - 0.5);
  };

  const updateSentence = (index: number, field: keyof WordOrderSentenceItem, value: unknown) => {
    const updated = sentences.map((s, i) => {
      if (i !== index) return s;
      const newSentence = { ...s, [field]: value };
      // Auto-generate shuffled_words when correct_sentence changes
      if (field === "correct_sentence") {
        newSentence.shuffled_words = generateShuffled(value as string);
      }
      return newSentence;
    });
    setSentences(updated);
    syncToContent(updated);
  };

  const shuffleSentence = (index: number) => {
    const updated = sentences.map((s, i) => {
      if (i !== index) return s;
      return { ...s, shuffled_words: generateShuffled(s.correct_sentence) };
    });
    setSentences(updated);
    syncToContent(updated);
  };

  const addSentence = () => {
    const updated = [...sentences, { correct_sentence: "", shuffled_words: [], hint: "" }];
    setSentences(updated);
    syncToContent(updated);
  };

  const removeSentence = (index: number) => {
    if (sentences.length <= 1) return;
    const updated = sentences.filter((_, i) => i !== index);
    setSentences(updated);
    syncToContent(updated);
  };

  const syncToContent = (sents: WordOrderSentenceItem[]) => {
    const first = sents[0] || { correct_sentence: "", shuffled_words: [], hint: "" };
    onContentChange({
      ...content,
      // Backward compat: always set old top-level fields from first sentence
      correct_sentence: first.correct_sentence,
      shuffled_words: first.shuffled_words,
      hint: first.hint || null,
      // New multi-sentence array
      sentences: sents.map((s) => ({
        correct_sentence: s.correct_sentence,
        shuffled_words: s.shuffled_words,
        hint: s.hint || null,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {sentences.map((sentence, index) => (
        <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3 relative">
          {sentences.length > 1 && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-500">
                Предложение {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeSentence(index)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Удалить
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Правильное предложение
            </label>
            <textarea
              value={sentence.correct_sentence}
              onChange={(e) => updateSentence(index, "correct_sentence", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder="The quick brown fox jumps over the lazy dog."
            />
            <button
              type="button"
              onClick={() => shuffleSentence(index)}
              className="mt-2 text-sm text-purple-600 hover:text-purple-700"
            >
              Перемешать слова
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Подсказка (необязательно)
            </label>
            <input
              type="text"
              value={sentence.hint || ""}
              onChange={(e) => updateSentence(index, "hint", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Подсказка для студента..."
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSentence}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
      >
        + Добавить предложение
      </button>
    </div>
  );
}

function MatchingEditor({
  pairs,
  shuffleRight,
  onPairsChange,
  onShuffleRightChange,
}: {
  pairs: MatchingPair[];
  shuffleRight: boolean;
  onPairsChange: (p: MatchingPair[]) => void;
  onShuffleRightChange: (s: boolean) => void;
}) {
  const addPair = () => {
    onPairsChange([...pairs, { left: "", right: "" }]);
  };

  const updatePair = (
    index: number,
    field: "left" | "right",
    value: string,
  ) => {
    const newPairs = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onPairsChange(newPairs);
  };

  const removePair = (index: number) => {
    onPairsChange(pairs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="shuffleRight"
          checked={shuffleRight}
          onChange={(e) => onShuffleRightChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600"
        />
        <label htmlFor="shuffleRight" className="text-sm text-gray-600">
          Перемешивать правую колонку
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Пары для сопоставления
          </label>
          <button
            type="button"
            onClick={addPair}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить
          </button>
        </div>
        <div className="space-y-2">
          {pairs.map((pair, index) => {
            const rightIsImage =
              /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(
                pair.right,
              );
            return (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.left}
                  onChange={(e) => updatePair(index, "left", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Левая часть"
                />
                <span className="text-gray-400">↔</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => updatePair(index, "right", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Правая часть (текст или URL картинки)"
                  />
                  {rightIsImage && (
                    <img
                      src={pair.right}
                      alt=""
                      className="h-10 w-10 object-contain rounded border border-gray-200"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePair(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EssayEditor({
  prompt,
  minWords,
  maxWords,
  sampleAnswer,
  onPromptChange,
  onMinWordsChange,
  onMaxWordsChange,
  onSampleAnswerChange,
}: {
  prompt: string;
  minWords: number | null;
  maxWords: number | null;
  sampleAnswer: string;
  onPromptChange: (p: string) => void;
  onMinWordsChange: (m: number | null) => void;
  onMaxWordsChange: (m: number | null) => void;
  onSampleAnswerChange: (s: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Задание
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={3}
          placeholder="Напишите эссе на тему..."
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Мин. слов
          </label>
          <input
            type="number"
            value={minWords ?? ""}
            onChange={(e) =>
              onMinWordsChange(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="0"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Макс. слов
          </label>
          <input
            type="number"
            value={maxWords ?? ""}
            onChange={(e) =>
              onMaxWordsChange(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Примерный ответ (для преподавателя)
        </label>
        <textarea
          value={sampleAnswer}
          onChange={(e) => onSampleAnswerChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={3}
          placeholder="Примерный ответ..."
        />
      </div>
    </div>
  );
}

function ImageEditor({
  url,
  caption,
  images,
  onUrlChange,
  onCaptionChange,
  onImagesChange,
}: {
  url: string;
  caption: string;
  images: CarouselImageItem[];
  onUrlChange: (url: string) => void;
  onCaptionChange: (caption: string) => void;
  onImagesChange: (images: CarouselImageItem[]) => void;
}) {
  const useCarousel = images.length > 0;

  const switchToCarousel = () => {
    // Migrate single image to carousel
    const initial: CarouselImageItem[] = url
      ? [{ url, caption: caption || "" }]
      : [];
    onImagesChange(initial);
  };

  const switchToSingle = () => {
    // Take first image back to single mode
    if (images.length > 0) {
      onUrlChange(images[0].url);
      onCaptionChange(images[0].caption || "");
    }
    onImagesChange([]);
  };

  const addImage = () => {
    onImagesChange([...images, { url: "", caption: "" }]);
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateImage = (index: number, field: string, value: string) => {
    const updated = images.map((img, i) =>
      i === index ? { ...img, [field]: value } : img,
    );
    onImagesChange(updated);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    const updated = [...images];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onImagesChange(updated);
  };

  if (!useCarousel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Изображение
          </label>
          <button
            type="button"
            onClick={switchToCarousel}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            Карусель (несколько)
          </button>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <FileUploadButton
            onUpload={onUrlChange}
            accept="image/*"
            label="Загрузить"
          />
          <span className="text-sm text-gray-500">или укажите URL</span>
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="https://..."
        />
        {url && (
          <div className="mt-2">
            <img
              src={url}
              alt="Preview"
              className="max-w-full h-auto rounded-lg max-h-48 object-contain"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Подпись (необязательно)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Подпись к изображению"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Карусель изображений ({images.length})
        </label>
        <button
          type="button"
          onClick={switchToSingle}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Одно изображение
        </button>
      </div>

      <div className="space-y-3">
        {images.map((img, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                Изображение {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveImage(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Вверх"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, 1)}
                  disabled={index === images.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Вниз"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileUploadButton
                onUpload={(u) => updateImage(index, "url", u)}
                accept="image/*"
                label="Загрузить"
              />
              <input
                type="url"
                value={img.url}
                onChange={(e) => updateImage(index, "url", e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                placeholder="https://..."
              />
            </div>
            {img.url && (
              <img
                src={img.url}
                alt={`Preview ${index + 1}`}
                className="max-w-full h-auto rounded max-h-32 object-contain"
              />
            )}
            <input
              type="text"
              value={img.caption || ""}
              onChange={(e) => updateImage(index, "caption", e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              placeholder="Подпись (необязательно)"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addImage}
        className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-purple-400 hover:text-purple-600 transition-colors text-sm"
      >
        + Добавить изображение
      </button>
    </div>
  );
}

function TeachingGuideEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
        Этот блок виден только преподавателю
      </div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Заметка для учителя
      </label>
      <HtmlEditor
        html={html}
        onChange={onChange}
        placeholder="Инструкции для проведения урока..."
      />
    </div>
  );
}

function RememberEditor({
  html,
  icon,
  onHtmlChange,
  onIconChange,
}: {
  html: string;
  icon: string;
  onHtmlChange: (html: string) => void;
  onIconChange: (icon: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Иконка
        </label>
        <select
          value={icon}
          onChange={(e) => onIconChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Без иконки</option>
          <option value="info">Информация</option>
          <option value="warning">Предупреждение</option>
          <option value="tip">Совет</option>
          <option value="note">Заметка</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Текст
        </label>
        <HtmlEditor
          html={html}
          onChange={onHtmlChange}
          placeholder="Важная информация для запоминания..."
        />
      </div>
    </div>
  );
}

function TableEditor({
  rows,
  hasHeader,
  onRowsChange,
  onHasHeaderChange,
}: {
  rows: TableRow[];
  hasHeader: boolean;
  onRowsChange: (rows: TableRow[]) => void;
  onHasHeaderChange: (h: boolean) => void;
}) {
  const addRow = () => {
    const cellCount = rows[0]?.cells.length || 3;
    onRowsChange([
      ...rows,
      {
        cells: Array(cellCount)
          .fill(null)
          .map(() => ({ text: "" })),
      },
    ]);
  };

  const addColumn = () => {
    onRowsChange(
      rows.map((row) => ({
        ...row,
        cells: [...row.cells, { text: "" }],
      })),
    );
  };

  const updateCell = (rowIndex: number, cellIndex: number, text: string) => {
    const newRows = rows.map((row, ri) => {
      if (ri !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, ci) =>
          ci === cellIndex ? { ...cell, text } : cell,
        ),
      };
    });
    onRowsChange(newRows);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  const removeColumn = (index: number) => {
    onRowsChange(
      rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, i) => i !== index),
      })),
    );
  };

  // Initialize with empty table if needed
  if (rows.length === 0) {
    onRowsChange([
      { cells: [{ text: "" }, { text: "" }, { text: "" }] },
      { cells: [{ text: "" }, { text: "" }, { text: "" }] },
    ]);
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="hasHeader"
          checked={hasHeader}
          onChange={(e) => onHasHeaderChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600"
        />
        <label htmlFor="hasHeader" className="text-sm text-gray-600">
          Первая строка - заголовок
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-gray-200 p-1">
                    <input
                      type="text"
                      value={cell.text}
                      onChange={(e) =>
                        updateCell(rowIndex, cellIndex, e.target.value)
                      }
                      className={`w-full px-2 py-1 text-sm ${hasHeader && rowIndex === 0 ? "font-semibold bg-gray-50" : ""}`}
                      placeholder={
                        hasHeader && rowIndex === 0 ? "Заголовок" : "Текст"
                      }
                    />
                  </td>
                ))}
                <td className="border-0 pl-1">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    title="Удалить строку"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {rows[0]?.cells.map((_, cellIndex) => (
                <td key={cellIndex} className="border-0 pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeColumn(cellIndex)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded text-xs"
                    title="Удалить столбец"
                  >
                    ✕
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          + Добавить строку
        </button>
        <button
          type="button"
          onClick={addColumn}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          + Добавить столбец
        </button>
      </div>
    </div>
  );
}

function ImageChoiceEditor({
  question,
  options,
  explanation,
  onQuestionChange,
  onOptionsChange,
  onExplanationChange,
}: {
  question: string;
  options: ImageOption[];
  explanation: string;
  onQuestionChange: (q: string) => void;
  onOptionsChange: (opts: ImageOption[]) => void;
  onExplanationChange: (e: string) => void;
}) {
  const addOption = () => {
    onOptionsChange([
      ...options,
      { id: crypto.randomUUID(), url: "", caption: "", is_correct: false },
    ]);
  };

  const updateOption = (
    id: string,
    field: keyof ImageOption,
    value: string | boolean,
  ) => {
    onOptionsChange(
      options.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  };

  const removeOption = (id: string) => {
    onOptionsChange(options.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Вопрос
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Выберите правильное изображение..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Варианты изображений
          </label>
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <div
              key={option.id}
              className={`p-3 border rounded-lg ${option.is_correct ? "border-green-500 bg-green-50" : "border-gray-200"}`}
            >
              <div className="mb-2">
                <FileUploadButton
                  onUpload={(url) => updateOption(option.id, "url", url)}
                  accept="image/*"
                  label="Загрузить"
                />
              </div>
              <input
                type="url"
                value={option.url}
                onChange={(e) => updateOption(option.id, "url", e.target.value)}
                className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2"
                placeholder="или URL изображения"
              />
              {option.url && (
                <img
                  src={option.url}
                  alt=""
                  className="w-full h-24 object-cover rounded mb-2"
                />
              )}
              <input
                type="text"
                value={option.caption || ""}
                onChange={(e) =>
                  updateOption(option.id, "caption", e.target.value)
                }
                className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2"
                placeholder="Подпись (необязательно)"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={option.is_correct}
                    onChange={(e) =>
                      updateOption(option.id, "is_correct", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300 text-green-600"
                  />
                  Правильный
                </label>
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пояснение
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Объяснение правильного ответа..."
        />
      </div>
    </div>
  );
}

function FlashcardsEditor({
  title,
  cards,
  shuffle,
  onTitleChange,
  onCardsChange,
  onShuffleChange,
}: {
  title: string;
  cards: FlashcardItem[];
  shuffle: boolean;
  onTitleChange: (t: string) => void;
  onCardsChange: (c: FlashcardItem[]) => void;
  onShuffleChange: (s: boolean) => void;
}) {
  const addCard = () => {
    onCardsChange([...cards, { front: "", back: "", image_url: "" }]);
  };

  const updateCard = (
    index: number,
    field: keyof FlashcardItem,
    value: string,
  ) => {
    const newCards = cards.map((c, i) =>
      i === index ? { ...c, [field]: value } : c,
    );
    onCardsChange(newCards);
  };

  const removeCard = (index: number) => {
    onCardsChange(cards.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название набора
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Название карточек..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="shuffleCards"
          checked={shuffle}
          onChange={(e) => onShuffleChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600"
        />
        <label htmlFor="shuffleCards" className="text-sm text-gray-600">
          Перемешивать карточки
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Карточки</label>
          <button
            type="button"
            onClick={addCard}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить
          </button>
        </div>
        <div className="space-y-3">
          {cards.map((card, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">
                  Карточка {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeCard(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Лицевая сторона
                  </label>
                  <textarea
                    value={card.front}
                    onChange={(e) => updateCard(index, "front", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                    rows={2}
                    placeholder="Вопрос/слово"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Обратная сторона
                  </label>
                  <textarea
                    value={card.back}
                    onChange={(e) => updateCard(index, "back", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                    rows={2}
                    placeholder="Ответ/перевод"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Изображение (необязательно)
                </label>
                <div className="flex items-center gap-2 mb-1">
                  <FileUploadButton
                    onUpload={(url) => updateCard(index, "image_url", url)}
                    accept="image/*"
                    label="Загрузить"
                  />
                </div>
                <input
                  type="url"
                  value={card.image_url || ""}
                  onChange={(e) =>
                    updateCard(index, "image_url", e.target.value)
                  }
                  className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                  placeholder="или URL изображения"
                />
                {card.image_url && (
                  <img
                    src={card.image_url}
                    alt=""
                    className="mt-1 max-w-full h-16 object-contain rounded"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DragWordsEditor({
  text,
  words,
  distractors,
  onTextChange,
  onWordsChange,
  onDistractorsChange,
}: {
  text: string;
  words: DragWordItem[];
  distractors: string[];
  onTextChange: (text: string) => void;
  onWordsChange: (words: DragWordItem[]) => void;
  onDistractorsChange: (distractors: string[]) => void;
}) {
  const addGap = () => {
    const nextIndex = words.length > 0 ? Math.max(...words.map((w) => w.index)) + 1 : 0;
    const placeholder = `{${nextIndex}}`;
    onTextChange(text + placeholder);
    onWordsChange([...words, { index: nextIndex, word: "" }]);
  };

  const updateWord = (idx: number, value: string) => {
    onWordsChange(words.map((w) => (w.index === idx ? { ...w, word: value } : w)));
  };

  const removeWord = (idx: number) => {
    onWordsChange(words.filter((w) => w.index !== idx));
    // Remove placeholder from text
    onTextChange(text.replace(`{${idx}}`, ""));
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Текст с пропусками
          </label>
          <button
            type="button"
            onClick={addGap}
            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
          >
            + Добавить пропуск
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
          rows={4}
          placeholder="The {0} sat on the {1}. Используйте {N} для пропусков."
        />
        <p className="text-xs text-gray-400 mt-1">
          Используйте {"{0}"}, {"{1}"}, {"{2}"} и т.д. для обозначения мест, куда нужно перетащить слово
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Слова для пропусков
        </label>
        <div className="space-y-2">
          {words.map((w) => (
            <div key={w.index} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-8 text-right font-mono">
                {`{${w.index}}`}
              </span>
              <input
                type="text"
                value={w.word}
                onChange={(e) => updateWord(w.index, e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                placeholder="Правильное слово"
              />
              <button
                type="button"
                onClick={() => removeWord(w.index)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {words.length === 0 && (
            <div className="text-center py-3 text-gray-400 text-sm">
              Нажмите "Добавить пропуск" чтобы начать
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Слова-ловушки (необязательно)
        </label>
        <input
          type="text"
          value={distractors.join(", ")}
          onChange={(e) =>
            onDistractorsChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          placeholder="dog, tree, sky (через запятую)"
        />
        <p className="text-xs text-gray-400 mt-1">
          Дополнительные слова для усложнения задания
        </p>
      </div>
    </div>
  );
}

function VocabularyWordRow({
  word,
  index,
  showTranscription,
  onUpdate,
  onRemove,
}: {
  word: VocabularyWord;
  index: number;
  showTranscription: boolean;
  onUpdate: (index: number, field: keyof VocabularyWord, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [lookupLoading, setLookupLoading] = useState(false);
  const [definition, setDefinition] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLookedUpRef = useRef<string>("");

  const doLookup = useCallback(
    async (wordText: string, currentTranscription: string) => {
      const trimmed = wordText.trim();
      if (!trimmed || trimmed === lastLookedUpRef.current) return;
      lastLookedUpRef.current = trimmed;
      setLookupLoading(true);
      try {
        const result = await vocabularyApi.lookup(trimmed);
        if (result.phonetic && !currentTranscription) {
          onUpdate(index, "transcription", result.phonetic);
        }
        setDefinition(result.definition || "");
      } catch {
        // silently ignore lookup errors
      } finally {
        setLookupLoading(false);
      }
    },
    [index, onUpdate],
  );

  const handleWordChange = useCallback(
    (value: string) => {
      onUpdate(index, "word", value);
      setDefinition("");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim()) {
        debounceRef.current = setTimeout(() => {
          doLookup(value, word.transcription || "");
        }, 500);
      }
    },
    [index, onUpdate, doLookup, word.transcription],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">
          Слово {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 text-red-500 hover:bg-red-50 rounded"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Слово (англ.)
            {lookupLoading && (
              <span className="ml-1 inline-block w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin align-middle" />
            )}
          </label>
          <input
            type="text"
            value={word.word}
            onChange={(e) => handleWordChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
            placeholder="manufacturing"
          />
          {definition && (
            <p className="text-xs text-gray-400 mt-1 italic truncate" title={definition}>
              {definition}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Перевод
          </label>
          <input
            type="text"
            value={word.translation}
            onChange={(e) =>
              onUpdate(index, "translation", e.target.value)
            }
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
            placeholder="производство"
          />
        </div>
      </div>
      {showTranscription && (
        <div className="mt-2">
          <label className="block text-xs text-gray-500 mb-1">
            Транскрипция
          </label>
          <input
            type="text"
            value={word.transcription || ""}
            onChange={(e) =>
              onUpdate(index, "transcription", e.target.value)
            }
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
            placeholder="[ˌmænjʊˈfæktʃərɪŋ]"
          />
        </div>
      )}
    </div>
  );
}

function VocabularyEditor({
  words,
  showTranscription,
  onWordsChange,
  onShowTranscriptionChange,
}: {
  words: VocabularyWord[];
  showTranscription: boolean;
  onWordsChange: (words: VocabularyWord[]) => void;
  onShowTranscriptionChange: (show: boolean) => void;
}) {
  const addWord = () => {
    onWordsChange([...words, { word: "", translation: "", transcription: "" }]);
  };

  const updateWord = useCallback(
    (index: number, field: keyof VocabularyWord, value: string) => {
      onWordsChange(
        words.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
      );
    },
    [words, onWordsChange],
  );

  const removeWord = useCallback(
    (index: number) => {
      onWordsChange(words.filter((_, i) => i !== index));
    },
    [words, onWordsChange],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showTranscription"
          checked={showTranscription}
          onChange={(e) => onShowTranscriptionChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600"
        />
        <label htmlFor="showTranscription" className="text-sm text-gray-600">
          Показывать транскрипцию
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Слова</label>
          <button
            type="button"
            onClick={addWord}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Добавить слово
          </button>
        </div>
        <div className="space-y-3">
          {words.map((word, index) => (
            <VocabularyWordRow
              key={index}
              word={word}
              index={index}
              showTranscription={showTranscription}
              onUpdate={updateWord}
              onRemove={removeWord}
            />
          ))}
          {words.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              Нажмите "Добавить слово" чтобы начать
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SentenceChoiceEditor({
  questions,
  onQuestionsChange,
}: {
  questions: SentenceChoiceQuestionItem[];
  onQuestionsChange: (questions: SentenceChoiceQuestionItem[]) => void;
}) {
  const addQuestion = () => {
    const nextId = `q${questions.length + 1}`;
    onQuestionsChange([
      ...questions,
      { id: nextId, options: ["", ""], correct_index: 0 },
    ]);
  };

  const updateQuestion = (
    index: number,
    field: keyof SentenceChoiceQuestionItem,
    value: unknown,
  ) => {
    onQuestionsChange(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const removeQuestion = (index: number) => {
    onQuestionsChange(questions.filter((_, i) => i !== index));
  };

  const addOption = (qIndex: number) => {
    const q = questions[qIndex];
    updateQuestion(qIndex, "options", [...q.options, ""]);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const q = questions[qIndex];
    const newOptions = q.options.map((o, i) => (i === optIndex ? value : o));
    updateQuestion(qIndex, "options", newOptions);
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    const newOptions = q.options.filter((_, i) => i !== optIndex);
    const newCorrectIndex =
      q.correct_index >= newOptions.length
        ? Math.max(0, newOptions.length - 1)
        : q.correct_index > optIndex
          ? q.correct_index - 1
          : q.correct_index;
    onQuestionsChange(
      questions.map((qq, i) =>
        i === qIndex
          ? { ...qq, options: newOptions, correct_index: newCorrectIndex }
          : qq,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Вопросы</label>
        <button
          type="button"
          onClick={addQuestion}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          + Добавить вопрос
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((q, qIndex) => (
          <div
            key={q.id}
            className="p-4 border border-gray-200 rounded-lg bg-gray-50"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Вопрос {qIndex + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {q.options.map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`sc-correct-${q.id}`}
                    checked={q.correct_index === optIndex}
                    onChange={() =>
                      updateQuestion(qIndex, "correct_index", optIndex)
                    }
                    className="w-4 h-4 text-green-600 border-gray-300"
                    title="Правильный вариант"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) =>
                      updateOption(qIndex, optIndex, e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder={`Вариант ${optIndex + 1}`}
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(qIndex, optIndex)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addOption(qIndex)}
              className="mt-2 text-xs text-purple-600 hover:text-purple-700"
            >
              + Добавить вариант
            </button>
          </div>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Нажмите "Добавить вопрос" чтобы начать
          </div>
        )}
      </div>
    </div>
  );
}
