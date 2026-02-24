import api from "./api";

export interface LiveSessionCreateData {
  lesson_id: number;
  interactive_lesson_id: number;
  student_id: number;
}

export interface LiveSessionResponse {
  lesson_id: number;
  interactive_lesson_id: number;
  teacher_id: number;
  student_id: number;
  teacher_name: string;
  created_at: string;
  teacher_connected: boolean;
  student_connected: boolean;
}

export interface LiveSessionActiveCheck {
  active: boolean;
  lesson_id: number | null;
  interactive_lesson_id: number | null;
  teacher_name: string | null;
}

export const liveSessionApi = {
  create: async (data: LiveSessionCreateData): Promise<LiveSessionResponse> => {
    const response = await api.post<LiveSessionResponse>("/live-sessions/", data);
    return response.data;
  },

  checkActive: async (): Promise<LiveSessionActiveCheck> => {
    const response = await api.get<LiveSessionActiveCheck>("/live-sessions/active");
    return response.data;
  },

  endSession: async (lessonId: number): Promise<void> => {
    await api.delete(`/live-sessions/${lessonId}`);
  },

  getWsUrl: (lessonId: number): string => {
    const token = localStorage.getItem("token");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/live-sessions/ws/${lessonId}?token=${token}`;
  },
};
