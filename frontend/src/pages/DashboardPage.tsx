import { useAuthStore } from '../store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

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
      <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user?.name}!</h1>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-medium mb-4">Информация о профиле</h2>
        <div className="space-y-3">
          <div>
            <span className="text-gray-500">Роль:</span>{' '}
            <span className="font-medium">{user?.role && getRoleLabel(user.role)}</span>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{' '}
            <span className="font-medium">{user?.email}</span>
          </div>
          {user?.phone && (
            <div>
              <span className="text-gray-500">Телефон:</span>{' '}
              <span className="font-medium">{user.phone}</span>
            </div>
          )}
          {user?.role === 'student' && (
            <div>
              <span className="text-gray-500">Баланс:</span>{' '}
              <span className="font-medium">{user.balance} руб.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
