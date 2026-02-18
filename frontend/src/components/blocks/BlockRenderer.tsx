import { useState, useMemo } from "react";
import type { ExerciseBlock, ExerciseResultDetails } from "../../types/course";
import { useAuthStore } from "../../store/authStore";

const INTERACTIVE_TYPES = [
  "fill_gaps",
  "test",
  "true_false",
  "word_order",
  "matching",
  "essay",
  "image_choice",
];

interface BlockRendererProps {
  block: ExerciseBlock;
  blockNumber?: number; // Optional block number for display (e.g., 1, 2, 3...)
  lessonNumber?: number; // Optional lesson number within section (e.g., 1 for "1.1 Title")
  answer: unknown;
  onAnswerChange: (answer: unknown) => void;
  isChecked: boolean;
  onCheck: () => void;
  onReset?: () => void;
  serverDetails?: ExerciseResultDetails;
}

export default function BlockRenderer({
  block,
  blockNumber,
  lessonNumber = 1,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  onReset,
  serverDetails,
}: BlockRendererProps) {
  const content = block.content as Record<string, unknown>;

  // Render block content based on type
  const renderBlockContent = () => {
    switch (block.block_type) {
      case "text":
        return (
          <div
            className="prose prose-sm max-w-none [&_iframe]:w-full [&_iframe]:min-h-[500px] [&_iframe]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: (content.html as string) || "" }}
          />
        );

      case "video":
        return (
          <VideoRenderer
            url={(content.url as string) || ""}
            title={(content.title as string) || ""}
          />
        );

      case "audio":
        return (
          <AudioRenderer
            url={(content.url as string) || ""}
            title={(content.title as string) || ""}
          />
        );

      case "article":
        return (
          <ArticleRenderer
            html={(content.html as string) || ""}
            imageUrl={(content.image_url as string) || ""}
            imagePosition={(content.image_position as string) || "right"}
          />
        );

      case "divider":
        // Dividers don't need headers
        return <DividerRenderer style={(content.style as string) || "line"} />;

      case "page_break":
        // Page breaks are invisible in preview (consumed by pagination logic)
        return null;

      case "image":
        return (
          <ImageRenderer
            url={(content.url as string) || ""}
            caption={(content.caption as string) || ""}
            alt={(content.alt as string) || ""}
          />
        );

      case "teaching_guide":
        // Teaching guide is only visible in editor, not for students
        return null;

      case "remember":
        return (
          <RememberRenderer
            html={(content.html as string) || ""}
            icon={(content.icon as string) || "info"}
          />
        );

      case "table":
        return (
          <TableRenderer
            rows={(content.rows as TableRow[]) || []}
            hasHeader={(content.has_header as boolean) ?? true}
          />
        );

      case "fill_gaps":
        return (
          <FillGapsRenderer
            text={(content.text as string) || ""}
            gaps={(content.gaps as GapItem[]) || []}
            answer={answer as Record<number, string>}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "test":
        return (
          <TestRenderer
            question={(content.question as string) || ""}
            options={(content.options as TestOption[]) || []}
            multipleAnswers={(content.multiple_answers as boolean) || false}
            explanation={(content.explanation as string) || ""}
            answer={answer as string[] | string}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "true_false":
        return (
          <TrueFalseRenderer
            statement={(content.statement as string) || ""}
            isTrue={(content.is_true as boolean) ?? true}
            explanation={(content.explanation as string) || ""}
            answer={answer as boolean | undefined}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "word_order":
        return (
          <WordOrderRenderer
            correctSentence={(content.correct_sentence as string) || ""}
            shuffledWords={(content.shuffled_words as string[]) || []}
            hint={(content.hint as string) || ""}
            answer={answer as string[]}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "matching":
        return (
          <MatchingRenderer
            pairs={(content.pairs as MatchingPair[]) || []}
            shuffleRight={(content.shuffle_right as boolean) ?? true}
            answer={answer as Record<string, string>}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "image_choice":
        return (
          <ImageChoiceRenderer
            question={(content.question as string) || ""}
            options={(content.options as ImageOption[]) || []}
            explanation={(content.explanation as string) || ""}
            answer={answer as string}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
            serverDetails={serverDetails}
          />
        );

      case "flashcards":
        return (
          <FlashcardsRenderer
            title={(content.title as string) || ""}
            cards={(content.cards as Flashcard[]) || []}
            shuffle={(content.shuffle as boolean) ?? true}
          />
        );

      case "essay":
        return (
          <EssayRenderer
            prompt={(content.prompt as string) || ""}
            minWords={content.min_words as number | null}
            maxWords={content.max_words as number | null}
            answer={answer as string}
            onAnswerChange={onAnswerChange}
            isChecked={isChecked}
            onCheck={onCheck}
          />
        );

      case "vocabulary":
        return (
          <VocabularyRenderer
            words={(content.words as VocabularyWordItem[]) || []}
            showTranscription={(content.show_transcription as boolean) ?? false}
          />
        );

      default:
        return <div className="text-gray-500">Неизвестный тип блока</div>;
    }
  };

  // Render with header if title exists
  const blockContent = renderBlockContent();
  const isInteractive = INTERACTIVE_TYPES.includes(block.block_type);

  // For divider and teaching_guide, don't add header
  if (
    block.block_type === "divider" ||
    block.block_type === "teaching_guide" ||
    block.block_type === "page_break"
  ) {
    return <>{blockContent}</>;
  }

  // Render with header
  const numberPrefix =
    blockNumber !== undefined ? `${lessonNumber}.${blockNumber}` : null;

  const resetButton =
    isInteractive && isChecked && onReset ? (
      <button
        onClick={onReset}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
        title="Сбросить ответ"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Сбросить
      </button>
    ) : null;

  if (!block.title) {
    return (
      <div>
        {resetButton && (
          <div className="flex justify-end mb-1">{resetButton}</div>
        )}
        {blockContent}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          {numberPrefix && (
            <span className="text-sm font-semibold text-cyan-600">
              {numberPrefix}
            </span>
          )}
          <h3 className="text-lg font-medium text-gray-800">{block.title}</h3>
        </div>
        {resetButton}
      </div>
      {blockContent}
    </div>
  );
}

// Types
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
  style?: string | null;
}

interface TableRow {
  cells: TableCell[];
}

interface ImageOption {
  id: string;
  url: string;
  caption?: string | null;
  is_correct: boolean;
}

interface Flashcard {
  front: string;
  back: string;
  image_url?: string | null;
}

interface VocabularyWordItem {
  word: string;
  translation: string;
  transcription?: string | null;
}

// Video Renderer
function VideoRenderer({ url, title }: { url: string; title: string }) {
  const embedUrl = useMemo(() => {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  }, [url]);

  if (!embedUrl) {
    return <div className="text-gray-500">Неверный URL видео</div>;
  }

  return (
    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
      <iframe
        src={embedUrl}
        title={title || "Видео"}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
}

// Audio Renderer
function AudioRenderer({ url, title }: { url: string; title: string }) {
  if (!url) {
    return <div className="text-gray-500">URL аудио не указан</div>;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      {title && (
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      )}
      <audio src={url} controls className="w-full" />
    </div>
  );
}

// Article Renderer
function ArticleRenderer({
  html,
  imageUrl,
  imagePosition,
}: {
  html: string;
  imageUrl: string;
  imagePosition: string;
}) {
  const isVertical = imagePosition === "top" || imagePosition === "bottom";
  const imageFirst = imagePosition === "top" || imagePosition === "left";

  const imageEl = imageUrl && (
    <img
      src={imageUrl}
      alt=""
      className={`rounded-lg object-cover ${isVertical ? "w-full h-48" : "w-48 h-auto"}`}
    />
  );

  const textEl = (
    <div
      className="prose prose-sm max-w-none flex-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  return (
    <div className={`flex ${isVertical ? "flex-col" : "flex-row"} gap-4`}>
      {imageFirst ? (
        <>
          {imageEl}
          {textEl}
        </>
      ) : (
        <>
          {textEl}
          {imageEl}
        </>
      )}
    </div>
  );
}

// Divider Renderer
function DividerRenderer({ style }: { style: string }) {
  switch (style) {
    case "line":
      return <hr className="border-gray-200 my-4" />;
    case "space":
      return <div className="h-8" />;
    case "dots":
      return <div className="text-center text-gray-300 my-4">• • •</div>;
    default:
      return <hr className="border-gray-200 my-4" />;
  }
}

// Fill Gaps Renderer
function FillGapsRenderer({
  text,
  gaps,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  text: string;
  gaps: GapItem[];
  answer: Record<number, string>;
  onAnswerChange: (answer: Record<number, string>) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const answers = answer || {};
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";

  // Auto-detect numbered items and add line breaks (e.g., "... 2. Text" → "...\n2. Text")
  const processedText = text.replace(/ (\d+)\. /g, "\n$1. ").trimStart();
  const parts = processedText.split(/\{(\d+)\}/);

  const checkAnswer = (gapIndex: number): boolean | null => {
    if (!isChecked) return null;
    // Use server-side results if available (students)
    if (serverDetails?.gap_results) {
      return serverDetails.gap_results[String(gapIndex)] ?? null;
    }
    // Fallback to local check (admin/teacher)
    const gap = gaps.find((g) => g.index === gapIndex);
    if (!gap) return null;
    const correct = (gap.answer || "").toLowerCase().trim();
    if (correct === "") return true;
    const userAnswer = (answers[gapIndex] || "").toLowerCase().trim();
    const alternatives =
      gap.alternatives?.map((a) => a.toLowerCase().trim()) || [];
    return userAnswer === correct || alternatives.includes(userAnswer);
  };

  // Helper to render text with line breaks
  const renderTextWithLineBreaks = (textPart: string) => {
    const lines = textPart.split("\n");
    return lines.map((line, lineIndex) => (
      <span key={lineIndex}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    ));
  };

  // If no gaps defined, show free-text answer field
  if (!gaps || gaps.length === 0) {
    const freeAnswer = (
      typeof answer === "string"
        ? answer
        : (answer as Record<string, string>)?.free || ""
    ) as string;
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-100">
        <div className="text-lg leading-relaxed mb-4">
          {renderTextWithLineBreaks(processedText)}
        </div>
        <textarea
          value={freeAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={isChecked}
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y min-h-[80px] ${
            isChecked ? "bg-gray-50 text-gray-600" : "border-gray-200"
          }`}
          placeholder="Введите ваш ответ..."
          rows={3}
        />
        {isChecked ? (
          <div className="mt-3 flex items-center gap-2 text-green-600">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">Ответ отправлен</span>
          </div>
        ) : (
          <button
            onClick={onCheck}
            disabled={!freeAnswer.trim()}
            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отправить
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="text-lg leading-relaxed">
        {parts.map((part, index) => {
          if (index % 2 === 0) {
            return <span key={index}>{renderTextWithLineBreaks(part)}</span>;
          }
          const gapIndex = parseInt(part, 10);
          const gap = gaps.find((g) => g.index === gapIndex);
          const result = checkAnswer(gapIndex);

          return (
            <span key={index} className="inline-block mx-1">
              <input
                type="text"
                value={answers[gapIndex] || ""}
                onChange={(e) =>
                  onAnswerChange({ ...answers, [gapIndex]: e.target.value })
                }
                disabled={isChecked}
                className={`w-32 px-2 py-1 border-b-2 text-center focus:outline-none ${
                  result === null
                    ? "border-purple-300 focus:border-purple-500"
                    : result
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                }`}
                placeholder={gap?.hint || "..."}
                title={canSeeAnswers && gap ? gap.answer : undefined}
              />
              {isChecked && result === false && gap && canSeeAnswers && (
                <span className="text-xs text-red-500 ml-1">
                  ({gap.answer})
                </span>
              )}
            </span>
          );
        })}
      </div>

      {!isChecked && (
        <button
          onClick={onCheck}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// Test Renderer
function TestRenderer({
  question,
  options,
  multipleAnswers,
  explanation,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  question: string;
  options: TestOption[];
  multipleAnswers: boolean;
  explanation: string;
  answer: string[] | string;
  onAnswerChange: (answer: string[] | string) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";

  const selectedIds = multipleAnswers
    ? (answer as string[]) || []
    : answer
      ? [answer as string]
      : [];

  const handleSelect = (optionId: string) => {
    if (isChecked) return;
    if (multipleAnswers) {
      const current = (answer as string[]) || [];
      if (current.includes(optionId)) {
        onAnswerChange(current.filter((id) => id !== optionId));
      } else {
        onAnswerChange([...current, optionId]);
      }
    } else {
      onAnswerChange(optionId);
    }
  };

  const getOptionState = (
    option: TestOption,
  ): "selected" | "correct" | "incorrect" | "default" => {
    const isSelected = selectedIds.includes(option.id);
    if (!isChecked) return isSelected ? "selected" : "default";
    // Use server-side results if available (students)
    if (serverDetails?.option_results) {
      const serverState = serverDetails.option_results[option.id];
      if (serverState === "correct") return "correct";
      if (serverState === "incorrect") return "incorrect";
      return "default";
    }
    // Fallback to local check (admin/teacher)
    if (isSelected && option.is_correct) return "correct";
    if (isSelected && !option.is_correct) return "incorrect";
    if (option.is_correct && canSeeAnswers) return "correct";
    return "default";
  };

  const isCorrect =
    isChecked &&
    options.every((opt) => {
      const isSelected = selectedIds.includes(opt.id);
      return isSelected === opt.is_correct;
    });

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="text-lg font-medium mb-4">{question}</div>

      <div className="space-y-2">
        {options.map((option) => {
          const state = getOptionState(option);
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={isChecked}
              title={
                canSeeAnswers && option.is_correct
                  ? "✓ Правильный ответ"
                  : undefined
              }
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                state === "selected"
                  ? "border-purple-500 bg-purple-50"
                  : state === "correct"
                    ? "border-green-500 bg-green-50"
                    : state === "incorrect"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    state === "selected"
                      ? "border-purple-500 bg-purple-500"
                      : state === "correct"
                        ? "border-green-500 bg-green-500"
                        : state === "incorrect"
                          ? "border-red-500 bg-red-500"
                          : "border-gray-300"
                  }`}
                >
                  {(state === "selected" ||
                    state === "correct" ||
                    state === "incorrect") && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span>{option.text}</span>
              </div>
            </button>
          );
        })}
      </div>

      {isChecked && explanation && (
        <div
          className={`mt-4 p-3 rounded-lg ${isCorrect ? "bg-green-50" : "bg-yellow-50"}`}
        >
          <div className="text-sm font-medium mb-1">
            {isCorrect ? "Правильно!" : "Пояснение"}
          </div>
          <div className="text-sm text-gray-600">{explanation}</div>
        </div>
      )}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={selectedIds.length === 0}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// True/False Renderer
function TrueFalseRenderer({
  statement,
  isTrue,
  explanation,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  statement: string;
  isTrue: boolean;
  explanation: string;
  answer: boolean | undefined;
  onAnswerChange: (answer: boolean) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";
  // Use server result for students, local check for admin/teacher
  const isCorrect =
    isChecked &&
    (serverDetails?.is_correct !== undefined
      ? serverDetails.is_correct
      : answer === isTrue);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="text-lg font-medium mb-4">{statement}</div>

      <div className="flex gap-4">
        {[
          { value: true, label: "Верно" },
          { value: false, label: "Неверно" },
        ].map(({ value, label }) => {
          const isSelected = answer === value;
          // For students with serverDetails: only highlight selected answer as correct/wrong
          const isCorrectAnswer = isChecked && isSelected && isCorrect;
          const isWrongAnswer = isChecked && isSelected && !isCorrect;
          // For admin/teacher: also show the correct answer even if not selected
          const showCorrect =
            isChecked && !isSelected && canSeeAnswers && value === isTrue;
          const isWrong = serverDetails
            ? isWrongAnswer
            : isChecked && isSelected && value !== isTrue;

          return (
            <button
              key={String(value)}
              onClick={() => !isChecked && onAnswerChange(value)}
              disabled={isChecked}
              title={
                canSeeAnswers && value === isTrue
                  ? "✓ Правильный ответ"
                  : undefined
              }
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                isCorrectAnswer || showCorrect
                  ? "border-green-500 bg-green-50"
                  : isWrong
                    ? "border-red-500 bg-red-50"
                    : isSelected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isChecked && explanation && (
        <div
          className={`mt-4 p-3 rounded-lg ${isCorrect ? "bg-green-50" : "bg-yellow-50"}`}
        >
          <div className="text-sm font-medium mb-1">
            {isCorrect ? "Правильно!" : "Пояснение"}
          </div>
          <div className="text-sm text-gray-600">{explanation}</div>
        </div>
      )}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={answer === undefined}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// Word Order Renderer
function WordOrderRenderer({
  correctSentence,
  shuffledWords,
  hint,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  correctSentence: string;
  shuffledWords: string[];
  hint: string;
  answer: string[];
  onAnswerChange: (answer: string[]) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";
  const selectedWords = answer || [];
  const availableWords = shuffledWords.filter((word, index) => {
    const selectedIndex = selectedWords.indexOf(word);
    if (selectedIndex === -1) return true;
    const wordCount = shuffledWords
      .slice(0, index + 1)
      .filter((w) => w === word).length;
    const usedCount = selectedWords.filter((w) => w === word).length;
    return wordCount > usedCount;
  });

  const isCorrect =
    isChecked &&
    (serverDetails?.is_correct !== undefined
      ? serverDetails.is_correct
      : selectedWords.join(" ") === correctSentence);

  const handleSelectWord = (word: string) => {
    if (isChecked) return;
    onAnswerChange([...selectedWords, word]);
  };

  const handleRemoveWord = (index: number) => {
    if (isChecked) return;
    onAnswerChange(selectedWords.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      {hint && <div className="text-sm text-gray-500 mb-4">{hint}</div>}

      {/* Selected words area */}
      <div
        className={`min-h-[60px] p-3 rounded-lg border-2 mb-4 ${
          isChecked
            ? isCorrect
              ? "border-green-500 bg-green-50"
              : "border-red-500 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        {selectedWords.length === 0 ? (
          <span className="text-gray-400">
            Нажмите на слова, чтобы составить предложение
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedWords.map((word, index) => (
              <button
                key={index}
                onClick={() => handleRemoveWord(index)}
                disabled={isChecked}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:hover:bg-purple-100"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2">
        {availableWords.map((word, index) => (
          <button
            key={index}
            onClick={() => handleSelectWord(word)}
            disabled={isChecked}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      {isChecked &&
        !isCorrect &&
        (canSeeAnswers ? (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50">
            <div className="text-sm font-medium mb-1">Правильный ответ:</div>
            <div className="text-sm text-gray-600">{correctSentence}</div>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-red-50">
            <div className="text-sm font-medium text-red-600">
              Неправильно. Попробуйте ещё раз.
            </div>
          </div>
        ))}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={selectedWords.length === 0}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// Matching Renderer
function MatchingRenderer({
  pairs,
  shuffleRight,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  pairs: MatchingPair[];
  shuffleRight: boolean;
  answer: Record<string, string>;
  onAnswerChange: (answer: Record<string, string>) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const matches = answer || {};

  const rightItems = useMemo(() => {
    const items = pairs.map((p) => p.right);
    if (shuffleRight) {
      return [...items].sort(() => Math.random() - 0.5);
    }
    return items;
  }, [pairs, shuffleRight]);

  const handleLeftClick = (left: string) => {
    if (isChecked) return;
    setSelectedLeft(selectedLeft === left ? null : left);
  };

  const handleRightClick = (right: string) => {
    if (isChecked || !selectedLeft) return;
    onAnswerChange({ ...matches, [selectedLeft]: right });
    setSelectedLeft(null);
  };

  const isCorrect = (left: string): boolean | null => {
    if (!isChecked) return null;
    // Use server-side results if available (students)
    if (serverDetails?.pair_results) {
      return serverDetails.pair_results[left] ?? null;
    }
    // Fallback to local check (admin/teacher)
    const pair = pairs.find((p) => p.left === left);
    return pair ? matches[left] === pair.right : null;
  };

  const allCorrect =
    isChecked &&
    (serverDetails?.pair_results
      ? Object.values(serverDetails.pair_results).every(Boolean)
      : pairs.every((pair) => matches[pair.left] === pair.right));

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="flex gap-4">
        {/* Left column */}
        <div className="flex-1 space-y-2">
          {pairs.map((pair) => {
            const result = isCorrect(pair.left);
            return (
              <button
                key={pair.left}
                onClick={() => handleLeftClick(pair.left)}
                disabled={isChecked}
                title={canSeeAnswers ? `✓ ${pair.right}` : undefined}
                className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                  result === true
                    ? "border-green-500 bg-green-50"
                    : result === false
                      ? "border-red-500 bg-red-50"
                      : selectedLeft === pair.left
                        ? "border-purple-500 bg-purple-50"
                        : matches[pair.left]
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {pair.left}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex-1 space-y-2">
          {rightItems.map((right) => {
            const isMatched = Object.values(matches).includes(right);
            const isImage =
              /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(
                right,
              );
            return (
              <button
                key={right}
                onClick={() => handleRightClick(right)}
                disabled={isChecked || !selectedLeft}
                className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                  isMatched
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                } ${!isChecked && selectedLeft ? "hover:border-purple-300" : ""}`}
              >
                {isImage ? (
                  <img
                    src={right}
                    alt=""
                    className="w-full h-24 object-contain rounded"
                  />
                ) : (
                  right
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isChecked &&
        !allCorrect &&
        (canSeeAnswers ? (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50">
            <div className="text-sm font-medium mb-1">Правильные пары:</div>
            <div className="text-sm text-gray-600 space-y-1">
              {pairs.map((p) => {
                const isImage =
                  /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(
                    p.right,
                  );
                return (
                  <div key={p.left} className="flex items-center gap-2">
                    <span>{p.left}</span>
                    <span>↔</span>
                    {isImage ? (
                      <img
                        src={p.right}
                        alt=""
                        className="h-8 object-contain rounded"
                      />
                    ) : (
                      <span>{p.right}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-red-50">
            <div className="text-sm font-medium text-red-600">
              Есть ошибки. Попробуйте ещё раз.
            </div>
          </div>
        ))}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={Object.keys(matches).length < pairs.length}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// Essay Renderer
function EssayRenderer({
  prompt,
  minWords,
  maxWords,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
}: {
  prompt: string;
  minWords: number | null;
  maxWords: number | null;
  answer: string;
  onAnswerChange: (answer: string) => void;
  isChecked: boolean;
  onCheck: () => void;
}) {
  const text = answer || "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const isValid =
    (minWords === null || wordCount >= minWords) &&
    (maxWords === null || wordCount <= maxWords);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="text-lg font-medium mb-4">{prompt}</div>

      <textarea
        value={text}
        onChange={(e) => onAnswerChange(e.target.value)}
        disabled={isChecked}
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[150px]"
        placeholder="Введите ваш ответ..."
      />

      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-gray-500">
          Слов: {wordCount}
          {minWords !== null && ` (мин. ${minWords})`}
          {maxWords !== null && ` (макс. ${maxWords})`}
        </div>
        {!isValid && (
          <div className="text-sm text-red-500">
            {minWords !== null &&
              wordCount < minWords &&
              `Минимум ${minWords} слов`}
            {maxWords !== null &&
              wordCount > maxWords &&
              `Максимум ${maxWords} слов`}
          </div>
        )}
      </div>

      {isChecked && (
        <div className="mt-4 p-3 rounded-lg bg-green-50">
          <div className="text-sm font-medium">Ответ отправлен</div>
        </div>
      )}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={!isValid || wordCount === 0}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Отправить
        </button>
      )}
    </div>
  );
}

// Image Renderer
function ImageRenderer({
  url,
  caption,
  alt,
}: {
  url: string;
  caption: string;
  alt: string;
}) {
  if (!url) {
    return <div className="text-gray-500">URL изображения не указан</div>;
  }

  return (
    <figure className="text-center my-6">
      <img
        src={url}
        alt={alt || caption || "Изображение"}
        className="w-full max-w-4xl h-auto rounded-lg mx-auto shadow-md"
      />
      {caption && (
        <figcaption className="mt-3 text-base text-gray-700 italic max-w-4xl mx-auto">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// Remember Renderer (highlighted important info)
function RememberRenderer({ html, icon }: { html: string; icon: string }) {
  const getIconClass = () => {
    switch (icon) {
      case "warning":
        return "text-yellow-500";
      case "tip":
        return "text-green-500";
      case "important":
        return "text-red-500";
      default:
        return "text-blue-500";
    }
  };

  const getIcon = () => {
    switch (icon) {
      case "warning":
        return (
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case "tip":
        return (
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        );
      case "important":
        return (
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getBgColor = () => {
    switch (icon) {
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "tip":
        return "bg-green-50 border-green-200";
      case "important":
        return "bg-red-50 border-red-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${getBgColor()}`}>
      <div className="flex gap-3">
        <div className={`flex-shrink-0 ${getIconClass()}`}>{getIcon()}</div>
        <div
          className="prose prose-sm max-w-none flex-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

// Table Renderer
function TableRenderer({
  rows,
  hasHeader,
}: {
  rows: TableRow[];
  hasHeader: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-gray-500">Таблица пуста</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-200">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => {
                const isHeader = hasHeader && rowIndex === 0;
                const CellTag = isHeader ? "th" : "td";
                const baseClass = "border border-gray-200 px-4 py-2";
                const headerClass = isHeader
                  ? "bg-gray-100 font-medium text-left"
                  : "";
                const styleClass =
                  cell.style === "header" ? "bg-gray-100 font-medium" : "";

                return (
                  <CellTag
                    key={cellIndex}
                    colSpan={cell.colspan || 1}
                    rowSpan={cell.rowspan || 1}
                    className={`${baseClass} ${headerClass} ${styleClass}`}
                  >
                    {cell.text}
                  </CellTag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Image Choice Renderer
function ImageChoiceRenderer({
  question,
  options,
  explanation,
  answer,
  onAnswerChange,
  isChecked,
  onCheck,
  serverDetails,
}: {
  question: string;
  options: ImageOption[];
  explanation: string;
  answer: string;
  onAnswerChange: (answer: string) => void;
  isChecked: boolean;
  onCheck: () => void;
  serverDetails?: ExerciseResultDetails;
}) {
  const { user } = useAuthStore();
  const canSeeAnswers =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "teacher";

  const handleSelect = (optionId: string) => {
    if (isChecked) return;
    onAnswerChange(optionId);
  };

  const getOptionState = (
    option: ImageOption,
  ): "selected" | "correct" | "incorrect" | "default" => {
    const isSelected = answer === option.id;
    if (!isChecked) return isSelected ? "selected" : "default";
    // Use server-side results if available (students)
    if (serverDetails?.option_results) {
      const serverState = serverDetails.option_results[option.id];
      if (serverState === "correct") return "correct";
      if (serverState === "incorrect") return "incorrect";
      return "default";
    }
    // Fallback to local check (admin/teacher)
    if (isSelected && option.is_correct) return "correct";
    if (isSelected && !option.is_correct) return "incorrect";
    if (option.is_correct && canSeeAnswers) return "correct";
    return "default";
  };

  const isCorrect =
    isChecked &&
    (serverDetails?.option_results
      ? Object.values(serverDetails.option_results).some((s) => s === "correct")
      : options.find((o) => o.id === answer)?.is_correct);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      <div className="text-lg font-medium mb-4">{question}</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {options.map((option) => {
          const state = getOptionState(option);
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={isChecked}
              className={`relative rounded-lg border-4 overflow-hidden transition-colors ${
                state === "selected"
                  ? "border-purple-500"
                  : state === "correct"
                    ? "border-green-500"
                    : state === "incorrect"
                      ? "border-red-500"
                      : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <img
                src={option.url}
                alt={option.caption || ""}
                className="w-full h-32 object-cover"
              />
              {option.caption && (
                <div className="p-2 text-sm text-center bg-gray-50">
                  {option.caption}
                </div>
              )}
              {(state === "selected" || state === "correct") && (
                <div
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                    state === "correct" ? "bg-green-500" : "bg-purple-500"
                  }`}
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
              {state === "incorrect" && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isChecked && explanation && (
        <div
          className={`mt-4 p-3 rounded-lg ${isCorrect ? "bg-green-50" : "bg-yellow-50"}`}
        >
          <div className="text-sm font-medium mb-1">
            {isCorrect ? "Правильно!" : "Пояснение"}
          </div>
          <div className="text-sm text-gray-600">{explanation}</div>
        </div>
      )}

      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={!answer}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Проверить
        </button>
      )}
    </div>
  );
}

// Flashcards Renderer
function FlashcardsRenderer({
  title,
  cards,
  shuffle,
}: {
  title: string;
  cards: Flashcard[];
  shuffle: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const shuffledCards = useMemo(() => {
    if (!shuffle) return cards;
    return [...cards].sort(() => Math.random() - 0.5);
  }, [cards, shuffle]);

  if (shuffledCards.length === 0) {
    return <div className="text-gray-500">Нет карточек</div>;
  }

  const currentCard = shuffledCards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % shuffledCards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex(
      (prev) => (prev - 1 + shuffledCards.length) % shuffledCards.length,
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100">
      {title && (
        <div className="text-lg font-medium mb-4 text-center">{title}</div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrev}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="relative w-80 h-48 cursor-pointer perspective-1000"
        >
          <div
            className={`absolute w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
              isFlipped ? "rotate-y-180" : ""
            }`}
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front */}
            <div
              className="absolute w-full h-full bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg flex flex-col items-center justify-center p-6 text-white"
              style={{ backfaceVisibility: "hidden" }}
            >
              {currentCard.image_url && (
                <img
                  src={currentCard.image_url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg mb-3"
                />
              )}
              <div className="text-xl font-medium text-center">
                {currentCard.front}
              </div>
              <div className="mt-2 text-sm text-purple-200">
                Нажмите, чтобы перевернуть
              </div>
            </div>

            {/* Back */}
            <div
              className="absolute w-full h-full bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg flex items-center justify-center p-6 text-white"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div className="text-xl font-medium text-center">
                {currentCard.back}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleNext}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        {currentIndex + 1} / {shuffledCards.length}
      </div>
    </div>
  );
}

// Vocabulary Renderer
function VocabularyRenderer({
  words,
  showTranscription,
}: {
  words: VocabularyWordItem[];
  showTranscription: boolean;
}) {
  const [speaking, setSpeaking] = useState<number | null>(null);

  const speak = (text: string, index: number) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;

    utterance.onstart = () => setSpeaking(index);
    utterance.onend = () => setSpeaking(null);
    utterance.onerror = () => setSpeaking(null);

    window.speechSynthesis.speak(utterance);
  };

  if (words.length === 0) {
    return <div className="text-gray-500">Список слов пуст</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100">
      <div className="divide-y divide-gray-100">
        {words.map((word, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            {/* Speaker button */}
            <button
              onClick={() => speak(word.word, index)}
              className={`p-2 rounded-full transition-colors ${
                speaking === index
                  ? "bg-cyan-100 text-cyan-600"
                  : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              }`}
              title="Прослушать произношение"
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
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            </button>

            {/* Word and translation */}
            <div className="flex-1">
              <div className="font-medium text-gray-800">
                {word.word}
                {showTranscription && word.transcription && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {word.transcription}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">{word.translation}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
