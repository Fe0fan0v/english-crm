import { useState, useEffect } from 'react';
import { courseMaterialsApi } from '../services/api';
import type { CourseTreeItem, CourseMaterialType } from '../types';

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

  useEffect(() => {
    if (isOpen) {
      loadTree();
    }
  }, [isOpen]);

  const loadTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await courseMaterialsApi.getCourseTree();
      setTree(data);
      // Expand all courses by default
      setExpandedCourses(new Set(data.map(c => c.id)));
    } catch (err) {
      setError('Failed to load courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async (type: CourseMaterialType, id: number) => {
    try {
      setAttaching(true);
      setError(null);

      console.log(`Attaching: type=${type}, id=${id}, lessonId=${lessonId}`);

      if (type === 'course') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, id, undefined, undefined, undefined);
      } else if (type === 'section') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, id, undefined, undefined);
      } else if (type === 'topic') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, undefined, id, undefined);
      } else if (type === 'lesson') {
        await courseMaterialsApi.attachCourseMaterial(lessonId, type, undefined, undefined, undefined, id);
      }

      onAttached();
      onClose();
    } catch (err: unknown) {
      console.error('Error:', err);

      let errorMessage = 'Не удалось прикрепить материал';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { detail?: string }, status?: number } };
        errorMessage = axiosError.response?.data?.detail || errorMessage;
        console.error('Server response:', axiosError.response?.data);
        console.error('Status:', axiosError.response?.status);
      }

      setError(errorMessage);
    } finally {
      setAttaching(false);
    }
  };

  const toggleCourse = (courseId: number) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const toggleSection = (sectionId: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleTopic = (topicId: number) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Прикрепить материал из курса</h2>
            <p className="text-sm text-gray-500 mt-1">
              Выберите курс, секцию или урок
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
            placeholder="Поиск курсов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              {searchQuery ? 'Курсы не найдены' : 'Нет опубликованных курсов'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTree.map((course) => (
                <div key={course.id} className="border rounded-lg">
                  {/* Course level */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCourse(course.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedCourses.has(course.id) ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-medium">{course.title}</span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Курс</span>
                    </div>
                    <button
                      onClick={() => handleAttach('course', course.id)}
                      disabled={attaching}
                      className="text-sm px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                    >
                      Добавить
                    </button>
                  </div>

                  {/* Sections */}
                  {expandedCourses.has(course.id) && course.children.length > 0 && (
                    <div className="border-t">
                      {course.children.map((section) => (
                        <div key={section.id} className="ml-4 border-l">
                          {/* Section level */}
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleSection(section.id)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {expandedSections.has(section.id) ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                              <span className="font-medium text-sm">{section.title}</span>
                              <span className="text-xs text-gray-500 bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">Секция</span>
                            </div>
                            <button
                              onClick={() => handleAttach('section', section.id)}
                              disabled={attaching}
                              className="text-sm px-3 py-1 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
                            >
                              Добавить
                            </button>
                          </div>

                          {/* Topics */}
                          {expandedSections.has(section.id) && section.children.length > 0 && (
                            <div className="ml-4 border-l">
                              {section.children.map((topic) => (
                                <div key={topic.id}>
                                  {/* Topic level */}
                                  <div className="flex items-center justify-between p-2 hover:bg-gray-50">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleTopic(topic.id)}
                                        className="text-gray-500 hover:text-gray-700"
                                      >
                                        {expandedTopics.has(topic.id) ? (
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        )}
                                      </button>
                                      <span className="font-medium text-sm">{topic.title}</span>
                                      <span className="text-xs text-gray-500 bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Топик</span>
                                    </div>
                                    <button
                                      onClick={() => handleAttach('topic', topic.id)}
                                      disabled={attaching}
                                      className="text-sm px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                                    >
                                      Добавить
                                    </button>
                                  </div>

                                  {/* Lessons */}
                                  {expandedTopics.has(topic.id) && topic.children.length > 0 && (
                                    <div className="ml-4 border-l">
                                      {topic.children.map((lesson) => (
                                        <div
                                          key={lesson.id}
                                          className="flex items-center justify-between p-2 hover:bg-gray-50"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="w-4"></span>
                                            <span className="text-sm">{lesson.title}</span>
                                            <span className="text-xs text-gray-500 bg-green-100 text-green-700 px-2 py-0.5 rounded">Урок</span>
                                          </div>
                                          <button
                                            onClick={() => handleAttach('lesson', lesson.id)}
                                            disabled={attaching}
                                            className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                          >
                                            Добавить
                                          </button>
                                        </div>
                                      ))}
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
