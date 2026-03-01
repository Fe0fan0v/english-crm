import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useLiveSession } from "../hooks/useLiveSession";
import { useWhiteboard } from "../hooks/useWhiteboard";
import type { WhiteboardTool, WhiteboardElement } from "../hooks/useWhiteboard";
import WhiteboardCanvas from "../components/WhiteboardCanvas";
import { courseUploadApi } from "../services/courseApi";

const COLORS = ["#000000", "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];
const LINE_WIDTHS = [2, 4, 8];

const TOOL_CONFIG: { tool: WhiteboardTool; label: string; icon: string }[] = [
  { tool: "pen", label: "Карандаш", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
  { tool: "line", label: "Линия", icon: "M4 20L20 4" },
  { tool: "arrow", label: "Стрелка", icon: "M17 8l4 4m0 0l-4 4m4-4H3" },
  { tool: "rect", label: "Прямоугольник", icon: "M4 6h16v12H4z" },
  { tool: "circle", label: "Круг", icon: "M12 12m-9 0a9 9 0 1018 0a9 9 0 10-18 0" },
  { tool: "text", label: "Текст", icon: "M4 6h16M8 6v12m4-12v12" },
  { tool: "image", label: "Изображение", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { tool: "eraser", label: "Ластик", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
];

function getCursorForTool(tool: WhiteboardTool): string {
  switch (tool) {
    case "pen":
    case "line":
    case "arrow":
      return "crosshair";
    case "rect":
    case "circle":
      return "crosshair";
    case "text":
      return "text";
    case "eraser":
      return "pointer";
    case "image":
      return "default";
    default:
      return "default";
  }
}

export default function WhiteboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const sessionLessonId = searchParams.get("session");
  const interactiveLessonId = searchParams.get("lesson");
  const isStudent = user?.role === "student";
  const isTeacher = !isStudent;

  const [textValue, setTextValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wb = useWhiteboard(sessionLessonId || undefined);

  const liveSession = useLiveSession(
    sessionLessonId ? Number(sessionLessonId) : null,
    {
      onWhiteboardAdd: (element: WhiteboardElement) => {
        wb.addElementLocal(element);
      },
      onWhiteboardDelete: (id: string) => {
        wb.deleteElementLocal(id);
      },
      onWhiteboardClear: () => {
        wb.clearAllLocal();
      },
      onWhiteboardSnapshot: (elements: WhiteboardElement[]) => {
        wb.loadSnapshot(elements);
      },
      onWhiteboardClose: () => {
        // Navigate back to lesson
        if (interactiveLessonId && sessionLessonId) {
          navigate(`/courses/lessons/${interactiveLessonId}?session=${sessionLessonId}`);
        } else {
          navigate(-1);
        }
      },
      onPeerJoined: () => {
        // Teacher sends wb_open + snapshot when student joins
        if (isTeacher) {
          liveSession.sendWbOpen();
          liveSession.sendWbSnapshot(wb.elements);
        }
      },
      onSessionEnd: () => {
        wb.clearStorage();
        navigate('/schedule');
      },
    },
  );

  // Notify that whiteboard is open on connect
  const sentOpenRef = useRef(false);
  useEffect(() => {
    if (liveSession.isConnected && isTeacher && !sentOpenRef.current) {
      sentOpenRef.current = true;
      liveSession.sendWbOpen();
    }
  }, [liveSession.isConnected, isTeacher]);

  // Teacher: intercept add/delete/clear to also send via WS
  const handlePointerDown = useCallback(
    (vx: number, vy: number) => {
      if (isStudent) return;
      wb.handlePointerDown(vx, vy);
    },
    [isStudent, wb.handlePointerDown],
  );

  const handlePointerMove = useCallback(
    (vx: number, vy: number) => {
      if (isStudent) return;
      wb.handlePointerMove(vx, vy);
    },
    [isStudent, wb.handlePointerMove],
  );

  const handlePointerUp = useCallback(() => {
    if (isStudent) return;
    const draft = wb.draftElement;
    wb.handlePointerUp();
    // Send committed shape via WS (eraser/text handled separately)
    if (draft && wb.activeTool !== "eraser" && wb.activeTool !== "text") {
      setTimeout(() => liveSession.sendWbAdd(draft), 0);
    }
  }, [isStudent, wb.handlePointerUp, wb.draftElement, wb.activeTool, liveSession]);

  const handleTextCommit = useCallback(() => {
    const el = wb.commitText(textValue);
    if (el) {
      liveSession.sendWbAdd(el);
    }
    setTextValue("");
  }, [wb.commitText, textValue, liveSession]);

  const handleTextCancel = useCallback(() => {
    wb.cancelText();
    setTextValue("");
  }, [wb.cancelText]);

  const handleUndo = useCallback(() => {
    const action = wb.undo();
    if (action) {
      if (action.type === "add") {
        liveSession.sendWbDelete(action.element.id);
      } else {
        liveSession.sendWbAdd(action.element);
      }
    }
  }, [wb.undo, liveSession]);

  const handleRedo = useCallback(() => {
    const action = wb.redo();
    if (action) {
      if (action.type === "add") {
        liveSession.sendWbAdd(action.element);
      } else {
        liveSession.sendWbDelete(action.element.id);
      }
    }
  }, [wb.redo, liveSession]);

  const handleClear = useCallback(() => {
    wb.clearAll();
    liveSession.sendWbClear();
  }, [wb.clearAll, liveSession]);

  // Track eraser deletions (eraser modifies elements directly) and sync via WS
  const prevElementsRef = useRef<WhiteboardElement[]>([]);
  useEffect(() => {
    const prev = prevElementsRef.current;
    const curr = wb.elements;
    if (isTeacher && prev.length > curr.length) {
      const currIds = new Set(curr.map((e) => e.id));
      for (const el of prev) {
        if (!currIds.has(el.id)) {
          liveSession.sendWbDelete(el.id);
        }
      }
    }
    prevElementsRef.current = curr;
  }, [wb.elements, isTeacher, liveSession]);

  const handleImageUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setUploading(true);
        const result = await courseUploadApi.upload(file);
        const img = new Image();
        img.src = result.file_url;
        img.onload = () => {
          // Scale to fit within reasonable size
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          const maxSize = 400;
          if (w > maxSize || h > maxSize) {
            const scale = maxSize / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          const el: WhiteboardElement = {
            id: crypto.randomUUID(),
            type: "image",
            x: 960 - w / 2,
            y: 540 - h / 2,
            width: w,
            height: h,
            imageUrl: result.file_url,
            color: "#000",
            lineWidth: 1,
          };
          wb.addElement(el);
          liveSession.sendWbAdd(el);
          setUploading(false);
        };
        img.onerror = () => {
          setUploading(false);
          alert("Ошибка загрузки изображения");
        };
      } catch {
        setUploading(false);
        alert("Ошибка загрузки файла");
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [wb.addElement, liveSession],
  );

  const handleExportPng = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      ".whiteboard-canvas-area canvas",
    );
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "whiteboard.png";
    a.click();
  }, []);

  const handleBack = useCallback(() => {
    if (isTeacher) {
      liveSession.sendWbClose();
    }
    if (interactiveLessonId && sessionLessonId) {
      navigate(`/courses/lessons/${interactiveLessonId}?session=${sessionLessonId}`);
    } else {
      navigate(-1);
    }
  }, [isTeacher, liveSession, interactiveLessonId, sessionLessonId, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    if (isStudent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isStudent, handleUndo, handleRedo]);

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 overflow-x-auto">
        {/* Tools */}
        {isTeacher && (
          <>
            {TOOL_CONFIG.map(({ tool, label, icon }) => (
              <button
                key={tool}
                onClick={() => {
                  if (tool === "image") {
                    handleImageUpload();
                  } else {
                    wb.setActiveTool(tool);
                  }
                }}
                disabled={uploading && tool === "image"}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  wb.activeTool === tool && tool !== "image"
                    ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                    : "text-gray-600 hover:bg-gray-100"
                } ${uploading && tool === "image" ? "opacity-50" : ""}`}
                title={label}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Colors */}
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => wb.setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${
                  wb.color === c ? "border-gray-800 scale-110" : "border-gray-200 hover:border-gray-400"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Line widths */}
            {LINE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => wb.setLineWidth(w)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  wb.lineWidth === w
                    ? "bg-gray-200 text-gray-800"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                title={`Толщина ${w}`}
              >
                <div
                  className="bg-current rounded-full mx-auto"
                  style={{ width: Math.max(w * 2, 6), height: Math.max(w * 2, 6) }}
                />
              </button>
            ))}

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Undo/Redo */}
            <button
              onClick={handleUndo}
              disabled={!wb.canUndo}
              className="px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="Отменить (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={!wb.canRedo}
              className="px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="Повторить (Ctrl+Y)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Clear */}
            <button
              onClick={handleClear}
              className="px-2 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              title="Очистить всё"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            {/* Export PNG */}
            <button
              onClick={handleExportPng}
              className="px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title="Экспорт PNG"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          </>
        )}

        {/* Student: read-only badge */}
        {isStudent && (
          <span className="text-sm text-gray-500 px-2">
            Доска (просмотр)
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Connection status */}
        <div className="flex items-center gap-2 mr-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                liveSession.isConnected ? "animate-ping bg-green-400" : "bg-red-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                liveSession.isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
          <span className="text-xs text-gray-500">
            {isTeacher
              ? liveSession.peersConnected > 0
                ? liveSession.peersConnected > 1
                  ? `Учеников: ${liveSession.peersConnected}`
                  : "Ученик онлайн"
                : "Ожидание..."
              : liveSession.peerConnected ? "Учитель онлайн" : "Ожидание..."}
          </span>
        </div>

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Назад
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-h-0 whiteboard-canvas-area">
        <WhiteboardCanvas
          elements={wb.elements}
          draftElement={wb.draftElement}
          textInput={wb.textInput}
          textValue={textValue}
          onTextChange={setTextValue}
          onTextCommit={handleTextCommit}
          onTextCancel={handleTextCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          readOnly={isStudent}
          cursorStyle={isTeacher ? getCursorForTool(wb.activeTool) : "default"}
        />
      </div>

      {/* Uploading overlay */}
      {uploading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-700">Загрузка изображения...</span>
          </div>
        </div>
      )}
    </div>
  );
}
