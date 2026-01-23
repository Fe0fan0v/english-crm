export default function KnowledgeBasePage() {
  return (
    <div>
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">База знаний</h1>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Раздел в разработке</h2>
            <p className="text-gray-600">
              Скоро здесь будет доступна полезная информация и материалы
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
