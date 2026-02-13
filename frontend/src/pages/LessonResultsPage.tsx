import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { exerciseResultApi } from '../services/courseApi';
import type {
  LessonStudentResultsResponse,
  StudentLessonSummary,
  StudentLessonDetailResponse,
  StudentBlockResult,
} from '../types/course';

export default function LessonResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<LessonStudentResultsResponse | null>(null);
  const [detail, setDetail] = useState<StudentLessonDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadSummaries();
  }, [id]);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      setDetail(null);
      const data = await exerciseResultApi.getStudentSummaries(Number(id));
      setSummaries(data);
    } catch (error) {
      console.error('Failed to load results:', error);
      alert('Не удалось загрузить результаты');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetail = async (studentId: number) => {
    try {
      setLoading(true);
      const data = await exerciseResultApi.getStudentDetail(Number(id), studentId);
      setDetail(data);
    } catch (error) {
      console.error('Failed to load student detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => detail ? (() => { setDetail(null); })() : navigate(-1)}
        className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {detail ? 'К списку учеников' : 'Назад'}
      </button>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {summaries?.lesson_title || 'Результаты урока'}
      </h1>

      {detail ? (
        <StudentDetailView detail={detail} />
      ) : summaries ? (
        <StudentListView summaries={summaries} onSelectStudent={loadStudentDetail} />
      ) : null}
    </div>
  );
}

function StudentListView({
  summaries,
  onSelectStudent,
}: {
  summaries: LessonStudentResultsResponse;
  onSelectStudent: (id: number) => void;
}) {
  if (summaries.students.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Пока никто не выполнял упражнения в этом уроке
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ученик</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Результат</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Выполнено</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Последняя активность</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {summaries.students.map((s: StudentLessonSummary) => (
            <tr key={s.student_id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800 font-medium">{s.student_name}</td>
              <td className="px-4 py-3 text-center">
                {s.total > 0 ? (
                  <span className={`font-semibold ${s.score === s.total ? 'text-green-600' : s.score > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {s.score}/{s.total}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {s.answered}/{s.total_blocks}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-500">
                {s.last_activity ? new Date(s.last_activity).toLocaleDateString('ru-RU', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                }) : '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onSelectStudent(s.student_id)}
                  className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                >
                  Подробнее
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentDetailView({ detail }: { detail: StudentLessonDetailResponse }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{detail.student_name}</h2>
          <p className="text-sm text-gray-500">
            Результат: <span className="font-medium">{detail.score}/{detail.total}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {detail.blocks.map((block, idx) => (
          <BlockResultCard key={block.block_id} block={block} index={idx + 1} />
        ))}
      </div>
    </div>
  );
}

function BlockResultCard({ block, index }: { block: StudentBlockResult; index: number }) {
  const hasAnswer = block.answer !== null && block.answer !== undefined;
  const borderColor = !hasAnswer ? 'border-gray-200' : block.is_correct === null ? 'border-blue-200' : block.is_correct ? 'border-green-300' : 'border-red-300';
  const bgColor = !hasAnswer ? 'bg-gray-50' : block.is_correct === null ? 'bg-blue-50' : block.is_correct ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <div className={`px-4 py-2 ${bgColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">#{index}</span>
          <span className="text-sm text-gray-500">{blockTypeLabel(block.block_type)}</span>
          {block.block_title && <span className="text-sm text-gray-700">— {block.block_title}</span>}
        </div>
        {hasAnswer && (
          <span className={`text-sm font-medium ${block.is_correct === null ? 'text-blue-600' : block.is_correct ? 'text-green-600' : 'text-red-600'}`}>
            {block.is_correct === null ? 'Отправлено' : block.is_correct ? 'Верно' : 'Неверно'}
          </span>
        )}
        {!hasAnswer && <span className="text-sm text-gray-400">Не отвечено</span>}
      </div>

      <div className="px-4 py-3 bg-white">
        {renderBlockAnswer(block)}
      </div>
    </div>
  );
}

function renderBlockAnswer(block: StudentBlockResult) {
  const content = block.block_content;
  const answer = block.answer;

  switch (block.block_type) {
    case 'fill_gaps':
      return <FillGapsResult content={content} answer={answer} />;
    case 'test':
      return <TestResult content={content} answer={answer} />;
    case 'true_false':
      return <TrueFalseResult content={content} answer={answer} />;
    case 'word_order':
      return <WordOrderResult content={content} answer={answer} />;
    case 'matching':
      return <MatchingResult content={content} answer={answer} />;
    case 'image_choice':
      return <ImageChoiceResult content={content} answer={answer} />;
    case 'essay':
      return <EssayResult answer={answer} />;
    default:
      return <div className="text-gray-400 text-sm">Тип блока: {block.block_type}</div>;
  }
}

function FillGapsResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const text = (content.text as string) || '';
  const gaps = (content.gaps as Array<{ index: number; answer: string; alternatives?: string[] }>) || [];
  const userAnswers = (answer || {}) as Record<string | number, string>;

  const parts = text.split(/\{(\d+)\}/);

  return (
    <div className="text-gray-800 leading-relaxed">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        const gapIdx = parseInt(part);
        const gap = gaps.find(g => g.index === gapIdx);
        const userAnswer = (userAnswers[gapIdx] || userAnswers[String(gapIdx)] || '').toString();
        const correct = gap?.answer || '';
        const alternatives = gap?.alternatives?.map(a => a.toLowerCase().trim()) || [];
        const isCorrect = userAnswer.toLowerCase().trim() === correct.toLowerCase().trim() || alternatives.includes(userAnswer.toLowerCase().trim());

        return (
          <span key={i} className={`inline-block px-2 py-0.5 mx-0.5 rounded font-medium ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {userAnswer || '—'}
            {!isCorrect && <span className="text-green-600 ml-1 text-xs">({correct})</span>}
          </span>
        );
      })}
    </div>
  );
}

function TestResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const question = (content.question as string) || '';
  const options = (content.options as Array<{ id: string; text: string; is_correct: boolean }>) || [];
  const selected = Array.isArray(answer) ? answer.map(String) : answer ? [String(answer)] : [];

  return (
    <div>
      <p className="text-gray-800 mb-2 font-medium">{question}</p>
      <div className="space-y-1">
        {options.map(opt => {
          const isSelected = selected.includes(opt.id);
          const bg = isSelected && opt.is_correct ? 'bg-green-100' : isSelected && !opt.is_correct ? 'bg-red-100' : !isSelected && opt.is_correct ? 'bg-green-50 border border-green-200' : '';
          return (
            <div key={opt.id} className={`flex items-center gap-2 px-3 py-1.5 rounded ${bg}`}>
              {isSelected ? (
                opt.is_correct ? <CheckIcon className="text-green-600" /> : <XIcon className="text-red-600" />
              ) : opt.is_correct ? (
                <CheckIcon className="text-green-400" />
              ) : (
                <span className="w-4 h-4" />
              )}
              <span className="text-sm text-gray-700">{opt.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrueFalseResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const statement = (content.statement as string) || '';
  const isTrue = content.is_true as boolean;
  const userAnswer = answer as boolean | undefined;
  const isCorrect = userAnswer === isTrue;

  return (
    <div>
      <p className="text-gray-800 mb-2">{statement}</p>
      {userAnswer !== undefined && userAnswer !== null ? (
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-sm font-medium ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {userAnswer ? 'Верно' : 'Неверно'}
          </span>
          {!isCorrect && (
            <span className="text-sm text-green-600">Правильный ответ: {isTrue ? 'Верно' : 'Неверно'}</span>
          )}
        </div>
      ) : (
        <span className="text-gray-400 text-sm">Нет ответа</span>
      )}
    </div>
  );
}

function WordOrderResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const correct = (content.correct_sentence as string) || '';
  const words = Array.isArray(answer) ? answer : [];
  const userSentence = words.join(' ');
  const isCorrect = userSentence === correct;

  return (
    <div>
      <div className="mb-2">
        <span className="text-sm text-gray-500">Ответ ученика: </span>
        <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>{userSentence || '—'}</span>
      </div>
      {!isCorrect && (
        <div>
          <span className="text-sm text-gray-500">Правильный ответ: </span>
          <span className="text-green-600 font-medium">{correct}</span>
        </div>
      )}
    </div>
  );
}

function MatchingResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const pairs = (content.pairs as Array<{ left: string; right: string }>) || [];
  const userMatches = (answer || {}) as Record<string, string>;

  return (
    <div className="space-y-1">
      {pairs.map((pair, i) => {
        const userRight = userMatches[pair.left] || '';
        const isCorrect = userRight === pair.right;
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-gray-700 font-medium min-w-[120px]">{pair.left}</span>
            <span className="text-gray-400">→</span>
            <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>{userRight || '—'}</span>
            {!isCorrect && <span className="text-green-600 text-xs">({pair.right})</span>}
          </div>
        );
      })}
    </div>
  );
}

function ImageChoiceResult({ content, answer }: { content: Record<string, unknown>; answer: unknown }) {
  const question = (content.question as string) || '';
  const options = (content.options as Array<{ id: string; url: string; caption?: string; is_correct: boolean }>) || [];
  const selectedId = answer ? String(answer) : null;

  return (
    <div>
      <p className="text-gray-800 mb-2">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = opt.id === selectedId;
          const border = isSelected && opt.is_correct ? 'border-green-500 ring-2 ring-green-200' : isSelected && !opt.is_correct ? 'border-red-500 ring-2 ring-red-200' : !isSelected && opt.is_correct ? 'border-green-300' : 'border-gray-200';
          return (
            <div key={opt.id} className={`border-2 ${border} rounded-lg overflow-hidden w-24 h-24`}>
              <img src={opt.url} alt={opt.caption || ''} className="w-full h-full object-cover" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EssayResult({ answer }: { answer: unknown }) {
  const text = (answer as string) || '';
  return (
    <div>
      {text ? (
        <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
      ) : (
        <span className="text-gray-400 text-sm">Нет ответа</span>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fill_gaps: 'Заполнить пропуски',
    test: 'Тест',
    true_false: 'Верно/Неверно',
    word_order: 'Порядок слов',
    matching: 'Сопоставление',
    image_choice: 'Выбор изображения',
    essay: 'Эссе',
    flashcards: 'Карточки',
  };
  return labels[type] || type;
}
