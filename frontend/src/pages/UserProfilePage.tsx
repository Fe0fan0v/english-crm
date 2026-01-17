import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../services/api';
import type { User, UserGroup, Transaction, TransactionListResponse } from '../types';
import Avatar from '../components/Avatar';
import BalanceChangeModal from '../components/BalanceChangeModal';
import EditUserModal, { type EditUserData } from '../components/EditUserModal';
import clsx from 'clsx';

type TabType = 'info' | 'classes' | 'students' | 'materials' | 'groups' | 'transactions';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [transactions, setTransactions] = useState<TransactionListResponse | null>(null);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const fetchGroups = async () => {
    if (!id) return;
    try {
      const data = await usersApi.getGroups(parseInt(id));
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!id) return;
    try {
      const data = await usersApi.getTransactions(parseInt(id), transactionsPage, 10);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchGroups();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [activeTab, transactionsPage, id]);

  const handleBalanceChange = async (amount: number, description: string) => {
    if (!id) return;
    await usersApi.changeBalance(parseInt(id), { amount, description });
    await fetchUser();
    if (activeTab === 'transactions') {
      await fetchTransactions();
    }
  };

  const handleEditUser = async (data: EditUserData) => {
    if (!id) return;
    await usersApi.update(parseInt(id), data);
    await fetchUser();
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Администратор',
      manager: 'Менеджер',
      teacher: 'Учитель',
      student: 'Ученик',
    };
    return labels[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
  const isStudent = user.role === 'student';

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
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Редактировать
              </button>
              {isStudent && (
                <button
                  onClick={() => setIsBalanceModalOpen(true)}
                  className="btn btn-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Изменить баланс
                </button>
              )}
            </div>
          </div>

          {/* Balance for students */}
          {isStudent && (
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Баланс</p>
              <p className={clsx(
                "text-2xl font-bold",
                parseFloat(user.balance) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {user.balance} тг
              </p>
            </div>
          )}

          {/* Status for teacher */}
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={clsx('tab pb-3', activeTab === 'info' && 'tab-active')}
        >
          Информация
        </button>
        {(isStudent || isTeacher) && (
          <button
            onClick={() => setActiveTab('groups')}
            className={clsx('tab pb-3', activeTab === 'groups' && 'tab-active')}
          >
            Группы
          </button>
        )}
        {isStudent && (
          <button
            onClick={() => setActiveTab('transactions')}
            className={clsx('tab pb-3', activeTab === 'transactions' && 'tab-active')}
          >
            Транзакции
          </button>
        )}
        {isTeacher && (
          <>
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
          </>
        )}
      </div>

      {/* Stats for teacher */}
      {isTeacher && activeTab === 'info' && (
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
      )}

      {/* Tab content */}
      {activeTab === 'info' && (
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
            {isStudent && (
              <div>
                <label className="block text-sm text-gray-500 mb-1">Баланс</label>
                <p className="text-gray-800 font-medium">{user.balance} тг</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="card">
          <h2 className="section-title">
            {isStudent ? 'Группы ученика' : 'Группы преподавателя'}
          </h2>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isStudent ? 'Ученик не состоит ни в одной группе' : 'Преподаватель не ведёт ни одной группы'}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{group.name}</h4>
                    <p className="text-sm text-gray-500">
                      {isStudent ? `Преподаватель: ${group.teacher_name || 'Не назначен'}` : group.description || 'Без описания'}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="card">
          <h2 className="section-title">История транзакций</h2>
          {!transactions || transactions.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Нет транзакций
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {transactions.items.map((tx: Transaction) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50"
                  >
                    <div className={clsx(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      tx.type === 'credit' ? "bg-green-100" : "bg-red-100"
                    )}>
                      <svg
                        className={clsx(
                          "w-5 h-5",
                          tx.type === 'credit' ? "text-green-600" : "text-red-600"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {tx.type === 'credit' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {tx.description || (tx.type === 'credit' ? 'Пополнение' : 'Списание')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                    <span className={clsx(
                      "font-semibold",
                      tx.type === 'credit' ? "text-green-600" : "text-red-600"
                    )}>
                      {tx.type === 'credit' ? '+' : '-'}{tx.amount} тг
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {transactions.pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                    disabled={transactionsPage === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <span className="px-4 py-2 text-gray-600">
                    {transactionsPage} из {transactions.pages}
                  </span>
                  <button
                    onClick={() => setTransactionsPage((p) => Math.min(transactions.pages, p + 1))}
                    disabled={transactionsPage === transactions.pages}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Вперед
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'classes' && isTeacher && (
        <div className="card text-center py-12 text-gray-500">
          Раздел в разработке
        </div>
      )}

      {activeTab === 'students' && isTeacher && (
        <div className="card text-center py-12 text-gray-500">
          Раздел в разработке
        </div>
      )}

      {activeTab === 'materials' && isTeacher && (
        <div className="card text-center py-12 text-gray-500">
          Раздел в разработке
        </div>
      )}

      {/* Balance Change Modal */}
      {user && (
        <BalanceChangeModal
          isOpen={isBalanceModalOpen}
          onClose={() => setIsBalanceModalOpen(false)}
          onSubmit={handleBalanceChange}
          currentBalance={user.balance}
          userName={user.name}
        />
      )}

      {/* Edit User Modal */}
      {user && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditUser}
          user={user}
        />
      )}
    </div>
  );
}
