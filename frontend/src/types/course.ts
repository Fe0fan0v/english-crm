// Exercise Block Types
export type ExerciseBlockType =
  | 'text'
  | 'video'
  | 'audio'
  | 'image'
  | 'article'
  | 'divider'
  | 'teaching_guide'
  | 'remember'
  | 'table'
  | 'fill_gaps'
  | 'test'
  | 'true_false'
  | 'word_order'
  | 'matching'
  | 'image_choice'
  | 'flashcards'
  | 'essay';

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
  image_position?: 'left' | 'right' | 'top' | 'bottom';
}

export interface DividerBlockContent {
  style?: 'line' | 'space' | 'dots';
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

export interface WordOrderBlockContent {
  correct_sentence: string;
  shuffled_words: string[];
  hint?: string | null;
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

export interface ImageBlockContent {
  url: string;
  caption?: string | null;
  alt?: string | null;
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
  | FillGapsBlockContent
  | TestBlockContent
  | TrueFalseBlockContent
  | WordOrderBlockContent
  | MatchingBlockContent
  | ImageChoiceBlockContent
  | FlashcardsBlockContent
  | EssayBlockContent;

// Exercise Block
export interface ExerciseBlock {
  id: number;
  lesson_id: number;
  block_type: ExerciseBlockType;
  content: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseBlockCreate {
  block_type: ExerciseBlockType;
  content: Record<string, unknown>;
  position?: number;
}

export interface ExerciseBlockUpdate {
  block_type?: ExerciseBlockType;
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

export interface InteractiveLessonDetail extends Omit<InteractiveLesson, 'blocks_count'> {
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

export interface CourseSectionDetail extends Omit<CourseSection, 'lessons_count'> {
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

export interface CourseDetail extends Omit<Course, 'sections_count' | 'lessons_count'> {
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
  text: 'Текст',
  video: 'Видео',
  audio: 'Аудио',
  image: 'Изображение',
  article: 'Статья',
  divider: 'Разделитель',
  teaching_guide: 'Заметка для учителя',
  remember: 'Запомни',
  table: 'Таблица',
  fill_gaps: 'Заполнить пропуски',
  test: 'Тест',
  true_false: 'Верно/Неверно',
  word_order: 'Порядок слов',
  matching: 'Сопоставление',
  image_choice: 'Выбор изображения',
  flashcards: 'Карточки',
  essay: 'Эссе',
};

export const CONTENT_BLOCK_TYPES: ExerciseBlockType[] = [
  'text', 'video', 'audio', 'image', 'article', 'divider', 'teaching_guide', 'remember', 'table'
];
export const INTERACTIVE_BLOCK_TYPES: ExerciseBlockType[] = [
  'fill_gaps', 'test', 'true_false', 'word_order', 'matching', 'image_choice', 'flashcards', 'essay'
];
