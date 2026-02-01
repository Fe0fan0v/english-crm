import axios from 'axios';
import type {
  Course,
  CourseCreate,
  CourseDetail,
  CourseListResponse,
  CourseUpdate,
  CourseSection,
  CourseSectionCreate,
  CourseSectionUpdate,
  InteractiveLesson,
  InteractiveLessonCreate,
  InteractiveLessonDetail,
  InteractiveLessonUpdate,
  ExerciseBlock,
  ExerciseBlockCreate,
  ExerciseBlockUpdate,
  ReorderItem,
} from '../types/course';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth-storage');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============== Courses ==============

export const courseApi = {
  // List courses
  list: async (params?: { skip?: number; limit?: number; search?: string }): Promise<CourseListResponse> => {
    const response = await api.get<CourseListResponse>('/courses', { params });
    return response.data;
  },

  // Get course details
  get: async (courseId: number): Promise<CourseDetail> => {
    const response = await api.get<CourseDetail>(`/courses/${courseId}`);
    return response.data;
  },

  // Create course
  create: async (data: CourseCreate): Promise<Course> => {
    const response = await api.post<Course>('/courses', data);
    return response.data;
  },

  // Update course
  update: async (courseId: number, data: CourseUpdate): Promise<Course> => {
    const response = await api.put<Course>(`/courses/${courseId}`, data);
    return response.data;
  },

  // Delete course
  delete: async (courseId: number): Promise<void> => {
    await api.delete(`/courses/${courseId}`);
  },
};

// ============== Sections ==============

export const sectionApi = {
  // Create section
  create: async (courseId: number, data: CourseSectionCreate): Promise<CourseSection> => {
    const response = await api.post<CourseSection>(`/courses/${courseId}/sections`, data);
    return response.data;
  },

  // Update section
  update: async (sectionId: number, data: CourseSectionUpdate): Promise<CourseSection> => {
    const response = await api.put<CourseSection>(`/courses/sections/${sectionId}`, data);
    return response.data;
  },

  // Delete section
  delete: async (sectionId: number): Promise<void> => {
    await api.delete(`/courses/sections/${sectionId}`);
  },

  // Reorder sections
  reorder: async (courseId: number, items: ReorderItem[]): Promise<void> => {
    await api.post(`/courses/${courseId}/sections/reorder`, { items });
  },
};

// ============== Lessons ==============

export const interactiveLessonApi = {
  // Create lesson
  create: async (sectionId: number, data: InteractiveLessonCreate): Promise<InteractiveLesson> => {
    const response = await api.post<InteractiveLesson>(`/courses/sections/${sectionId}/lessons`, data);
    return response.data;
  },

  // Get lesson details
  get: async (lessonId: number): Promise<InteractiveLessonDetail> => {
    const response = await api.get<InteractiveLessonDetail>(`/courses/lessons/${lessonId}`);
    return response.data;
  },

  // Update lesson
  update: async (lessonId: number, data: InteractiveLessonUpdate): Promise<InteractiveLesson> => {
    const response = await api.put<InteractiveLesson>(`/courses/lessons/${lessonId}`, data);
    return response.data;
  },

  // Delete lesson
  delete: async (lessonId: number): Promise<void> => {
    await api.delete(`/courses/lessons/${lessonId}`);
  },

  // Reorder lessons
  reorder: async (sectionId: number, items: ReorderItem[]): Promise<void> => {
    await api.post(`/courses/sections/${sectionId}/lessons/reorder`, { items });
  },
};

// ============== Blocks ==============

export const blockApi = {
  // Create block
  create: async (lessonId: number, data: ExerciseBlockCreate): Promise<ExerciseBlock> => {
    const response = await api.post<ExerciseBlock>(`/courses/lessons/${lessonId}/blocks`, data);
    return response.data;
  },

  // Update block
  update: async (blockId: number, data: ExerciseBlockUpdate): Promise<ExerciseBlock> => {
    const response = await api.put<ExerciseBlock>(`/courses/blocks/${blockId}`, data);
    return response.data;
  },

  // Delete block
  delete: async (blockId: number): Promise<void> => {
    await api.delete(`/courses/blocks/${blockId}`);
  },

  // Reorder blocks
  reorder: async (lessonId: number, items: ReorderItem[]): Promise<void> => {
    await api.post(`/courses/lessons/${lessonId}/blocks/reorder`, { items });
  },
};
