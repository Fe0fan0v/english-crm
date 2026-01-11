import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../services/api';
import type { User } from '../types';
import Avatar from '../components/Avatar';
import clsx from 'clsx';

type TabType = 'info' | 'classes' | 'students' | 'materials';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await usersApi.get(parseInt(id));
        setUser(data);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Администратор',
      manager: 'Менеджер',
      teacher: 'Учитель',
      student: 'Ученик',
    };
    return labels[role] || role;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Пользователь не найден</div>
      </div>
    );
  }

  const isTeacher = user.role === 'teacher';

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Назад
      </button>

      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <Avatar name={user.name} photo={user.photo_url} size="xl" />
            {user.is_active && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></span>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                {user.id}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {user.email}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button className="btn btn-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Редактировать
              </button>
              <button className="btn btn-ghost">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Status */}
          {isTeacher && (
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-2">Статус учителя в онлайн-уроках</p>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'text-sm font-medium',
                  user.is_active ? 'text-green-600' : 'text-gray-500'
                )}>
                  {user.is_active ? '✓ Активирован' : 'Деактивирован'}
                </span>
                <button className="text-sm text-gray-400 hover:text-gray-600">
                  {user.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs for teacher */}
      {isTeacher && (
        <>
          <div className="flex gap-6 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={clsx('tab pb-3', activeTab === 'info' && 'tab-active')}
            >
              Учитель
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={clsx('tab pb-3', activeTab === 'classes' && 'tab-active')}
            >
              Классы
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={clsx('tab pb-3', activeTab === 'students' && 'tab-active')}
            >
              Ученики
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={clsx('tab pb-3', activeTab === 'materials' && 'tab-active')}
            >
              Личные материалы
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Провед. уроков</p>
                <p className="text-2xl font-bold text-gray-800">308</p>
              </div>
            </div>

            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Загруженность</p>
                <p className="text-2xl font-bold text-gray-800">83 %</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User info */}
      <div className="card">
        <h2 className="section-title">Личные данные</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Имя</label>
            <p className="text-gray-800 font-medium">{user.name}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Email</label>
            <p className="text-gray-800 font-medium">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Телефон</label>
            <p className="text-gray-800 font-medium">{user.phone || '—'}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Роль</label>
            <p className="text-gray-800 font-medium">{getRoleLabel(user.role)}</p>
          </div>
          {user.role === 'student' && (
            <div>
              <label className="block text-sm text-gray-500 mb-1">Баланс</label>
              <p className="text-gray-800 font-medium">{user.balance} руб.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
