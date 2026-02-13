import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseApi, sectionApi, interactiveLessonApi } from '../services/courseApi';
import { useAuthStore } from '../store/authStore';
import type { CourseDetail, CourseSectionDetail, InteractiveLesson } from '../types/course';

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Only admin and teacher can view courses; students are redirected
  useEffect(() => {
    if (user && user.role === 'student') {
      navigate('/courses');
    }
  }, [user, navigate]);

  const isReadOnly = user?.role !== 'admin';
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const expandAll = () => {
    if (course) {
      setExpandedSections(new Set(course.sections.map(s => s.id)));
    }
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Section modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSectionDetail | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });

  // Lesson modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonSectionId, setLessonSectionId] = useState<number | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', description: '' });

  useEffect(() => {
    if (id) loadCourse();
  }, [id]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const data = await courseApi.get(Number(id));
      setCourse(data);
      setNewTitle(data.title);
      setNewDescription(data.description || '');
    } catch (error) {
      console.error('Failed to load course:', error);
      alert('Не удалось загрузить курс');
      navigate('/courses');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTitle = async () => {
    if (!course || !newTitle.trim()) return;
    try {
      setSaving(true);
      await courseApi.update(course.id, { title: newTitle.trim() });
      setCourse({ ...course, title: newTitle.trim() });
      setEditingTitle(false);
    } catch (error) {
      console.error('Failed to update title:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDescription = async () => {
    if (!course) return;
    try {
      setSaving(true);
      await courseApi.update(course.id, { description: newDescription.trim() || null });
      setCourse({ ...course, description: newDescription.trim() || null });
      setEditingDescription(false);
    } catch (error) {
      console.error('Failed to update description:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async () => {
    if (!course) return;
    try {
      setSaving(true);
      await courseApi.update(course.id, { is_published: !course.is_published });
      setCourse({ ...course, is_published: !course.is_published });
    } catch (error) {
      console.error('Failed to toggle published:', error);
    } finally {
      setSaving(false);
    }
  };

  // Section handlers
  const handleSaveSection = async () => {
    if (!course || !sectionForm.title.trim()) return;
    try {
      setSaving(true);
      if (editingSection) {
        const updated = await sectionApi.update(editingSection.id, {
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
        });
        setCourse({
          ...course,
          sections: course.sections.map(s =>
            s.id === updated.id ? { ...s, title: updated.title, description: updated.description } : s
          ),
        });
      } else {
        const created = await sectionApi.create(course.id, {
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
        });
        setCourse({
          ...course,
          sections: [...course.sections, { ...created, lessons: [] }],
        });
      }
      setShowSectionModal(false);
      setEditingSection(null);
      setSectionForm({ title: '', description: '' });
    } catch (error) {
      console.error('Failed to save section:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!course || !confirm('Удалить секцию со всеми уроками?')) return;
    try {
      await sectionApi.delete(sectionId);
      setCourse({
        ...course,
        sections: course.sections.filter(s => s.id !== sectionId),
      });
    } catch (error) {
      console.error('Failed to delete section:', error);
    }
  };

  // Lesson handlers
  const handleSaveLesson = async () => {
    if (!course || !lessonSectionId || !lessonForm.title.trim()) return;
    try {
      setSaving(true);
      const created = await interactiveLessonApi.create(lessonSectionId, {
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim() || null,
      });
      setCourse({
        ...course,
        sections: course.sections.map(s =>
          s.id === lessonSectionId
            ? { ...s, lessons: [...s.lessons, created] }
            : s
        ),
      });
      setShowLessonModal(false);
      setLessonSectionId(null);
      setLessonForm({ title: '', description: '' });
    } catch (error) {
      console.error('Failed to create lesson:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (sectionId: number, lessonId: number) => {
    if (!course || !confirm('Удалить урок?')) return;
    try {
      await interactiveLessonApi.delete(lessonId);
      setCourse({
        ...course,
        sections: course.sections.map(s =>
          s.id === sectionId
            ? { ...s, lessons: s.lessons.filter(l => l.id !== lessonId) }
            : s
        ),
      });
    } catch (error) {
      console.error('Failed to delete lesson:', error);
    }
  };

  const handleToggleLessonPublished = async (lesson: InteractiveLesson) => {
    if (!course) return;
    try {
      await interactiveLessonApi.update(lesson.id, { is_published: !lesson.is_published });
      setCourse({
        ...course,
        sections: course.sections.map(s => ({
          ...s,
          lessons: s.lessons.map(l =>
            l.id === lesson.id ? { ...l, is_published: !l.is_published } : l
          ),
        })),
      });
    } catch (error) {
      console.error('Failed to toggle lesson published:', error);
    }
  };

  const handleMoveLesson = async (sectionId: number, lessonIndex: number, direction: 'up' | 'down') => {
    if (!course) return;
    const section = course.sections.find(s => s.id === sectionId);
    if (!section) return;

    const lessons = [...section.lessons];
    if (direction === 'up' && lessonIndex === 0) return;
    if (direction === 'down' && lessonIndex === lessons.length - 1) return;

    const swapIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
    [lessons[lessonIndex], lessons[swapIndex]] = [lessons[swapIndex], lessons[lessonIndex]];

    // Update positions
    const reorderItems = lessons.map((l, i) => ({ id: l.id, position: i }));
    try {
      await interactiveLessonApi.reorder(sectionId, reorderItems);
      setCourse({
        ...course,
        sections: course.sections.map(s =>
          s.id === sectionId
            ? { ...s, lessons: lessons.map((l, i) => ({ ...l, position: i })) }
            : s
        ),
      });
    } catch (error) {
      console.error('Failed to reorder lessons:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-12 text-gray-500">Курс не найден</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/courses')}
          className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к курсам
        </button>

        {/* Title */}
        {!isReadOnly && editingTitle ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="text-2xl font-bold text-gray-800 border border-gray-200 rounded px-2 py-1 flex-1"
              autoFocus
            />
            <button
              onClick={handleUpdateTitle}
              disabled={saving}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Сохранить
            </button>
            <button
              onClick={() => {
                setEditingTitle(false);
                setNewTitle(course.title);
              }}
              className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              Отмена
            </button>
          </div>
        ) : (
          <h1
            onClick={() => !isReadOnly && setEditingTitle(true)}
            className={`text-2xl font-bold text-gray-800 mb-2 ${!isReadOnly ? 'cursor-pointer hover:text-purple-600' : ''}`}
          >
            {course.title}
          </h1>
        )}

        {/* Description */}
        {!isReadOnly && editingDescription ? (
          <div className="flex items-start gap-2 mb-4">
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="flex-1 text-gray-600 border border-gray-200 rounded px-2 py-1"
              rows={2}
            />
            <button
              onClick={handleUpdateDescription}
              disabled={saving}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Сохранить
            </button>
            <button
              onClick={() => {
                setEditingDescription(false);
                setNewDescription(course.description || '');
              }}
              className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              Отмена
            </button>
          </div>
        ) : (
          <p
            onClick={() => !isReadOnly && setEditingDescription(true)}
            className={`text-gray-600 mb-4 ${!isReadOnly ? 'cursor-pointer hover:text-purple-600' : ''}`}
          >
            {course.description || (isReadOnly ? 'Нет описания' : 'Нажмите, чтобы добавить описание...')}
          </p>
        )}

        {/* Status */}
        <div className="flex items-center gap-4">
          {!isReadOnly ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={course.is_published}
                onChange={handleTogglePublished}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Опубликован</span>
            </label>
          ) : (
            <span className={`text-sm px-2 py-0.5 rounded ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {course.is_published ? 'Опубликован' : 'Черновик'}
            </span>
          )}
          <span className="text-sm text-gray-400">
            Автор: {course.created_by_name}
          </span>
        </div>
      </div>

      {/* Sections */}
      {course.sections.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={expandAll}
            className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
          >
            Развернуть всё
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
          >
            Свернуть всё
          </button>
        </div>
      )}
      <div className="space-y-4">
        {course.sections.map((section, sectionIndex) => (
          <div key={section.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Section Header */}
            <div
              className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-400 font-medium">{sectionIndex + 1}.</span>
                <h3 className="font-semibold text-gray-800">{section.title}</h3>
                {section.description && (
                  <span className="text-sm text-gray-500">- {section.description}</span>
                )}
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {section.lessons.length} {section.lessons.length === 1 ? 'урок' : section.lessons.length >= 2 && section.lessons.length <= 4 ? 'урока' : 'уроков'}
                </span>
              </div>
              {!isReadOnly && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setEditingSection(section);
                    setSectionForm({ title: section.title, description: section.description || '' });
                    setShowSectionModal(true);
                  }}
                  className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteSection(section.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              )}
            </div>

            {/* Lessons */}
            {expandedSections.has(section.id) && (
            <div className="p-2">
              {section.lessons.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  В этой секции пока нет уроков
                </p>
              ) : (
                <div className="space-y-1">
                  {section.lessons.map((lesson, lessonIndex) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">{sectionIndex + 1}.{lessonIndex + 1}</span>
                        <span className="text-gray-700">{lesson.title}</span>
                        {!lesson.is_published && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                            Черновик
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {lesson.blocks_count} блоков
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isReadOnly && (
                          <>
                            {/* Move up/down buttons */}
                            <button
                              onClick={() => handleMoveLesson(section.id, lessonIndex, 'up')}
                              disabled={lessonIndex === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Переместить вверх"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveLesson(section.id, lessonIndex, 'down')}
                              disabled={lessonIndex === section.lessons.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Переместить вниз"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <div className="w-px h-4 bg-gray-200 mx-1" />
                            <button
                              onClick={() => handleToggleLessonPublished(lesson)}
                              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                              title={lesson.is_published ? 'Снять с публикации' : 'Опубликовать'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/courses/lessons/${lesson.id}`)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Просмотр урока (как видит студент)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => navigate(`/courses/lessons/${lesson.id}/results`)}
                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Результаты учеников"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => navigate(`/courses/lessons/${lesson.id}/edit`)}
                              className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Редактировать урок"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(section.id, lesson.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Удалить урок"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Lesson Button */}
              {!isReadOnly && (
              <button
                onClick={() => {
                  setLessonSectionId(section.id);
                  setLessonForm({ title: '', description: '' });
                  setShowLessonModal(true);
                }}
                className="w-full mt-2 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Добавить урок
              </button>
              )}
            </div>
            )}
          </div>
        ))}

        {/* Add Section Button */}
        {!isReadOnly && (
        <button
          onClick={() => {
            setEditingSection(null);
            setSectionForm({ title: '', description: '' });
            setShowSectionModal(true);
          }}
          className="w-full py-4 text-purple-600 border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить секцию
        </button>
        )}
      </div>

      {/* Section Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingSection ? 'Редактировать секцию' : 'Новая секция'}
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={sectionForm.title}
                onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Название секции"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={2}
                placeholder="Краткое описание"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSectionModal(false);
                  setEditingSection(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveSection}
                disabled={saving || !sectionForm.title.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Новый урок</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Название урока"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={2}
                placeholder="Краткое описание"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setLessonSectionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveLesson}
                disabled={saving || !lessonForm.title.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
