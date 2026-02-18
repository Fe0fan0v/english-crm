import { useState, useEffect, useRef, useCallback } from 'react';
import { courseMaterialsApi } from '../services/api';
import type { CourseTreeItem, CourseMaterialType } from '../types';

const LAST_ATTACHED_KEY = 'lastAttachedMaterial';

interface LastAttachedPosition {
  courseId: number;
  sectionId: number;
  topicId: number;
  lessonId: number;
}

/** Get all lessons from a section (handles both topic-based and legacy flat structures) */
function getSectionLessons(section: CourseTreeItem): CourseTreeItem[] {
  if (section.children.length === 0) return [];
  if (section.children[0].type === 'lesson') return section.children;
  return section.children.flatMap(topic => topic.children);
}

/** Count lessons in a section (handles both structures) */
function countSectionLessons(section: CourseTreeItem): number {
  return getSectionLessons(section).length;
}

function findNextLesson(tree: CourseTreeItem[], last: LastAttachedPosition): number | null {
  for (let ci = 0; ci < tree.length; ci++) {
    const course = tree[ci];
    if (course.id !== last.courseId) continue;

    for (let si = 0; si < course.children.length; si++) {
      const section = course.children[si];
      if (section.id !== last.sectionId) continue;
      const isLegacy = section.children[0]?.type === 'lesson';

      if (isLegacy) {
        // Legacy: lessons directly under section
        const lessonIdx = section.children.findIndex(l => l.id === last.lessonId);
        if (lessonIdx === -1) continue;
        if (lessonIdx + 1 < section.children.length) {
          return section.children[lessonIdx + 1].id;
        }
        // First lesson in next section
        for (let nsi = si + 1; nsi < course.children.length; nsi++) {
          const nextLessons = getSectionLessons(course.children[nsi]);
          if (nextLessons.length > 0) return nextLessons[0].id;
        }
        return null;
      }

      for (let ti = 0; ti < section.children.length; ti++) {
        const topic = section.children[ti];
        if (topic.id !== last.topicId) continue;

        const lessonIdx = topic.children.findIndex(l => l.id === last.lessonId);
        if (lessonIdx === -1) continue;

        // Next lesson in same topic
        if (lessonIdx + 1 < topic.children.length) {
          return topic.children[lessonIdx + 1].id;
        }
        // First lesson in next topic of same section
        for (let nti = ti + 1; nti < section.children.length; nti++) {
          if (section.children[nti].children.length > 0) {
            return section.children[nti].children[0].id;
          }
        }
        // First lesson in next section of same course
        for (let nsi = si + 1; nsi < course.children.length; nsi++) {
          const nextLessons = getSectionLessons(course.children[nsi]);
          if (nextLessons.length > 0) return nextLessons[0].id;
        }
        return null;
      }
    }
  }
  return null;
}

function findLessonPosition(tree: CourseTreeItem[], lessonId: number): { courseId: number; sectionId: number; topicId: number } | null {
  for (const course of tree) {
    for (const section of course.children) {
      const isLegacy = section.children[0]?.type === 'lesson';
      if (isLegacy) {
        for (const lesson of section.children) {
          if (lesson.id === lessonId) {
            return { courseId: course.id, sectionId: section.id, topicId: section.id };
          }
        }
      } else {
        for (const topic of section.children) {
          for (const lesson of topic.children) {
            if (lesson.id === lessonId) {
              return { courseId: course.id, sectionId: section.id, topicId: topic.id };
            }
          }
        }
      }
    }
  }
  return null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lessonId: number;
  onAttached: () => void;
}

