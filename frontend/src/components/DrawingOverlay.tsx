import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawingStroke } from "../hooks/useLiveSession";

interface DrawingOverlayProps {
  /** Teacher can draw, student views read-only */
  isTeacher: boolean;
  /** Callback when teacher finishes a stroke */
  onStroke?: (stroke: DrawingStroke) => void;
  /** Callback when teacher clears canvas */
  onClear?: () => void;
  /** Remote strokes from WebSocket (for student) */
  remoteStrokes: DrawingStroke[];
}

const COLORS = [
  { value: "#ef4444", label: "Красный" },
  { value: "#3b82f6", label: "Синий" },
  { value: "#22c55e", label: "Зелёный" },
  { value: "#1f2937", label: "Чёрный" },
];

const WIDTHS = [2, 4, 6];

export default function DrawingOverlay({
  isTeacher,
  onStroke,
  onClear,
  remoteStrokes,
}: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const localStrokes = useRef<DrawingStroke[]>([]);

  // Resize canvas to match parent
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes (local + remote)
    const allStrokes = isTeacher ? localStrokes.current : remoteStrokes;
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height);
    }
  }, [isTeacher, remoteStrokes]);

  const drawStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: DrawingStroke,
    _w: number,
    _h: number,
  ) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  // Observe resize
  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // Redraw when remote strokes change
  useEffect(() => {
    redraw();
  }, [remoteStrokes, redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingEnabled || !isTeacher) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    currentPoints.current = [pos];
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !drawingEnabled) return;
    e.preventDefault();
    const pos = getPos(e);
    currentPoints.current.push(pos);

    // Draw current stroke in real time
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const points = currentPoints.current;
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.current.length >= 2) {
      const stroke: DrawingStroke = {
        points: [...currentPoints.current],
        color,
        width: lineWidth,
      };
      localStrokes.current.push(stroke);
      onStroke?.(stroke);
    }
    currentPoints.current = [];
  };

  const handleClear = () => {
    localStrokes.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onClear?.();
  };

  return (
    <>
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30"
        style={{ pointerEvents: drawingEnabled && isTeacher ? "auto" : "none" }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {/* Toolbar — only for teacher */}
      {isTeacher && (
        <div className="fixed top-16 right-4 z-40 flex items-center gap-1.5 bg-white/90 backdrop-blur rounded-lg shadow-md p-1.5 border border-gray-200">
          {/* Toggle drawing */}
          <button
            onClick={() => setDrawingEnabled(!drawingEnabled)}
            className={`p-1.5 rounded transition-colors ${
              drawingEnabled ? "bg-purple-500 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
            title={drawingEnabled ? "Выключить рисование" : "Включить рисование"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {drawingEnabled && (
            <>
              {/* Separator */}
              <div className="w-px h-5 bg-gray-300" />

              {/* Colors */}
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}

              <div className="w-px h-5 bg-gray-300" />

              {/* Width */}
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  className={`p-1 rounded transition-colors ${
                    lineWidth === w ? "bg-gray-200" : "hover:bg-gray-100"
                  }`}
                  title={`Толщина ${w}`}
                >
                  <div
                    className="rounded-full bg-gray-700"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}

              <div className="w-px h-5 bg-gray-300" />

              {/* Clear */}
              <button
                onClick={handleClear}
                className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                title="Очистить всё"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
