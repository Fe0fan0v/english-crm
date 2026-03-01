// Exercise Block Types
export type ExerciseBlockType =
  | "text"
  | "video"
  | "audio"
  | "image"
  | "article"
  | "divider"
  | "teaching_guide"
  | "remember"
  | "table"
  | "vocabulary"
  | "fill_gaps"
  | "test"
  | "true_false"
  | "word_order"
  | "matching"
  | "image_choice"
  | "flashcards"
  | "essay"
  | "page_break"
  | "drag_words"
  | "sentence_choice";

// Content type interfaces for each block type

export interface TextBlockContent {
  html: string;
}

export interface VideoBlockContent {
  url: string;
  provider?: string | null;
  title?: string | null;
}

export interface AudioBlockContent {
  url: string;
  title?: string | null;
}

export interface ArticleBlockContent {
  html: string;
  image_url?: string | null;
  image_position?: "left" | "right" | "top" | "bottom";
}

export interface DividerBlockContent {
  style?: "line" | "space" | "dots";
}

export interface GapItem {
  index: number;
  answer: string;
  hint?: string | null;
  alternatives?: string[];
}

export interface FillGapsBlockContent {
  text: string;
  gaps: GapItem[];
}

export interface TestOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface TestBlockContent {
  question: string;
  options: TestOption[];
  multiple_answers?: boolean;
  explanation?: string | null;
}

export interface TrueFalseBlockContent {
  statement: string;
  is_true: boolean;
  explanation?: string | null;
}

export interface WordOrderSentence {
  correct_sentence: string;
  shuffled_words: string[];
  hint?: string | null;
}

