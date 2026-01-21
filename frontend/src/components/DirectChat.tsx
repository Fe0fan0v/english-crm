import { useEffect, useState, useRef } from "react";
import { directMessagesApi, uploadsApi } from "../services/api";
import { useAuthStore } from "../store/authStore";
import Avatar from "./Avatar";
import type { DirectMessage, ConversationSummary } from "../types";

interface DirectChatProps {
  partnerId: number;
  partnerName: string;
  onClose: () => void;
}

// Helper to check if URL is an image
const isImageUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
};

// Helper to get filename from URL
const getFilenameFromUrl = (url: string): string => {
  return url.split("/").pop() || "file";
};

export default function DirectChat({ partnerId, partnerName, onClose }: DirectChatProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    try {
      const data = await directMessagesApi.getMessages(partnerId);
      setMessages(data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [partnerId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadsApi.uploadChatFile(file);
      setPendingFile({ url: result.file_url, name: result.filename });
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Не удалось загрузить файл");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || isSending) return;

    const contentToSend = newMessage.trim();
    const fileUrlToSend = pendingFile?.url;

    setIsSending(true);
    setNewMessage("");
    setPendingFile(null);

    try {
      const message = await directMessagesApi.sendMessage(
        partnerId,
        contentToSend,
        fileUrlToSend
      );
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Не удалось отправить сообщение");
      // Restore message on error
      setNewMessage(contentToSend);
      if (fileUrlToSend) {
        setPendingFile({ url: fileUrlToSend, name: "file" });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const removePendingFile = () => {
    setPendingFile(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={partnerName} size="sm" />
            <h2 className="font-semibold text-gray-800">{partnerName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Загрузка...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-center">
                <p>Нет сообщений</p>
                <p className="text-sm">Напишите первое сообщение</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-cyan-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {/* File attachment */}
                    {msg.file_url && (
                      <div className="mb-2">
                        {isImageUrl(msg.file_url) ? (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={msg.file_url}
                              alt="Attachment"
                              className="max-w-full rounded-lg max-h-48 object-contain"
                            />
                          </a>
                        ) : (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg ${
                              isOwn ? "bg-cyan-600" : "bg-gray-200"
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm truncate">{getFilenameFromUrl(msg.file_url)}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {/* Text content */}
                    {msg.content && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? "text-cyan-100" : "text-gray-500"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Pending file preview */}
        {pendingFile && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              {isImageUrl(pendingFile.url) ? (
                <img src={pendingFile.url} alt="Preview" className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <span className="flex-1 text-sm text-gray-600 truncate">{pendingFile.name}</span>
              <button
                onClick={removePendingFile}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            {/* File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Прикрепить файл"
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className="flex-1 input resize-none"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={(!newMessage.trim() && !pendingFile) || isSending}
              className="btn btn-primary px-4"
            >
              {isSending ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Conversation List Component
interface ConversationListProps {
  onSelectConversation: (userId: number, userName: string) => void;
}

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await directMessagesApi.getConversations();
        setConversations(data.items);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, []);

  if (isLoading) {
    return <div className="text-gray-500 text-center py-4">Загрузка...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        <p>Нет личных сообщений</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <button
          key={conv.user_id}
          onClick={() => onSelectConversation(conv.user_id, conv.user_name)}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
        >
          <Avatar name={conv.user_name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{conv.user_name}</span>
              <span className="text-xs text-gray-500">
                {new Date(conv.last_message_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{conv.last_message}</p>
          </div>
          {conv.unread_count > 0 && (
            <span className="bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {conv.unread_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
