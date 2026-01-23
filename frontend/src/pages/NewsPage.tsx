export default function NewsPage() {
  return (
    <div>
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Новости</h1>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Раздел в разработке</h2>
            <p className="text-gray-600">
              Скоро здесь будут новости и объявления школы
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
