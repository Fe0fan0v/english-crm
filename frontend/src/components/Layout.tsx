import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import clsx from 'clsx';

interface NavItem {
  path: string;
  label: string;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { path: '/users', label: 'Пользователи', roles: ['admin', 'manager'] },
  { path: '/lesson-types', label: 'Типы занятий', roles: ['admin'] },
  { path: '/levels', label: 'Уровни', roles: ['admin'] },
  { path: '/materials', label: 'Материалы', roles: ['admin', 'manager', 'teacher'] },
  { path: '/tests', label: 'Тесты', roles: ['admin', 'manager', 'teacher'] },
  { path: '/lessons', label: 'Занятия', roles: ['admin', 'manager', 'teacher'] },
  { path: '/reports', label: 'Отчеты', roles: ['admin'] },
  { path: '/profile', label: 'Профиль', roles: ['admin', 'manager', 'teacher', 'student'] },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary-600">EngCRM</h1>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={clsx(
                    'block px-4 py-3 rounded-xl transition-colors',
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="text-sm text-gray-600 mb-2">{user?.name}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
