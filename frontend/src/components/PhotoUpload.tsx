import { useRef, useState } from "react";
import { usersApi } from "../services/api";
import Avatar from "./Avatar";

interface PhotoUploadProps {
  userId: number;
  userName: string;
  currentPhotoUrl: string | null;
  onPhotoUpdated: (newPhotoUrl: string | null) => void;
  size?: "md" | "lg" | "xl";
  canEdit?: boolean;
}

export default function PhotoUpload({
  userId,
  userName,
  currentPhotoUrl,
  onPhotoUpdated,
  size = "xl",
  canEdit = true,
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Разрешены только изображения (JPEG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("Максимальный размер файла: 5MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const updatedUser = await usersApi.uploadPhoto(userId, file);
      onPhotoUpdated(updatedUser.photo_url);
    } catch (err: unknown) {
      console.error("Failed to upload photo:", err);
      const errorMessage = err instanceof Error ? err.message : "Не удалось загрузить фото";
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!currentPhotoUrl) return;
    if (!confirm("Удалить фото профиля?")) return;

    setIsUploading(true);
    setError(null);

    try {
      await usersApi.deletePhoto(userId);
      onPhotoUpdated(null);
    } catch (err: unknown) {
      console.error("Failed to delete photo:", err);
      const errorMessage = err instanceof Error ? err.message : "Не удалось удалить фото";
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar name={userName} photo={currentPhotoUrl} size={size} />

        {canEdit && !isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-white hover:text-cyan-300 transition-colors"
              title="Загрузить фото"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {canEdit && (
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-secondary btn-sm"
          >
            {currentPhotoUrl ? "Изменить фото" : "Загрузить фото"}
          </button>
          {currentPhotoUrl && (
            <button
              onClick={handleDeletePhoto}
              disabled={isUploading}
              className="btn btn-danger btn-sm"
            >
              Удалить
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