export interface WordOrderBlockContent {
  correct_sentence: string;
  shuffled_words: string[];
  hint?: string | null;
  sentences?: WordOrderSentence[];
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface MatchingBlockContent {
  pairs: MatchingPair[];
  shuffle_right?: boolean;
}

export interface EssayBlockContent {
  prompt: string;
  min_words?: number | null;
  max_words?: number | null;
  sample_answer?: string | null;
}

export interface CarouselImage {
  url: string;
  caption?: string | null;
}

export interface ImageBlockContent {
  url: string;
  caption?: string | null;
  alt?: string | null;
  images?: CarouselImage[];
}

export interface TeachingGuideBlockContent {
  html: string;
}

export interface RememberBlockContent {
  html: string;
  icon?: string | null;
}

export interface TableCell {
  text: string;
  colspan?: number;
  rowspan?: number;
  style?: string | null;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableBlockContent {
  rows: TableRow[];
  has_header?: boolean;
}

export interface ImageOption {
  id: string;
  url: string;
  caption?: string | null;
  is_correct: boolean;
}

export interface ImageChoiceBlockContent {
  question: string;
  options: ImageOption[];
  explanation?: string | null;
}

export interface Flashcard {
  front: string;
  back: string;
  image_url?: string | null;
}

export interface FlashcardsBlockContent {
  title?: string | null;
  cards: Flashcard[];
  shuffle?: boolean;
}

export interface VocabularyWord {
  word: string;
  translation: string;
  transcription?: string | null;
}

export interface VocabularyBlockContent {
  words: VocabularyWord[];
  show_transcription?: boolean;
}

export interface PageBreakBlockContent {
  label?: string;
}

export interface DragWord {
  index: number;
  word: string;
}

export interface DragWordsBlockContent {
  text: string;
  words: DragWord[];
  distractors?: string[];
}

export interface SentenceChoiceQuestion {
  id: string;
  options: string[];
  correct_index?: number; // stripped for students
}

export interface SentenceChoiceBlockContent {
  questions: SentenceChoiceQuestion[];
}

// Union type for all block content types
export type BlockContent =
  | TextBlockContent
  | VideoBlockContent
  | AudioBlockContent
  | ImageBlockContent
  | ArticleBlockContent
  | DividerBlockContent
  | TeachingGuideBlockContent
  | RememberBlockContent
  | TableBlockContent
  | VocabularyBlockContent
  | FillGapsBlockContent
  | TestBlockContent
  | TrueFalseBlockContent
  | WordOrderBlockContent
  | MatchingBlockContent
  | ImageChoiceBlockContent
  | FlashcardsBlockContent
  | EssayBlockContent
  | PageBreakBlockContent
  | DragWordsBlockContent
  | SentenceChoiceBlockContent;

// Exercise Block
export interface ExerciseBlock {
  id: number;
  lesson_id: number;
  block_type: ExerciseBlockType;
  title?: string | null; // Optional block title (e.g., "Introduce yourself")
  content: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseBlockCreate {
  block_type: ExerciseBlockType;
  title?: string | null;
  content: Record<string, unknown>;
  position?: number;
}

export interface ExerciseBlockUpdate {
  block_type?: ExerciseBlockType;
  title?: string | null;
  content?: Record<string, unknown>;
  position?: number;
}

// Interactive Lesson
export interface InteractiveLesson {
  id: number;
  section_id: number;
  title: string;
  description?: string | null;
  position: number;
  is_published: boolean;
  is_homework: boolean;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  blocks_count: number;
}

export interface InteractiveLessonDetail extends Omit<
  InteractiveLesson,
  "blocks_count"
> {
  blocks: ExerciseBlock[];
}

export interface InteractiveLessonCreate {
  title: string;
  description?: string | null;
  position?: number;
  is_published?: boolean;
  is_homework?: boolean;
}

export interface InteractiveLessonUpdate {
  title?: string;
  description?: string | null;
  position?: number;
  is_published?: boolean;
  is_homework?: boolean;
}

// Course Section
export interface CourseSection {
  id: number;
  course_id: number;
  title: string;
  description?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  lessons_count: number;
}

export interface CourseSectionDetail extends Omit<
  CourseSection,
  "lessons_count"
> {
  lessons: InteractiveLesson[];
}

export interface CourseSectionCreate {
  title: string;
  description?: string | null;
  position?: number;
}

export interface CourseSectionUpdate {
  title?: string;
  description?: string | null;
  position?: number;
}

// Course
export interface Course {
  id: number;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_published: boolean;
  created_by_id: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  sections_count: number;
  lessons_count: number;
}

export interface CourseDetail extends Omit<
  Course,
  "sections_count" | "lessons_count"
> {
  sections: CourseSectionDetail[];
}

export interface CourseCreate {
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_published?: boolean;
}

export interface CourseUpdate {
  title?: string;
  description?: string | null;
  cover_url?: string | null;
  is_published?: boolean;
}

export interface CourseListResponse {
  items: Course[];
  total: number;
}

// Reorder
export interface ReorderItem {
  id: number;
  position: number;
}

// Block type labels and icons for UI
export const BLOCK_TYPE_LABELS: Record<ExerciseBlockType, string> = {
  text: "Текст",
  video: "Видео",
  audio: "Аудио",
  image: "Изображение",
  article: "Статья",
  divider: "Разделитель",
  teaching_guide: "Заметка для учителя",
  remember: "Запомни",
  table: "Таблица",
  vocabulary: "Словарь",
  fill_gaps: "Заполнить пропуски",
  test: "Тест",
  true_false: "Верно/Неверно",
  word_order: "Порядок слов",
  matching: "Сопоставление",
  image_choice: "Выбор изображения",
  flashcards: "Карточки",
  essay: "Эссе",
  page_break: "Разрыв страницы",
  drag_words: "Перетаскивание слов",
  sentence_choice: "Выбор предложения",
};

export const CONTENT_BLOCK_TYPES: ExerciseBlockType[] = [
  "text",
  "video",
  "audio",
  "image",
  "article",
  "divider",
  "teaching_guide",
  "remember",
  "table",
  "vocabulary",
  "page_break",
];
export const INTERACTIVE_BLOCK_TYPES: ExerciseBlockType[] = [
  "fill_gaps",
  "test",
  "true_false",
  "word_order",
  "matching",
  "image_choice",
  "flashcards",
  "essay",
  "drag_words",
  "sentence_choice",
];

// ============== Exercise Results ==============

export interface ExerciseResultSubmit {
  block_id: number;
  answer: unknown;
}

export interface SentenceResult {
  is_correct: boolean;
  correct_sentence: string;
}

export interface ExerciseResultDetails {
  gap_results?: Record<string, boolean>;
  correct_answers?: Record<string, string>;
  option_results?: Record<string, "correct" | "incorrect" | "correct_missed" | "default">;
  pair_results?: Record<string, boolean>;
  correct_pairs?: Record<string, string>;
  drag_results?: Record<string, boolean>;
  question_results?: Record<string, boolean>;
  is_correct?: boolean;
  correct_answer?: boolean;
  correct_sentence?: string;
  sentence_results?: SentenceResult[];
}

export interface ExerciseResultResponse {
  id: number;
  student_id: number;
  block_id: number;
  lesson_id: number;
  answer: unknown;
  is_correct: boolean | null;
  details?: ExerciseResultDetails | null;
  updated_at: string;
}

export interface LessonResultsResponse {
  lesson_id: number;
  results: ExerciseResultResponse[];
  score: number;
  total: number;
  answered: number;
}

export interface StudentLessonSummary {
  student_id: number;
  student_name: string;
  score: number;
  total: number;
  answered: number;
  total_blocks: number;
  last_activity: string | null;
}

export interface LessonStudentResultsResponse {
  lesson_id: number;
  lesson_title: string;
  students: StudentLessonSummary[];
}

export interface StudentBlockResult {
  block_id: number;
  block_type: string;
  block_title: string | null;
  block_content: Record<string, unknown>;
  answer: unknown;
  is_correct: boolean | null;
  updated_at: string | null;
}

export interface StudentLessonDetailResponse {
  student_id: number;
  student_name: string;
  lesson_id: number;
  lesson_title: string;
  score: number;
  total: number;
  blocks: StudentBlockResult[];
}