export default function AttachCourseMaterialModal({ isOpen, onClose, lessonId, onAttached }: Props) {
  const [tree, setTree] = useState<CourseTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedLessonId, setSuggestedLessonId] = useState<number | null>(null);
  const suggestedRef = useRef<HTMLDivElement>(null);

  const restoreLastPosition = useCallback((loadedTree: CourseTreeItem[]) => {
    try {
      const raw = localStorage.getItem(LAST_ATTACHED_KEY);
      if (!raw) return;
      const last: LastAttachedPosition = JSON.parse(raw);

      // Expand tree to the last position
      setExpandedCourses(prev => new Set([...prev, last.courseId]));
      setExpandedSections(prev => new Set([...prev, last.sectionId]));
      setExpandedTopics(prev => new Set([...prev, last.topicId]));

      // Find and suggest next lesson
      const nextId = findNextLesson(loadedTree, last);
      if (nextId) {
        const pos = findLessonPosition(loadedTree, nextId);
        if (pos) {
          setExpandedCourses(prev => new Set([...prev, pos.courseId]));
          setExpandedSections(prev => new Set([...prev, pos.sectionId]));
          setExpandedTopics(prev => new Set([...prev, pos.topicId]));
        }
        setSuggestedLessonId(nextId);
      }
    } catch {
      // ignore invalid localStorage data
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTree();
      setSearchQuery('');
      setSuggestedLessonId(null);
    }
  }, [isOpen]);

  // Auto-scroll to suggested lesson
  useEffect(() => {
    if (suggestedLessonId && suggestedRef.current) {
      setTimeout(() => {
        suggestedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [suggestedLessonId]);

  // Auto-expand all levels when searching, reset suggestion
  useEffect(() => {
    if (searchQuery) setSuggestedLessonId(null);
    if (!searchQuery) return;
    const courseIds = new Set<number>();
    const sectionIds = new Set<number>();
    const topicIds = new Set<number>();

    for (const course of tree) {
      for (const section of course.children) {
        if (section.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          courseIds.add(course.id);
        }
        const isLegacy = section.children[0]?.type === 'lesson';
        if (isLegacy) {
          for (const lesson of section.children) {
            if (lesson.title.toLowerCase().includes(searchQuery.toLowerCase())) {
              courseIds.add(course.id);
              sectionIds.add(section.id);
            }
          }
        } else {
          for (const topic of section.children) {
            if (topic.title.toLowerCase().includes(searchQuery.toLowerCase())) {
              courseIds.add(course.id);
              sectionIds.add(section.id);
            }
            for (const lesson of topic.children) {
              if (lesson.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                courseIds.add(course.id);
                sectionIds.add(section.id);
                topicIds.add(topic.id);
              }
            }
          }
        }
      }
    }

    setExpandedCourses(courseIds);
    setExpandedSections(sectionIds);
    setExpandedTopics(topicIds);
  }, [searchQuery, tree]);

  const loadTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await courseMaterialsApi.getCourseTree();
      setTree(data);
      setExpandedCourses(new Set(data.map(c => c.id)));
      restoreLastPosition(data);
    } catch (err) {
      setError('Failed to load courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async (type: CourseMaterialType, id: number, title?: string) => {
    // Warn when attaching course or section (not a specific lesson)
    if (type === 'course' || type === 'section') {
      const typeLabel = type === 'course' ? 'весь курс' : 'всю секцию';
      if (!confirm(`Прикрепить ${typeLabel} "${title}"?\nУченик получит доступ ко всем урокам внутри.\n\nЕсли нужен один урок — раскройте дерево и выберите конкретный урок.`)) {
        return;
      }
    }

    try {
      setAttaching(true);
      setError(null);

      if (type === 'course') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, id, undefined, undefined, undefined);
      } else if (type === 'section') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, id, undefined, undefined);
      } else if (type === 'topic') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, undefined, id, undefined);
      } else if (type === 'lesson') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, undefined, undefined, id);
      }

      // Save last attached lesson position for "next lesson" suggestion
      if (type === 'lesson') {
        const pos = findLessonPosition(tree, id);
        if (pos) {
          localStorage.setItem(LAST_ATTACHED_KEY, JSON.stringify({
            ...pos,
            lessonId: id,
          }));
        }
      }

      onAttached();
      onClose();
    } catch (err: unknown) {
      console.error('Error:', err);
      let errorMessage = 'Не удалось прикрепить материал';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { detail?: string }, status?: number } };
        errorMessage = axiosError.response?.data?.detail || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setAttaching(false);
    }
  };

  const toggleCourse = (courseId: number) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) newExpanded.delete(courseId);
    else newExpanded.add(courseId);
    setExpandedCourses(newExpanded);
  };

  const toggleSection = (sectionId: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) newExpanded.delete(sectionId);
    else newExpanded.add(sectionId);
    setExpandedSections(newExpanded);
  };

  const toggleTopic = (topicId: number) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) newExpanded.delete(topicId);
    else newExpanded.add(topicId);
    setExpandedTopics(newExpanded);
  };

  // Filter tree based on search query
  const filterTree = (items: CourseTreeItem[], query: string): CourseTreeItem[] => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();

    return items.reduce<CourseTreeItem[]>((acc, item) => {
      const matchesTitle = item.title.toLowerCase().includes(lowerQuery);
      const filteredChildren = filterTree(item.children, query);

      if (matchesTitle || filteredChildren.length > 0) {
        acc.push({
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
        });
      }
      return acc;
    }, []);
  };

  const filteredTree = filterTree(tree, searchQuery);

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  if (!isOpen) return null;

  const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Прикрепить материал из курса</h2>
            <p className="text-sm text-gray-500 mt-1">
              Найдите нужный урок через поиск или раскройте дерево
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Поиск по названию урока (например: 1A, Warm up, Listening)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'Ничего не найдено' : 'Нет опубликованных курсов'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTree.map((course) => (
                <div key={course.id} className="border rounded-lg">
                  {/* Course level */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg">
                    <button
                      onClick={() => toggleCourse(course.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      <ChevronIcon expanded={expandedCourses.has(course.id)} />
                      <span className="font-medium truncate">{highlightMatch(course.title, searchQuery)}</span>
                    </button>
                    <button
                      onClick={() => handleAttach('course', course.id, course.title)}
                      disabled={attaching}
                      className="ml-2 text-xs px-2 py-1 text-gray-500 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 flex-shrink-0"
                      title="Прикрепить весь курс"
                    >
                      Весь курс
                    </button>
                  </div>

                  {/* Sections */}
                  {expandedCourses.has(course.id) && course.children.length > 0 && (
                    <div className="border-t">
                      {course.children.map((section) => (
                        <div key={section.id} className="ml-4 border-l">
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50">
                            <button
                              onClick={() => toggleSection(section.id)}
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                            >
                              <ChevronIcon expanded={expandedSections.has(section.id)} />
                              <span className="font-medium text-sm truncate">{highlightMatch(section.title, searchQuery)}</span>
                              <span className="text-xs text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                {section.children.length > 0
                                  ? `${countSectionLessons(section)} ур.`
                                  : ''
                                }
                              </span>
                            </button>
                            <button
                              onClick={() => handleAttach('section', section.id, section.title)}
                              disabled={attaching}
                              className="ml-2 text-xs px-2 py-1 text-gray-500 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 flex-shrink-0"
                              title="Прикрепить всю секцию"
                            >
                              Вся секция
                            </button>
                          </div>

                          {/* Topics or direct lessons (legacy) */}
                          {expandedSections.has(section.id) && section.children.length > 0 && (
                            <div className="ml-4 border-l">
                              {section.children[0]?.type === 'lesson' ? (
                                /* Legacy: lessons directly under section */
                                section.children.map((lesson) => {
                                  const isSuggested = lesson.id === suggestedLessonId && !searchQuery;
                                  return (
                                    <div
                                      key={lesson.id}
                                      ref={isSuggested ? suggestedRef : undefined}
                                      className={`flex items-center justify-between p-2 group ${
                                        isSuggested
                                          ? 'bg-blue-50 ring-2 ring-blue-300 rounded-md'
                                          : 'hover:bg-green-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <span className="text-sm truncate">{highlightMatch(lesson.title, searchQuery)}</span>
                                        {isSuggested && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                            Следующий
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleAttach('lesson', lesson.id)}
                                        disabled={attaching}
                                        className="ml-2 text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex-shrink-0 font-medium"
                                      >
                                        Добавить
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                /* New structure: topics with lessons */
                                section.children.map((topic) => (
                                <div key={topic.id}>
                                  <div className="flex items-center justify-between p-2 hover:bg-gray-50">
                                    <button
                                      onClick={() => toggleTopic(topic.id)}
                                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                                    >
                                      <ChevronIcon expanded={expandedTopics.has(topic.id)} />
                                      <span className="text-sm truncate">{highlightMatch(topic.title, searchQuery)}</span>
                                      <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                        {topic.children.length} ур.
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => handleAttach('topic', topic.id, topic.title)}
                                      disabled={attaching}
                                      className="ml-2 text-xs px-2 py-1 text-gray-500 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 flex-shrink-0"
                                      title="Прикрепить весь топик"
                                    >
                                      Топик
                                    </button>
                                  </div>

                                  {/* Lessons — primary selection target */}
                                  {expandedTopics.has(topic.id) && topic.children.length > 0 && (
                                    <div className="ml-4 border-l">
                                      {topic.children.map((lesson) => {
                                        const isSuggested = lesson.id === suggestedLessonId && !searchQuery;
                                        return (
                                        <div
                                          key={lesson.id}
                                          ref={isSuggested ? suggestedRef : undefined}
                                          className={`flex items-center justify-between p-2 group ${
                                            isSuggested
                                              ? 'bg-blue-50 ring-2 ring-blue-300 rounded-md'
                                              : 'hover:bg-green-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                            <span className="text-sm truncate">{highlightMatch(lesson.title, searchQuery)}</span>
                                            {isSuggested && (
                                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                                Следующий
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => handleAttach('lesson', lesson.id)}
                                            disabled={attaching}
                                            className="ml-2 text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex-shrink-0 font-medium"
                                          >
                                            Добавить
                                          </button>
                                        </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
