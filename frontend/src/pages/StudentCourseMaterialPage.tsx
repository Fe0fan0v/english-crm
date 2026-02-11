import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { courseMaterialsApi } from "../services/api";
import type { StudentCourseMaterialView } from "../types";

export default function StudentCourseMaterialPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentCourseMaterialView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!materialId) return;
    setLoading(true);
    courseMaterialsApi
      .getStudentMaterialView(Number(materialId))
      .then((res) => {
        if (res.material_type === "lesson" && res.interactive_lesson_id) {
          navigate(`/courses/lessons/${res.interactive_lesson_id}`, { replace: true });
          return;
        }
        setData(res);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Не удалось загрузить материал");
      })
      .finally(() => setLoading(false));
  }, [materialId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Загрузка...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const breadcrumb: string[] = [];
  if (data.course_title) breadcrumb.push(data.course_title);
  if (data.section_title && data.material_type !== "section") breadcrumb.push(data.section_title);
  if (data.topic_title) breadcrumb.push(data.topic_title);

  const title =
    data.material_type === "course"
      ? data.course_title
      : data.material_type === "section"
        ? data.section_title
        : data.topic_title;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        {breadcrumb.length > 1 && (
          <p className="text-sm text-gray-400 mb-1">{breadcrumb.join(" / ")}</p>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Sections */}
      {data.sections.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Нет доступных уроков</div>
      ) : (
        <div className="space-y-6">
          {data.sections.map((section) => (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Show section header only when there are multiple sections */}
              {data.sections.length > 1 && (
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">{section.title}</h2>
                  {section.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {section.topics.map((topic) => (
                  <div key={topic.id} className="px-5 py-4">
                    {/* Show topic header when there are multiple topics */}
                    {section.topics.length > 1 && (
                      <h3 className="font-medium text-gray-700 mb-3">{topic.title}</h3>
                    )}
                    <div className="grid gap-2">
                      {topic.lessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          to={`/courses/lessons/${lesson.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200">
                            {lesson.is_homework ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 truncate">
                              {lesson.title}
                            </p>
                            {lesson.is_homework && (
                              <span className="text-xs text-orange-500">Домашнее задание</span>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
