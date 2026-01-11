import { useEffect, useState } from 'react';
import { usersApi } from '../services/api';
import type { User, UserListResponse } from '../types';

export default function UsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.list(page, 20, search || undefined);
      setData(response);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Администратор',
      manager: 'Менеджер',
      teacher: 'Преподаватель',
      student: 'Студент',
    };
    return labels[role] || role;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition-colors">
          Добавить пользователя
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Имя</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Телефон</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Роль</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((user: User) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{user.name}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-gray-600">{user.phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-primary-50 text-primary-600 rounded-lg text-sm">
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-sm ${
                        user.is_active
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary-500 hover:text-primary-600">
                      Редактировать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.pages > 1 && (
          <div className="p-4 border-t flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Назад
            </button>
            <span className="px-4 py-2">
              {page} из {data.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Вперед
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
