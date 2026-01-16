import axios from "axios";
import type {
  LoginRequest,
  TokenResponse,
  User,
  UserListResponse,
  LessonType,
  LessonTypeListResponse,
  Level,
  LevelListResponse,
  Material,
  MaterialListResponse,
  Test,
  TestListResponse,
  TeacherReportResponse,
  DashboardResponse,
  ScheduleLesson,
  Group,
  GroupDetail,
  GroupListResponse,
  BalanceChange,
  TransactionListResponse,
  UserGroup,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  console.log(
    "API Request:",
    config.url,
    "Token:",
    token ? "present" : "missing",
  );
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors (removed automatic 401 redirect to prevent loops)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>("/auth/login", data);
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>("/auth/me");
    return response.data;
  },
};

// Users
export const usersApi = {
  list: async (
    page = 1,
    size = 20,
    search?: string,
  ): Promise<UserListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (search) params.append("search", search);
    const response = await api.get<UserListResponse>(`/users?${params}`);
    return response.data;
  },

  get: async (id: number): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: Partial<User> & { password: string }): Promise<User> => {
    const response = await api.post<User>("/users", data);
    return response.data;
  },

  update: async (id: number, data: Partial<User>): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  changeBalance: async (id: number, data: BalanceChange): Promise<User> => {
    const response = await api.post<User>(`/users/${id}/balance`, data);
    return response.data;
  },

  getTransactions: async (
    id: number,
    page = 1,
    size = 20,
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    const response = await api.get<TransactionListResponse>(
      `/users/${id}/transactions?${params}`,
    );
    return response.data;
  },

  getGroups: async (id: number): Promise<UserGroup[]> => {
    const response = await api.get<UserGroup[]>(`/users/${id}/groups`);
    return response.data;
  },
};

// Groups
export const groupsApi = {
  list: async (
    page = 1,
    size = 20,
    search?: string,
    teacherId?: number,
  ): Promise<GroupListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (search) params.append("search", search);
    if (teacherId) params.append("teacher_id", String(teacherId));
    const response = await api.get<GroupListResponse>(`/groups?${params}`);
    return response.data;
  },

  get: async (id: number): Promise<GroupDetail> => {
    const response = await api.get<GroupDetail>(`/groups/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    teacher_id?: number;
  }): Promise<Group> => {
    const response = await api.post<Group>("/groups", data);
    return response.data;
  },

  update: async (
    id: number,
    data: { name?: string; description?: string; teacher_id?: number | null },
  ): Promise<Group> => {
    const response = await api.put<Group>(`/groups/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/groups/${id}`);
  },

  addStudents: async (id: number, studentIds: number[]): Promise<GroupDetail> => {
    const response = await api.post<GroupDetail>(`/groups/${id}/students`, {
      student_ids: studentIds,
    });
    return response.data;
  },

  removeStudents: async (
    id: number,
    studentIds: number[],
  ): Promise<GroupDetail> => {
    const response = await api.delete<GroupDetail>(`/groups/${id}/students`, {
      data: { student_ids: studentIds },
    });
    return response.data;
  },
};

// Lesson Types
export const lessonTypesApi = {
  list: async (search?: string): Promise<LessonTypeListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const response = await api.get<LessonTypeListResponse>(
      `/lesson-types?${params}`
    );
    return response.data;
  },

  get: async (id: number): Promise<LessonType> => {
    const response = await api.get<LessonType>(`/lesson-types/${id}`);
    return response.data;
  },

  create: async (data: { name: string; price: number }): Promise<LessonType> => {
    const response = await api.post<LessonType>("/lesson-types", data);
    return response.data;
  },

  update: async (
    id: number,
    data: { name?: string; price?: number }
  ): Promise<LessonType> => {
    const response = await api.put<LessonType>(`/lesson-types/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/lesson-types/${id}`);
  },
};

// Levels
export const levelsApi = {
  list: async (search?: string): Promise<LevelListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const response = await api.get<LevelListResponse>(`/levels?${params}`);
    return response.data;
  },

  get: async (id: number): Promise<Level> => {
    const response = await api.get<Level>(`/levels/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    teacher_percentage: number;
  }): Promise<Level> => {
    const response = await api.post<Level>("/levels", data);
    return response.data;
  },

  update: async (
    id: number,
    data: { name?: string; teacher_percentage?: number }
  ): Promise<Level> => {
    const response = await api.put<Level>(`/levels/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/levels/${id}`);
  },
};

// Materials
export const materialsApi = {
  list: async (search?: string): Promise<MaterialListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const response = await api.get<MaterialListResponse>(`/materials?${params}`);
    return response.data;
  },

  get: async (id: number): Promise<Material> => {
    const response = await api.get<Material>(`/materials/${id}`);
    return response.data;
  },

  create: async (data: { title: string; file_url: string }): Promise<Material> => {
    const response = await api.post<Material>("/materials", data);
    return response.data;
  },

  update: async (
    id: number,
    data: { title?: string; file_url?: string }
  ): Promise<Material> => {
    const response = await api.put<Material>(`/materials/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/materials/${id}`);
  },
};

// Tests
export const testsApi = {
  list: async (search?: string): Promise<TestListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const response = await api.get<TestListResponse>(`/tests?${params}`);
    return response.data;
  },

  get: async (id: number): Promise<Test> => {
    const response = await api.get<Test>(`/tests/${id}`);
    return response.data;
  },

  create: async (data: { title: string }): Promise<Test> => {
    const response = await api.post<Test>("/tests", data);
    return response.data;
  },

  update: async (id: number, data: { title?: string }): Promise<Test> => {
    const response = await api.put<Test>(`/tests/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tests/${id}`);
  },
};

// Reports
export const reportsApi = {
  teacherReport: async (
    dateFrom: string,
    dateTo: string
  ): Promise<TeacherReportResponse> => {
    const response = await api.post<TeacherReportResponse>("/reports/teachers", {
      date_from: dateFrom,
      date_to: dateTo,
    });
    return response.data;
  },
};

// Dashboard
export const dashboardApi = {
  get: async (): Promise<DashboardResponse> => {
    const response = await api.get<DashboardResponse>("/dashboard");
    return response.data;
  },
};

// Lessons / Schedule
export const lessonsApi = {
  getSchedule: async (
    dateFrom: string,
    dateTo: string,
    teacherId?: number
  ): Promise<ScheduleLesson[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (teacherId) params.append("teacher_id", String(teacherId));
    const response = await api.get<ScheduleLesson[]>(`/lessons/schedule?${params}`);
    return response.data;
  },

  getTeachers: async (): Promise<User[]> => {
    const response = await api.get<UserListResponse>("/users?size=100");
    return response.data.items.filter((u) => u.role === "teacher");
  },
};

export default api;
