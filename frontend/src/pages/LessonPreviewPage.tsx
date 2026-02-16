import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interactiveLessonApi, exerciseResultApi } from '../services/courseApi';
import { useAuthStore } from '../store/authStore';
import type { InteractiveLessonDetail, ExerciseBlock } from '../types/course';
import BlockRenderer from '../components/blocks/BlockRenderer';

// Block type labels for the sidebar
const BLOCK_TYPE_ICONS: Record<string, string> = {
  text: '',
  image: '',
  video: '',
  audio: '',
  fill_gaps: '',
  test: '',
  true_false: '',
  word_order: '',
  matching: '',
  essay: '',
  flashcards: '',
  vocabulary: '',
  article: '',
  table: '',
  image_choice: '',
  remember: '',
  teaching_guide: '',
  divider: '',
};

interface NavItem {
  id: number;
  title: string;
  blockType: string;
  index: number;
}

export default function LessonPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [lesson, setLesson] = useState<InteractiveLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const savedBlockIds = useRef<Set<number>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (id) loadLesson();
  }, [id]);

  // Intersection Observer to track active block
  useEffect(() => {
    if (!lesson) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const blockId = Number(entry.target.getAttribute('data-block-id'));
            if (blockId) setActiveBlockId(blockId);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    for (const block of lesson.blocks) {
      const el = blockRefs.current[block.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [lesson]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const data = await interactiveLessonApi.get(Number(id));
      setLesson(data);

      // Load saved results for students
      if (user?.role === 'student') {
        try {
          const saved = await exerciseResultApi.getMyResults(Number(id));
          if (saved.results.length > 0) {
            const restoredAnswers: Record<number, unknown> = {};
            const restoredChecked: Record<number, boolean> = {};
            for (const r of saved.results) {
              restoredAnswers[r.block_id] = r.answer;
              restoredChecked[r.block_id] = true;
              savedBlockIds.current.add(r.block_id);
            }
            setAnswers(restoredAnswers);
            setChecked(restoredChecked);
          }
        } catch {
          // Ignore errors loading saved results
        }
      }
    } catch (error) {
      console.error('Failed to load lesson:', error);
      alert('Не удалось загрузить урок');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (blockId: number, answer: unknown) => {
    // Don't allow changes to already saved answers
    if (savedBlockIds.current.has(blockId)) return;
    setAnswers(prev => ({ ...prev, [blockId]: answer }));
    if (checked[blockId]) {
      setChecked(prev => ({ ...prev, [blockId]: false }));
    }
  };

  const handleCheck = async (blockId: number) => {
    setChecked(prev => ({ ...prev, [blockId]: true }));

    // Save to backend for students
    if (isStudent && id) {
      try {
        await exerciseResultApi.submit(Number(id), {
          block_id: blockId,
          answer: answers[blockId],
        });
        savedBlockIds.current.add(blockId);
      } catch (error) {
        console.error('Failed to save answer:', error);
      }
    }
  };

  const handleReset = (blockId: number) => {
    savedBlockIds.current.delete(blockId);
    setAnswers(prev => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    setChecked(prev => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
  };

  // Build navigation items from blocks with titles
  const navItems: NavItem[] = useMemo(() => {
    if (!lesson) return [];
    return lesson.blocks
      .map((block, index) => ({
        id: block.id,
        title: block.title || '',
        blockType: block.block_type,
        index,
      }))
      .filter(item => item.title && !['teaching_guide', 'divider'].includes(item.blockType));
  }, [lesson]);

  const scrollToBlock = useCallback((blockId: number) => {
    const el = blockRefs.current[blockId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSidebarOpen(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!lesson) {
    return <div className="text-center py-12 text-gray-500">Урок не найден</div>;
  }

  const showSidebar = navItems.length >= 3;

  return (
    <div className={`${showSidebar ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад
          </button>

          {/* Mobile sidebar toggle */}
          {showSidebar && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Содержание
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-800">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-gray-600 mt-2">{lesson.description}</p>
        )}
      </div>

      <div className={`${showSidebar ? 'flex gap-6' : ''}`}>
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Blocks */}
          <div className="space-y-6">
            {lesson.blocks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                В этом уроке пока нет контента
              </div>
            ) : (
              lesson.blocks.map((block, index) => (
                <div
                  key={block.id}
                  ref={(el) => { blockRefs.current[block.id] = el; }}
                  data-block-id={block.id}
                  className="scroll-mt-4"
                >
                  <BlockRenderer
                    block={block}
                    blockNumber={getBlockNumber(lesson.blocks, index)}
                    answer={answers[block.id]}
                    onAnswerChange={(answer) => handleAnswerChange(block.id, answer)}
                    isChecked={checked[block.id] || false}
                    onCheck={() => handleCheck(block.id)}
                    onReset={() => handleReset(block.id)}
                  />
                </div>
              ))
            )}
          </div>

          {/* Progress */}
          {lesson.blocks.length > 0 && (
            <div className="mt-8 p-4 bg-white rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Прогресс</span>
                <span className="text-sm font-medium text-gray-800">
                  {Object.keys(checked).filter(k => checked[Number(k)]).length} / {getInteractiveBlocksCount(lesson.blocks)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                  style={{
                    width: `${
                      getInteractiveBlocksCount(lesson.blocks) > 0
                        ? (Object.keys(checked).filter(k => checked[Number(k)]).length /
                            getInteractiveBlocksCount(lesson.blocks)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar navigation */}
        {showSidebar && (
          <>
            {/* Desktop sidebar */}
            <nav className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Содержание
                </h3>
                <div className="space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToBlock(item.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
                        activeBlockId === item.id
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                      }`}
                      title={item.title}
                    >
                      {BLOCK_TYPE_ICONS[item.blockType]}{item.title}
                    </button>
                  ))}
                </div>
              </div>
            </nav>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
                <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
                <div className="relative w-72 bg-white shadow-xl p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Содержание</h3>
                    <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1">
                    {navItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToBlock(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeBlockId === item.id
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getInteractiveBlocksCount(blocks: ExerciseBlock[]): number {
  const interactiveTypes = ['fill_gaps', 'test', 'true_false', 'word_order', 'matching', 'essay'];
  return blocks.filter(b => interactiveTypes.includes(b.block_type)).length;
}

// Block types that should not be numbered (informational/instructional blocks)
const NON_NUMBERED_TYPES = ['teaching_guide', 'divider', 'remember'];

function getBlockNumber(blocks: ExerciseBlock[], currentIndex: number): number | undefined {
  const block = blocks[currentIndex];

  // Non-numbered block types
  if (NON_NUMBERED_TYPES.includes(block.block_type)) {
    return undefined;
  }

  // Count numbered blocks before this one
  let number = 0;
  for (let i = 0; i <= currentIndex; i++) {
    if (!NON_NUMBERED_TYPES.includes(blocks[i].block_type)) {
      number++;
    }
  }
  return number;
}
