import { useEffect, useRef, useCallback } from "react";
import type { WhiteboardElement, TextInputState } from "../hooks/useWhiteboard";

const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;

interface WhiteboardCanvasProps {
  elements: WhiteboardElement[];
  draftElement: WhiteboardElement | null;
  textInput: TextInputState | null;
  textValue: string;
  onTextChange: (val: string) => void;
  onTextCommit: () => void;
  onTextCancel: () => void;
  onPointerDown: (vx: number, vy: number) => void;
  onPointerMove: (vx: number, vy: number) => void;
  onPointerUp: () => void;
  readOnly?: boolean;
  cursorStyle?: string;
}

export default function WhiteboardCanvas({
  elements,
  draftElement,
  textInput,
  textValue,
  onTextChange,
  onTextCommit,
  onTextCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  readOnly,
  cursorStyle,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getTransform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { scale: 1, offsetX: 0, offsetY: 0 };
    const cw = canvas.width;
    const ch = canvas.height;
    const scaleX = cw / VIRTUAL_W;
    const scaleY = ch / VIRTUAL_H;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (cw - VIRTUAL_W * scale) / 2;
    const offsetY = (ch - VIRTUAL_H * scale) / 2;
    scaleRef.current = scale;
    offsetRef.current = { x: offsetX, y: offsetY };
    return { scale, offsetX, offsetY };
  }, []);

  const toVirtual = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const px = (clientX - rect.left) * (canvas.width / rect.width);
      const py = (clientY - rect.top) * (canvas.height / rect.height);
      const { scale, offsetX, offsetY } = getTransform();
      return {
        x: (px - offsetX) / scale,
        y: (py - offsetY) / scale,
      };
    },
    [getTransform],
  );

  const virtualToScreen = useCallback(
    (vx: number, vy: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const { scale, offsetX, offsetY } = getTransform();
      const px = vx * scale + offsetX;
      const py = vy * scale + offsetY;
      return {
        x: (px / canvas.width) * rect.width,
        y: (py / canvas.height) * rect.height,
      };
    },
    [getTransform],
  );

  const loadImage = useCallback((url: string): HTMLImageElement | null => {
    const cached = imageCache.current.get(url);
    if (cached && cached.complete) return cached;
    if (!cached) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        // Trigger re-render on load
        requestAnimationFrame(() => render());
      };
      imageCache.current.set(url, img);
    }
    return null;
  }, []);

  const renderElement = useCallback(
    (ctx: CanvasRenderingContext2D, el: WhiteboardElement) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (el.type) {
        case "freehand": {
          if (!el.points || el.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
          break;
        }
        case "line": {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.endX ?? el.x, el.endY ?? el.y);
          ctx.stroke();
          break;
        }
        case "arrow": {
          const ex = el.endX ?? el.x;
          const ey = el.endY ?? el.y;
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          // Arrowhead
          const angle = Math.atan2(ey - el.y, ex - el.x);
          const headLen = 15 + el.lineWidth * 2;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(
            ex - headLen * Math.cos(angle - Math.PI / 6),
            ey - headLen * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            ex - headLen * Math.cos(angle + Math.PI / 6),
            ey - headLen * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          const w = el.width ?? 0;
          const h = el.height ?? 0;
          if (el.fill) {
            ctx.fillStyle = el.fill;
            ctx.fillRect(el.x, el.y, w, h);
          }
          ctx.strokeRect(el.x, el.y, w, h);
          break;
        }
        case "circle": {
          const rx = el.radiusX ?? 0;
          const ry = el.radiusY ?? 0;
          ctx.beginPath();
          ctx.ellipse(el.x, el.y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
          if (el.fill) {
            ctx.fillStyle = el.fill;
            ctx.fill();
          }
          ctx.stroke();
          break;
        }
        case "text": {
          const fontSize = el.fontSize ?? 24;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = el.color;
          const lines = (el.text ?? "").split("\n");
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], el.x, el.y + fontSize * (i + 1));
          }
          break;
        }
        case "image": {
          if (!el.imageUrl) break;
          const img = loadImage(el.imageUrl);
          if (img) {
            ctx.drawImage(img, el.x, el.y, el.width ?? 200, el.height ?? 200);
          } else {
            // Placeholder
            ctx.strokeStyle = "#ccc";
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(el.x, el.y, el.width ?? 200, el.height ?? 200);
            ctx.setLineDash([]);
          }
          break;
        }
      }
    },
    [loadImage],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { scale, offsetX, offsetY } = getTransform();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard background within virtual area
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // Render all elements
    for (const el of elements) {
      ctx.save();
      renderElement(ctx, el);
      ctx.restore();
    }

    // Render draft
    if (draftElement) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      renderElement(ctx, draftElement);
      ctx.restore();
    }

    ctx.restore();
  }, [elements, draftElement, getTransform, renderElement]);

  // Resize canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      render();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  // Render on elements change
  useEffect(() => {
    render();
  }, [render]);

  // Focus textarea when text input opens
  useEffect(() => {
    if (textInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [textInput]);

  // Mouse/touch handlers
  const handlePointerDownEvent = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const v = toVirtual(e.clientX, e.clientY);
      onPointerDown(v.x, v.y);
    },
    [readOnly, toVirtual, onPointerDown],
  );

  const handlePointerMoveEvent = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      const v = toVirtual(e.clientX, e.clientY);
      onPointerMove(v.x, v.y);
    },
    [readOnly, toVirtual, onPointerMove],
  );

  const handlePointerUpEvent = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onPointerUp();
    },
    [readOnly, onPointerUp],
  );

  // Compute textarea position from virtual coords
  const textScreenPos = textInput ? virtualToScreen(textInput.virtualX, textInput.virtualY) : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ cursor: cursorStyle || "default" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDownEvent}
        onPointerMove={handlePointerMoveEvent}
        onPointerUp={handlePointerUpEvent}
      />

      {/* Text input overlay */}
      {textInput && textScreenPos && (
        <textarea
          ref={textareaRef}
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onTextCommit();
            }
            if (e.key === "Escape") {
              onTextCancel();
            }
          }}
          onBlur={onTextCommit}
          className="absolute bg-white/90 border-2 border-purple-400 rounded px-2 py-1 text-base outline-none resize-none min-w-[120px] min-h-[36px] z-10"
          style={{
            left: textScreenPos.x,
            top: textScreenPos.y,
            fontSize: `${Math.round(24 * scaleRef.current)}px`,
          }}
          placeholder="Введите текст..."
        />
      )}
    </div>
  );
}
