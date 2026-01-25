# WebSocket конфигурация EngCRM

## 🔌 Статус WebSocket

✅ **Backend**: Реализован для группового чата
✅ **Frontend**: Настроен с автоматическим реконнектом
✅ **Nginx**: Настроен для проксирования WebSocket
✅ **Адресация**: Автоматически адаптируется к домену
✅ **SSL**: Поддержка WSS (WebSocket Secure)

## 📡 WebSocket Endpoints

### Групповой чат
```
wss://justspeak.heliad.ru/api/groups/ws/{group_id}/chat?token={jwt_token}
```

**Параметры:**
- `group_id` - ID группы
- `token` - JWT токен авторизации

**Формат сообщений:**

Отправка (клиент → сервер):
```json
{
  "message": "Текст сообщения",
  "file_url": "https://example.com/file.pdf"  // опционально
}
```

Получение (сервер → клиент):
```json
{
  "type": "new_message",
  "message": {
    "id": 123,
    "group_id": 5,
    "user_id": 10,
    "user_name": "Иван Иванов",
    "message": "Текст сообщения",
    "file_url": null,
    "created_at": "2026-01-25T10:30:00"
  }
}
```

Ошибка:
```json
{
  "type": "error",
  "message": "Описание ошибки"
}
```

## 🔧 Frontend конфигурация

### Автоматическое определение адреса

**Файл:** `frontend/src/services/api.ts`

```typescript
getWebSocketUrl: (groupId: number): string => {
  const token = localStorage.getItem("token");

  // Автоматически определяет протокол
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // Автоматически использует текущий домен
  const host = window.location.host;

  return `${protocol}//${host}/api/groups/ws/${groupId}/chat?token=${token}`;
}
```

### Примеры адресов

**Production (HTTPS):**
```
wss://justspeak.heliad.ru/api/groups/ws/5/chat?token=eyJ...
```

**Локальная разработка (HTTP):**
```
ws://localhost:5173/api/groups/ws/5/chat?token=eyJ...
```

### Почему это работает?

1. **Автоматический протокол**:
   - На HTTPS → использует `wss:` (WebSocket Secure)
   - На HTTP → использует `ws:`
   - Браузер блокирует `ws:` на HTTPS страницах

2. **Автоматический домен**:
   - `window.location.host` возвращает текущий домен
   - Не нужно хардкодить адреса
   - Работает на любом окружении

3. **Относительный путь**:
   - Путь начинается с `/api/groups/ws/...`
   - Nginx проксирует на backend
   - Поддержка SSL/TLS

## 🌐 Nginx конфигурация

### WebSocket проксирование

**Файл:** `/etc/nginx/sites-available/justspeak.heliad.ru`

```nginx
location /api {
    proxy_pass http://127.0.0.1:8005;

    # WebSocket support
    proxy_http_version 1.1;                    # Обязательно для WebSocket
    proxy_set_header Upgrade $http_upgrade;    # Upgrade заголовок
    proxy_set_header Connection "upgrade";     # Connection заголовок

    # Стандартные заголовки
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Таймауты для долгих соединений
    proxy_read_timeout 300;     # 5 минут
    proxy_connect_timeout 300;  # 5 минут
}
```

### Как работает WebSocket через Nginx

```
Браузер
    ↓ WSS соединение
wss://justspeak.heliad.ru/api/groups/ws/5/chat?token=...
    ↓
Nginx (443)
    ↓ SSL терминация
    ↓ Upgrade: websocket
    ↓ Connection: Upgrade
WS соединение на 127.0.0.1:8005
    ↓
Backend (FastAPI)
    ↓ WebSocket handler
Обработка сообщений
```

### Важные моменты

1. **HTTP/1.1**: WebSocket требует HTTP/1.1 (не HTTP/2)
2. **Upgrade заголовок**: Переключает соединение с HTTP на WebSocket
3. **Connection: upgrade**: Сообщает о желании обновить протокол
4. **Таймауты**: Большие таймауты для долгоживущих соединений

## 🔐 Безопасность WebSocket

### Аутентификация

WebSocket использует JWT токен в query параметрах:
```
wss://justspeak.heliad.ru/api/groups/ws/5/chat?token=eyJhbGc...
```

**Backend проверяет:**
1. Валидность JWT токена
2. Существование пользователя
3. Права доступа к группе

**Коды закрытия при ошибке:**
- `4001` - Invalid token / User not found
- `4003` - Access denied (не член группы)

### SSL/TLS

- **Production**: WSS (WebSocket Secure) через HTTPS
- **Шифрование**: TLS 1.2/1.3
- **Сертификат**: Let's Encrypt

## 📱 Frontend реализация

### GroupChat компонент

**Файл:** `frontend/src/components/GroupChat.tsx`

```typescript
// WebSocket connection
useEffect(() => {
  const connect = () => {
    const wsUrl = groupMessagesApi.getWebSocketUrl(groupId);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      // Автоматический реконнект через 3 секунды
      if (event.code !== 1000) {
        setTimeout(() => connect(), 3000);
      }
    };

    wsRef.current = ws;
  };

  connect();
  return () => wsRef.current?.close();
}, [groupId]);
```

### Особенности

1. **Автоматический реконнект**: При потере соединения
2. **Cleanup**: Закрытие соединения при unmount
3. **Индикатор состояния**: `isConnected` для UI
4. **Обработка ошибок**: Логирование и уведомления

## 🧪 Тестирование WebSocket

### 1. Через браузерную консоль

```javascript
// Получить токен
const token = localStorage.getItem("token");

