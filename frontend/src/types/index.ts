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

export interface LevelListResponse {
  items: Level[];
  total: number;
}

// Level Payment Matrix
export interface LevelPaymentMatrixItem {
  lesson_type_id: number;
  lesson_type_name: string;
  lesson_type_price: string;
  teacher_payment: string | null;
}

export interface LevelPaymentMatrix {
  level_id: number;
  level_name: string;
  items: LevelPaymentMatrixItem[];
}

export interface LevelPaymentUpdate {
  lesson_type_id: number;
  teacher_payment: number;
}

export interface LessonType {
  id: number;
  name: string;
  price: string;
  created_at: string;
  updated_at: string;
}

export interface LessonTypeListResponse {
  items: LessonType[];
  total: number;
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

export interface MaterialListResponse {
  items: Material[];
  total: number;
}

export interface Test {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface TestListResponse {
  items: Test[];
  total: number;
}

// Reports
export interface StudentReportRow {
  student_name: string;
  lesson_type: string;
  lessons_count: number;
  teacher_payment: string;
}

export interface TeacherReport {
  teacher_id: number;
  teacher_name: string;
  rows: StudentReportRow[];
  total: string;
}

export interface TeacherReportResponse {
  teachers: TeacherReport[];
  grand_total: string;
  date_from: string;
  date_to: string;
}

// Dashboard
export interface DashboardStats {
  total_balance: string;
  students_count: number;
  teachers_count: number;
  lessons_this_month: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface DashboardCharts {
  lessons_chart: ChartDataPoint[];
  income_chart: ChartDataPoint[];
}

export interface UpcomingLesson {
  id: number;
  title: string;
  scheduled_at: string;
  teacher_name: string;
  student_names: string[];
  meeting_url: string | null;
}

export interface DashboardResponse {
  stats: DashboardStats;
  charts: DashboardCharts;
  upcoming_lessons: UpcomingLesson[];
}

// Schedule
export interface ScheduleLesson {
  id: number;
  title: string;
  teacher_id: number;
  teacher_name: string;
  lesson_type_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: LessonStatus;
  students_count: number;
}

// Batch lesson creation
export interface LessonBatchConflict {
  date: string;
  reason: string;
}

export interface LessonBatchResponse {
  created: ScheduleLesson[];
  conflicts: LessonBatchConflict[];
}

// Lesson Detail (for admin/manager view)
export interface LessonStudentDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  attendance_status: AttendanceStatus;
  charged: boolean;
}

export interface LessonDetail {
  id: number;
  title: string;
  teacher_id: number;
  teacher_name: string;
  group_id: number | null;
  group_name: string | null;
  lesson_type_id: number;
  lesson_type_name: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: LessonStatus;
  students: LessonStudentDetail[];
  created_at: string;
  updated_at: string;
}

// Groups
export interface GroupStudent {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  balance: string;
  joined_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  students_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupDetail extends Omit<Group, 'students_count'> {
  students: GroupStudent[];
}

export interface GroupListResponse {
  items: Group[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Transactions
export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id: number;
  amount: string;
  type: TransactionType;
  description: string | null;
  lesson_id: number | null;
  created_at: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Balance
export interface BalanceChange {
  amount: number;
  description?: string;
}

// User Groups
export interface UserGroup {
  id: number;
  name: string;
  description: string | null;
  teacher_name: string | null;
  joined_at: string;
}

// Attendance
export type AttendanceStatus = 'pending' | 'present' | 'absent_excused' | 'absent_unexcused';

export interface AttendanceUpdate {
  student_id: number;
  status: AttendanceStatus;
}

// Teacher Dashboard
export interface TeacherStats {
  lessons_conducted: number;
  workload_percentage: number;
  students_count: number;
  groups_count: number;
}

export interface TeacherGroupSummary {
  id: number;
  name: string;
  students_count: number;
}

export interface TeacherLessonStudent {
  id: number;
  name: string;
  attendance_status: AttendanceStatus;
  charged: boolean;
}

export interface TeacherLesson {
  id: number;
  title: string;
  group_id: number | null;
  group_name: string | null;
  lesson_type_id: number;
  lesson_type_name: string;
  lesson_type_price: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: LessonStatus;
  students: TeacherLessonStudent[];
}

export interface TeacherDashboardResponse {
  stats: TeacherStats;
  upcoming_lessons: TeacherLesson[];
  groups: TeacherGroupSummary[];
}

export interface TeacherStudentInfo {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  balance: string;
  group_names: string[];
}

// Student Dashboard
export interface StudentStats {
  balance: string;
  upcoming_lessons_count: number;
  groups_count: number;
}

export interface StudentGroupSummary {
  id: number;
  name: string;
  teacher_id: number | null;
  teacher_name: string | null;
  has_unread_messages: boolean;
}

export interface StudentLessonInfo {
  id: number;
  title: string;
  scheduled_at: string;
  teacher_id: number;
  teacher_name: string;
  lesson_type_name: string;
  meeting_url: string | null;
  status: LessonStatus;
  group_name: string | null;
}

export interface StudentDashboardResponse {
  stats: StudentStats;
  upcoming_lessons: StudentLessonInfo[];
  groups: StudentGroupSummary[];
}

export interface StudentMaterialInfo {
  id: number;
  title: string;
  file_url: string;
  granted_at: string;
}

export interface StudentTestInfo {
  id: number;
  title: string;
  granted_at: string;
}

// Group Messages (Chat)
export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface GroupMessagesResponse {
  items: GroupMessage[];
  total: number;
  has_more: boolean;
}

// Notifications
export type NotificationType = 'lesson_cancelled' | 'low_balance';

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

// Teacher Availability
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TeacherAvailability {
  id: number;
  teacher_id: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
}

export interface TeacherAvailabilityListResponse {
  items: TeacherAvailability[];
}

export interface TeacherAvailabilityCreate {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
}

// Direct Messages
export interface DirectMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  recipient_id: number;
  recipient_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  user_id: number;
  user_name: string;
  user_photo_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
}
