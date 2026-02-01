import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseApi } from '../services/courseApi';
import { useAuthStore } from '../store/authStore';
import type { Course } from '../types/course';

export default function CoursesPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'teacher';

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await courseApi.list({ search: search || undefined });
      setCourses(response.items);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCourses();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;

    try {
      setCreating(true);
      const course = await courseApi.create({
        title: newCourse.title.trim(),
        description: newCourse.description.trim() || undefined,
      });
      navigate(`/courses/${course.id}/edit`);
    } catch (error) {
      console.error('Failed to create course:', error);
      alert('Ошибка при создании курса');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (courseId: number) => {
    if (!confirm('Удалить курс? Это действие нельзя отменить.')) return;

    try {
      await courseApi.delete(courseId);
      setCourses(courses.filter(c => c.id !== courseId));
    } catch (error) {
      console.error('Failed to delete course:', error);
      alert('Ошибка при удалении курса');
    }
  };

  const canEditCourse = (course: Course) => {
    if (user?.role === 'admin' || user?.role === 'manager') return true;
    if (user?.role === 'teacher' && course.created_by_id === user.id) return true;
    return false;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Курсы</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Создать курс
          </button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск курсов..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Найти
          </button>
        </div>
      </form>

      {/* Courses Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? 'Курсы не найдены' : 'Нет доступных курсов'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-purple-500 to-cyan-500 relative">
                {course.cover_url && (
                  <img
                    src={course.cover_url}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {!course.is_published && (
                  <span className="absolute top-2 right-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                    Черновик
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-1">{course.title}</h3>
                {course.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {course.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span>{course.sections_count} секций</span>
                  <span>{course.lessons_count} уроков</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {user?.role === 'student' ? (
                    <button
                      onClick={() => navigate(`/courses/${course.id}`)}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Открыть
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate(`/courses/${course.id}`)}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Просмотр
                      </button>
                      {canEditCourse(course) && (
                        <>
                          <button
                            onClick={() => navigate(`/courses/${course.id}/edit`)}
                            className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => handleDelete(course.id)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 text-sm rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Создать курс</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Введите название курса"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Краткое описание курса"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCourse({ title: '', description: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCourse.title.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
