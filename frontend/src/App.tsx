import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import UserProfilePage from "./pages/UserProfilePage";
import LessonTypesPage from "./pages/LessonTypesPage";
import ReportsPage from "./pages/ReportsPage";
import LevelsPage from "./pages/LevelsPage";
import LevelDetailPage from "./pages/LevelDetailPage";
import MaterialsPage from "./pages/MaterialsPage";
import TestsPage from "./pages/TestsPage";
import SchedulePage from "./pages/SchedulePage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import DictionaryPage from "./pages/DictionaryPage";
import IrregularVerbsPage from "./pages/IrregularVerbsPage";
import TeacherStudentVocabularyPage from "./pages/TeacherStudentVocabularyPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import NewsPage from "./pages/NewsPage";
import NewsManagementPage from "./pages/NewsManagementPage";
import SettingsPage from "./pages/SettingsPage";
import ManagerMessagesPage from "./pages/ManagerMessagesPage";
import CoursesPage from "./pages/CoursesPage";
import CourseEditorPage from "./pages/CourseEditorPage";
import LessonEditorPage from "./pages/LessonEditorPage";
import LessonPreviewPage from "./pages/LessonPreviewPage";
import LessonResultsPage from "./pages/LessonResultsPage";
import StudentCourseMaterialPage from "./pages/StudentCourseMaterialPage";
import StudentSchedulePage from "./pages/StudentSchedulePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user, fetchUser, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      if (!user) {
        try {
          await fetchUser();
        } catch {
          // If fetch fails after retries, logout
          if (retryCount >= 2) {
            logout();
          } else {
            setRetryCount((c) => c + 1);
          }
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, [token, user, fetchUser, logout, retryCount]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || (!user && retryCount < 2)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Загрузка...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();

  if (token && user) {
    // Redirect based on role
    switch (user.role) {
      case "teacher":
        return <Navigate to="/teacher" replace />;
      case "student":
        return <Navigate to="/student" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  if (token) {
    // Token exists but user not loaded yet, wait
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Component that redirects to appropriate dashboard based on user role
function HomeRedirect() {
  const { user } = useAuthStore();

  if (!user) return null;

  switch (user.role) {
    case "teacher":
      return <Navigate to="/teacher" replace />;
    case "student":
      return <Navigate to="/student" replace />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute>
            <TeacherDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <StudentDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/dictionary"
        element={
          <ProtectedRoute>
            <DictionaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/irregular-verbs"
        element={
          <ProtectedRoute>
            <IrregularVerbsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/knowledge-base"
        element={
          <ProtectedRoute>
            <KnowledgeBasePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/news"
        element={
          <ProtectedRoute>
            <NewsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/course-material/:materialId"
        element={
          <ProtectedRoute>
            <StudentCourseMaterialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/student-vocabulary"
        element={
          <ProtectedRoute>
            <TeacherStudentVocabularyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/irregular-verbs"
        element={
          <ProtectedRoute>
            <IrregularVerbsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/knowledge-base"
        element={
          <ProtectedRoute>
            <KnowledgeBasePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teachers/:id"
        element={
          <ProtectedRoute>
            <TeacherDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/:id"
        element={
          <ProtectedRoute>
            <StudentSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lesson-types"
        element={
          <ProtectedRoute>
            <LessonTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/levels"
        element={
          <ProtectedRoute>
            <LevelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/levels/:id"
        element={
          <ProtectedRoute>
            <LevelDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <MaterialsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses"
        element={
          <ProtectedRoute>
            <CoursesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:id"
        element={
          <ProtectedRoute>
            <CourseEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:id/edit"
        element={
          <ProtectedRoute>
            <CourseEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/lessons/:id"
        element={
          <ProtectedRoute>
            <LessonPreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/lessons/:id/edit"
        element={
          <ProtectedRoute>
            <LessonEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/lessons/:id/results"
        element={
          <ProtectedRoute>
            <LessonResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests"
        element={
          <ProtectedRoute>
            <TestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <SchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <GroupsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <GroupDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <ManagerMessagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/news-management"
        element={
          <ProtectedRoute>
            <NewsManagementPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
