import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interactiveLessonApi } from '../services/courseApi';
import type { InteractiveLessonDetail, ExerciseBlock } from '../types/course';
import BlockRenderer from '../components/blocks/BlockRenderer';

export default function LessonPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<InteractiveLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (id) loadLesson();
  }, [id]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const data = await interactiveLessonApi.get(Number(id));
      setLesson(data);
    } catch (error) {
      console.error('Failed to load lesson:', error);
      alert('Не удалось загрузить урок');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (blockId: number, answer: unknown) => {
    setAnswers(prev => ({ ...prev, [blockId]: answer }));
    // Reset checked state when answer changes
    if (checked[blockId]) {
      setChecked(prev => ({ ...prev, [blockId]: false }));
    }
  };

  const handleCheck = (blockId: number) => {
    setChecked(prev => ({ ...prev, [blockId]: true }));
  };

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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        <h1 className="text-2xl font-bold text-gray-800">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-gray-600 mt-2">{lesson.description}</p>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-6">
        {lesson.blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            В этом уроке пока нет контента
          </div>
        ) : (
          lesson.blocks.map((block, index) => (
            <BlockRenderer
              key={block.id}
              block={block}
              blockNumber={getBlockNumber(lesson.blocks, index)}
              answer={answers[block.id]}
              onAnswerChange={(answer) => handleAnswerChange(block.id, answer)}
              isChecked={checked[block.id] || false}
              onCheck={() => handleCheck(block.id)}
            />
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
