import { useEffect, useState } from "react";
import axios from "axios";

interface News {
  id: number;
  title: string;
  content: string;
  banner_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get<{ items: News[]; total: number }>("/api/news", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNews(response.data.items);
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (isLoading) {
    return (
      <div>
        <h1 className="page-title">Новости</h1>
        <div className="card text-center py-12 text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Новости</h1>

      {news.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Новостей пока нет</h2>
          <p className="text-gray-600">
            Скоро здесь появятся новости и объявления школы
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {news.map((item) => (
            <div key={item.id} className="card">
              {item.banner_url && (
                <img
                  src={item.banner_url}
                  alt={item.title}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )}
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                {item.title}
              </h2>
              <p className="text-gray-600 whitespace-pre-wrap mb-4">
                {item.content}
              </p>
              <p className="text-sm text-gray-400">
                {new Date(item.created_at).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
