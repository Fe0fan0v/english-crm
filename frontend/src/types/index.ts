export type UserRole = 'admin' | 'manager' | 'teacher' | 'student';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  level_id: number | null;
  photo_url: string | null;
  balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Level {
  id: number;
  name: string;
  teacher_percentage: string;
  created_at: string;
  updated_at: string;
}

export interface LessonType {
  id: number;
  name: string;
  price: string;
  created_at: string;
  updated_at: string;
}

export type LessonStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Lesson {
  id: number;
  title: string;
  teacher_id: number;
  lesson_type_id: number;
  scheduled_at: string;
  meeting_url: string | null;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: number;
  title: string;
  file_url: string;
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
