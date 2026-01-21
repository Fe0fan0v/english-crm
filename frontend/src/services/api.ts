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
  LevelPaymentMatrix,
  LevelPaymentUpdate,
  Material,
  MaterialListResponse,
  Test,
  TestListResponse,
  TeacherReportResponse,
  DashboardResponse,
  ScheduleLesson,
  LessonDetail,
  LessonStatus,
  AttendanceStatus,
  Group,
  GroupDetail,
  GroupListResponse,
  BalanceChange,
  TransactionListResponse,
  UserGroup,
  TeacherDashboardResponse,
  TeacherLesson,
  TeacherGroupSummary,
  TeacherStudentInfo,
  AttendanceUpdate,
  StudentDashboardResponse,
  StudentLessonInfo,
  StudentGroupSummary,
  StudentMaterialInfo,
  StudentTestInfo,
  GroupMessage,
  GroupMessagesResponse,
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
  TeacherAvailability,
  TeacherAvailabilityListResponse,
  TeacherAvailabilityCreate,
  DirectMessage,
  ConversationListResponse,
  LessonBatchResponse,
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

  resetTeachersBalances: async (): Promise<{ message: string; reset_count: number; total_amount: string }> => {
    const response = await api.post<{ message: string; reset_count: number; total_amount: string }>("/users/teachers/reset-balances");
    return response.data;
  },

  uploadPhoto: async (userId: number, file: File): Promise<User> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<User>(`/users/${userId}/photo`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  deletePhoto: async (userId: number): Promise<User> => {
    const response = await api.delete<User>(`/users/${userId}/photo`);
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

  getPayments: async (id: number): Promise<LevelPaymentMatrix> => {
    const response = await api.get<LevelPaymentMatrix>(`/levels/${id}/payments`);
    return response.data;
  },

  updatePayments: async (
    id: number,
    payments: LevelPaymentUpdate[]
  ): Promise<LevelPaymentMatrix> => {
    const response = await api.put<LevelPaymentMatrix>(`/levels/${id}/payments`, {
      payments,
    });
    return response.data;
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

  exportTeacherReport: async (dateFrom: string, dateTo: string): Promise<void> => {
    const response = await api.post("/reports/teachers/export", {
      date_from: dateFrom,
      date_to: dateTo,
    }, {
      responseType: "blob",
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `report_${dateFrom}_${dateTo}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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

  createLesson: async (data: {
    title: string;
    teacher_id: number;
    lesson_type_id: number;
    scheduled_at: string;
    duration_minutes?: number;
    meeting_url?: string;
    group_id?: number;
    student_ids?: number[];
  }): Promise<ScheduleLesson> => {
    const response = await api.post<ScheduleLesson>("/lessons", data);
    return response.data;
  },

  getLesson: async (lessonId: number): Promise<LessonDetail> => {
    const response = await api.get<LessonDetail>(`/lessons/${lessonId}`);
    return response.data;
  },

  updateLesson: async (
    lessonId: number,
    data: {
      title?: string;
      status?: LessonStatus;
      meeting_url?: string;
    }
  ): Promise<LessonDetail> => {
    const response = await api.put<LessonDetail>(`/lessons/${lessonId}`, data);
    return response.data;
  },

  updateAttendance: async (
    lessonId: number,
    studentId: number,
    attendanceStatus: AttendanceStatus
  ): Promise<void> => {
    await api.post(`/lessons/${lessonId}/attendance`, null, {
      params: { student_id: studentId, attendance_status: attendanceStatus },
    });
  },

  deleteLesson: async (lessonId: number): Promise<void> => {
    await api.delete(`/lessons/${lessonId}`);
  },

  createLessonsBatch: async (data: {
    teacher_id: number;
    lesson_type_id: number;
    weekdays: string[];
    time: string;
    start_date: string;
    weeks?: number;
    duration_minutes?: number;
    group_id?: number;
    student_ids?: number[];
  }): Promise<LessonBatchResponse> => {
    const response = await api.post<LessonBatchResponse>("/lessons/batch", data);
    return response.data;
  },
};

// Teacher Dashboard API
export const teacherApi = {
  getDashboard: async (): Promise<TeacherDashboardResponse> => {
    const response = await api.get<TeacherDashboardResponse>("/teacher/dashboard");
    return response.data;
  },

  // Manager can view specific teacher's dashboard
  getDashboardByTeacherId: async (teacherId: number): Promise<TeacherDashboardResponse> => {
    const response = await api.get<TeacherDashboardResponse>(`/teacher/dashboard/${teacherId}`);
    return response.data;
  },

  getSchedule: async (dateFrom: string, dateTo: string): Promise<TeacherLesson[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    const response = await api.get<TeacherLesson[]>(`/teacher/schedule?${params}`);
    return response.data;
  },

  // Manager can view specific teacher's schedule
  getScheduleByTeacherId: async (teacherId: number, dateFrom: string, dateTo: string): Promise<TeacherLesson[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    const response = await api.get<TeacherLesson[]>(`/teacher/schedule/${teacherId}?${params}`);
    return response.data;
  },

  getGroups: async (): Promise<TeacherGroupSummary[]> => {
    const response = await api.get<TeacherGroupSummary[]>("/teacher/groups");
    return response.data;
  },

  getStudents: async (): Promise<TeacherStudentInfo[]> => {
    const response = await api.get<TeacherStudentInfo[]>("/teacher/students");
    return response.data;
  },

  // Manager can view specific teacher's students
  getStudentsByTeacherId: async (teacherId: number): Promise<TeacherStudentInfo[]> => {
    const response = await api.get<TeacherStudentInfo[]>(`/teacher/students/${teacherId}`);
    return response.data;
  },

  getLesson: async (lessonId: number): Promise<TeacherLesson> => {
    const response = await api.get<TeacherLesson>(`/teacher/lessons/${lessonId}`);
    return response.data;
  },

  createLesson: async (data: {
    title: string;
    lesson_type_id: number;
    scheduled_at: string;
    duration_minutes?: number;
    meeting_url?: string;
    group_id?: number;
    student_ids?: number[];
  }): Promise<TeacherLesson> => {
    const response = await api.post<TeacherLesson>("/teacher/lessons", data);
    return response.data;
  },

  updateLesson: async (
    lessonId: number,
    data: {
      title?: string;
      scheduled_at?: string;
      meeting_url?: string;
      status?: string;
    }
  ): Promise<TeacherLesson> => {
    const response = await api.put<TeacherLesson>(`/teacher/lessons/${lessonId}`, data);
    return response.data;
  },

  cancelLesson: async (lessonId: number): Promise<void> => {
    await api.delete(`/teacher/lessons/${lessonId}`);
  },

  markAttendance: async (
    lessonId: number,
    attendances: AttendanceUpdate[]
  ): Promise<void> => {
    await api.post(`/teacher/lessons/${lessonId}/attendance`, { attendances });
  },

  // Availability
  getAvailability: async (): Promise<TeacherAvailabilityListResponse> => {
    const response = await api.get<TeacherAvailabilityListResponse>("/teacher/availability");
    return response.data;
  },

  createAvailability: async (data: TeacherAvailabilityCreate): Promise<TeacherAvailability> => {
    const response = await api.post<TeacherAvailability>("/teacher/availability", data);
    return response.data;
  },

  deleteAvailability: async (availabilityId: number): Promise<void> => {
    await api.delete(`/teacher/availability/${availabilityId}`);
  },

  // Manager can view specific teacher's availability
  getAvailabilityByTeacherId: async (teacherId: number): Promise<TeacherAvailabilityListResponse> => {
    const response = await api.get<TeacherAvailabilityListResponse>(`/teacher/availability/${teacherId}`);
    return response.data;
  },
};

// Student Dashboard API
export const studentApi = {
  getDashboard: async (): Promise<StudentDashboardResponse> => {
    const response = await api.get<StudentDashboardResponse>("/student/dashboard");
    return response.data;
  },

  getSchedule: async (dateFrom: string, dateTo: string): Promise<StudentLessonInfo[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    const response = await api.get<StudentLessonInfo[]>(`/student/schedule?${params}`);
    return response.data;
  },

  getGroups: async (): Promise<StudentGroupSummary[]> => {
    const response = await api.get<StudentGroupSummary[]>("/student/groups");
    return response.data;
  },

  getMaterials: async (): Promise<StudentMaterialInfo[]> => {
    const response = await api.get<StudentMaterialInfo[]>("/student/materials");
    return response.data;
  },

  getTests: async (): Promise<StudentTestInfo[]> => {
    const response = await api.get<StudentTestInfo[]>("/student/tests");
    return response.data;
  },
};

// Group Messages (Chat) API
export const groupMessagesApi = {
  getMessages: async (
    groupId: number,
    page = 1,
    size = 50
  ): Promise<GroupMessagesResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    const response = await api.get<GroupMessagesResponse>(
      `/groups/${groupId}/messages?${params}`
    );
    return response.data;
  },

  sendMessage: async (groupId: number, content: string): Promise<GroupMessage> => {
    const response = await api.post<GroupMessage>(`/groups/${groupId}/messages`, {
      content,
    });
    return response.data;
  },

  // WebSocket URL helper
  getWebSocketUrl: (groupId: number): string => {
    const token = localStorage.getItem("token");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/groups/ws/${groupId}/chat?token=${token}`;
  },
};

// Direct Messages API
export const directMessagesApi = {
  getConversations: async (): Promise<ConversationListResponse> => {
    const response = await api.get<ConversationListResponse>("/messages/conversations");
    return response.data;
  },

  getMessages: async (
    userId: number,
    limit = 50,
    beforeId?: number
  ): Promise<DirectMessage[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeId) params.append("before_id", String(beforeId));
    const response = await api.get<DirectMessage[]>(`/messages/${userId}?${params}`);
    return response.data;
  },

  sendMessage: async (recipientId: number, content: string): Promise<DirectMessage> => {
    const response = await api.post<DirectMessage>("/messages", {
      recipient_id: recipientId,
      content,
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ unread_count: number }> => {
    const response = await api.get<{ unread_count: number }>("/messages/unread/count");
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  list: async (page = 1, size = 20): Promise<NotificationListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    const response = await api.get<NotificationListResponse>(`/notifications?${params}`);
    return response.data;
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get<UnreadCountResponse>("/notifications/unread-count");
    return response.data;
  },

  markAsRead: async (id: number): Promise<Notification> => {
    const response = await api.post<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post("/notifications/read-all");
  },
};

export default api;