// Подключиться
const ws = new WebSocket(`wss://justspeak.heliad.ru/api/groups/ws/5/chat?token=${token}`);

// Слушать сообщения
ws.onmessage = (e) => console.log(JSON.parse(e.data));

// Отправить сообщение
ws.send(JSON.stringify({ message: "Тестовое сообщение" }));

// Закрыть соединение
ws.close();
```

### 2. Через командную строку (wscat)

```bash
# Установить wscat
npm install -g wscat

# Подключиться
wscat -c "wss://justspeak.heliad.ru/api/groups/ws/5/chat?token=YOUR_TOKEN"

# Отправить сообщение
> {"message": "Hello"}

# Получить ответ
< {"type":"new_message","message":{...}}
```

### 3. Проверить в логах nginx

```bash
ssh admin@158.160.141.83
sudo tail -f /var/log/nginx/access.log | grep "ws"
```

Успешное WebSocket подключение:
```
"GET /api/groups/ws/5/chat?token=... HTTP/1.1" 101
```

`101` - Switching Protocols (успешный Upgrade)

### 4. Проверить в логах backend

```bash
ssh admin@158.160.141.83
cd ~/english-crm
docker compose logs backend -f | grep -i websocket
```

## 🐛 Troubleshooting

### WebSocket не подключается (403/401)

**Проблема:** Ошибка авторизации

**Решение:**
```typescript
// Проверить наличие токена
const token = localStorage.getItem("token");
console.log("Token:", token ? "exists" : "missing");

// Проверить формат URL
const wsUrl = groupMessagesApi.getWebSocketUrl(groupId);
console.log("WebSocket URL:", wsUrl);
```

### WebSocket не подключается (502/504)

**Проблема:** Backend недоступен

**Решение:**
```bash
# Проверить backend
curl http://localhost:8005/health

# Проверить логи backend
docker compose logs backend --tail=50
```

### WebSocket обрывается сразу

**Проблема:** Nginx таймауты слишком короткие

**Решение:**
```nginx
# Увеличить таймауты в nginx
proxy_read_timeout 3600;    # 1 час
proxy_send_timeout 3600;    # 1 час
```

### WebSocket работает локально, но не на HTTPS

**Проблема:** Смешанный контент (Mixed Content)

**Решение:**
- HTTPS страница должна использовать WSS (не WS)
- Проверить `window.location.protocol === "https:"`
- Frontend автоматически использует правильный протокол

### Connection: close вместо Connection: upgrade

**Проблема:** Nginx не передаёт Upgrade заголовок

**Решение:**
```nginx
# Добавить в nginx config
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## 📊 Мониторинг WebSocket

### Метрики

Проверить активные WebSocket соединения:
```bash
# Nginx статистика
curl -s http://localhost/nginx_status | grep active

# Backend (внутри контейнера)
docker compose exec backend ps aux | grep uvicorn
```

### Логирование

**Backend логи** (`backend/app/api/group_messages.py`):
- WebSocket подключение/отключение
- Отправленные сообщения
- Ошибки авторизации

**Nginx access log**:
- HTTP статус 101 (Switching Protocols)
- Длительность соединения
- IP адреса клиентов

## 🚀 Расширение WebSocket

### Добавление новых WebSocket endpoints

**1. Backend** (`backend/app/api/your_module.py`):
```python
@router.websocket("/ws/your-endpoint")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Валидация токена
    # ...

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка
            await websocket.send_json({"response": "data"})
    except WebSocketDisconnect:
        # Cleanup
        pass
```

**2. Frontend** (`frontend/src/services/api.ts`):
```typescript
export const yourApi = {
  getWebSocketUrl: (): string => {
    const token = localStorage.getItem("token");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/your-endpoint?token=${token}`;
  },
};
```

**3. Использование** в компоненте:
```typescript
useEffect(() => {
  const ws = new WebSocket(yourApi.getWebSocketUrl());
  ws.onopen = () => console.log("Connected");
  ws.onmessage = (e) => console.log("Message:", e.data);
  return () => ws.close();
}, []);
```

## ✅ Чек-лист правильной настройки

- [x] Frontend использует `window.location.host` для адреса
- [x] Frontend автоматически выбирает `ws:` или `wss:`
- [x] Nginx настроен с `proxy_http_version 1.1`
- [x] Nginx передаёт `Upgrade` и `Connection` заголовки
- [x] Backend проверяет JWT токен
- [x] Backend проверяет права доступа
- [x] SSL сертификат установлен (для WSS)
- [x] CORS настроен правильно
- [x] Таймауты достаточно большие

## 📚 Дополнительные ресурсы

- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)

---

**Итог:** WebSocket полностью настроен и работает правильно с доменом `justspeak.heliad.ru`. Адреса автоматически адаптируются к окружению (production/development), используя правильные протоколы (WSS на HTTPS, WS на HTTP).
