import { useCallback, useEffect, useRef, useState } from "react";

export type WhiteboardTool =
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "text"
  | "image"
  | "eraser";

export interface WhiteboardElement {
  id: string;
  type: "freehand" | "line" | "arrow" | "rect" | "circle" | "text" | "image";
  x: number;
  y: number;
  points?: { x: number; y: number }[];
  endX?: number;
  endY?: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
  imageUrl?: string;
  fontSize?: number;
  color: string;
  lineWidth: number;
  fill?: string;
}

interface UndoAction {
  type: "add" | "delete";
  element: WhiteboardElement;
}

export interface TextInputState {
  x: number;
  y: number;
  virtualX: number;
  virtualY: number;
}

export interface UseWhiteboardReturn {
  elements: WhiteboardElement[];
  activeTool: WhiteboardTool;
  setActiveTool: (tool: WhiteboardTool) => void;
  color: string;
  setColor: (color: string) => void;
  lineWidth: number;
  setLineWidth: (w: number) => void;
  draftElement: WhiteboardElement | null;
  textInput: TextInputState | null;
  handlePointerDown: (vx: number, vy: number) => void;
  handlePointerMove: (vx: number, vy: number) => void;
  handlePointerUp: () => void;
  commitText: (text: string) => WhiteboardElement | null;
  cancelText: () => void;
  addElement: (el: WhiteboardElement) => void;
  addElementLocal: (el: WhiteboardElement) => void;
  deleteElement: (id: string) => void;
  deleteElementLocal: (id: string) => void;
  clearAll: () => void;
  clearAllLocal: () => void;
  undo: () => UndoAction | null;
  redo: () => UndoAction | null;
  loadSnapshot: (elements: WhiteboardElement[]) => void;
  clearStorage: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const ERASER_RADIUS = 20;

function hitTest(
  el: WhiteboardElement,
  px: number,
  py: number,
): boolean {
  const r = ERASER_RADIUS;
  switch (el.type) {
    case "freehand": {
      if (!el.points) return false;
      for (const pt of el.points) {
        const dx = pt.x - px;
        const dy = pt.y - py;
        if (dx * dx + dy * dy < r * r) return true;
      }
      return false;
    }
    case "line":
    case "arrow": {
      const ex = el.endX ?? el.x;
      const ey = el.endY ?? el.y;
      return distToSegment(px, py, el.x, el.y, ex, ey) < r;
    }
    case "rect": {
      const w = el.width ?? 0;
      const h = el.height ?? 0;
      const left = Math.min(el.x, el.x + w);
      const right = Math.max(el.x, el.x + w);
      const top = Math.min(el.y, el.y + h);
      const bottom = Math.max(el.y, el.y + h);
      return px >= left - r && px <= right + r && py >= top - r && py <= bottom + r;
    }
    case "circle": {
      const rx = el.radiusX ?? 0;
      const ry = el.radiusY ?? 0;
      const cx = el.x;
      const cy = el.y;
      if (rx === 0 && ry === 0) return false;
      const nx = (px - cx) / (rx || 1);
      const ny = (py - cy) / (ry || 1);
      const dist = Math.sqrt(nx * nx + ny * ny);
      return Math.abs(dist - 1) < r / Math.max(rx, ry, 1);
    }
    case "text": {
      const fontSize = el.fontSize ?? 24;
      const approxW = (el.text?.length ?? 0) * fontSize * 0.6;
      const approxH = fontSize * 1.4;
      return px >= el.x - r && px <= el.x + approxW + r && py >= el.y - approxH - r && py <= el.y + r;
    }
    case "image": {
      const w = el.width ?? 200;
      const h = el.height ?? 200;
      return px >= el.x - r && px <= el.x + w + r && py >= el.y - r && py <= el.y + h + r;
    }
    default:
      return false;
  }
}

function distToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function useWhiteboard(sessionKey?: string): UseWhiteboardReturn {
  const storageKey = sessionKey ? `wb_${sessionKey}` : null;

  const loadFromStorage = (): WhiteboardElement[] => {
    if (!storageKey) return [];
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveToStorage = (els: WhiteboardElement[]) => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(els));
    } catch {
      // sessionStorage full or unavailable
    }
  };

  const [elements, setElements] = useState<WhiteboardElement[]>(loadFromStorage);
  const [activeTool, setActiveTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [draftElement, setDraftElement] = useState<WhiteboardElement | null>(null);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [undoVersion, setUndoVersion] = useState(0);

  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const isDrawing = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  // Persist elements to sessionStorage
  useEffect(() => {
    saveToStorage(elements);
  }, [elements]);

  const pushUndo = useCallback((action: UndoAction) => {
    undoStack.current.push(action);
    redoStack.current = [];
    setUndoVersion((v) => v + 1);
  }, []);

  const addElement = useCallback((el: WhiteboardElement) => {
    setElements((prev) => [...prev, el]);
    pushUndo({ type: "add", element: el });
  }, [pushUndo]);

  const addElementLocal = useCallback((el: WhiteboardElement) => {
    setElements((prev) => [...prev, el]);
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => {
      const el = prev.find((e) => e.id === id);
      if (el) {
        pushUndo({ type: "delete", element: el });
      }
      return prev.filter((e) => e.id !== id);
    });
  }, [pushUndo]);

  const deleteElementLocal = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setElements((prev) => {
      for (const el of prev) {
        undoStack.current.push({ type: "delete", element: el });
      }
      redoStack.current = [];
      setUndoVersion((v) => v + 1);
      return [];
    });
  }, []);

  const clearAllLocal = useCallback(() => {
    setElements([]);
    undoStack.current = [];
    redoStack.current = [];
    setUndoVersion((v) => v + 1);
  }, []);

  const undo = useCallback((): UndoAction | null => {
    const action = undoStack.current.pop();
    if (!action) return null;
    redoStack.current.push(action);
    setUndoVersion((v) => v + 1);

    if (action.type === "add") {
      setElements((prev) => prev.filter((e) => e.id !== action.element.id));
    } else {
      setElements((prev) => [...prev, action.element]);
    }
    return action;
  }, []);

  const redo = useCallback((): UndoAction | null => {
    const action = redoStack.current.pop();
    if (!action) return null;
    undoStack.current.push(action);
    setUndoVersion((v) => v + 1);

    if (action.type === "add") {
      setElements((prev) => [...prev, action.element]);
    } else {
      setElements((prev) => prev.filter((e) => e.id !== action.element.id));
    }
    return action;
  }, []);

  const loadSnapshot = useCallback((els: WhiteboardElement[]) => {
    setElements(els);
    undoStack.current = [];
    redoStack.current = [];
    setUndoVersion((v) => v + 1);
  }, []);

  const clearStorage = useCallback(() => {
    if (storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [storageKey]);

  const handlePointerDown = useCallback(
    (vx: number, vy: number) => {
      if (activeTool === "text") {
        setTextInput({ x: 0, y: 0, virtualX: vx, virtualY: vy });
        return;
      }

      if (activeTool === "image") return;

      if (activeTool === "eraser") {
        // Find and delete element under cursor
        setElements((prev) => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (hitTest(prev[i], vx, vy)) {
              const el = prev[i];
              pushUndo({ type: "delete", element: el });
              return prev.filter((e) => e.id !== el.id);
            }
          }
          return prev;
        });
        isDrawing.current = true;
        return;
      }

      isDrawing.current = true;
      startPoint.current = { x: vx, y: vy };

      if (activeTool === "pen") {
        setDraftElement({
          id: crypto.randomUUID(),
          type: "freehand",
          x: vx,
          y: vy,
          points: [{ x: vx, y: vy }],
          color,
          lineWidth,
        });
      } else {
        const typeMap: Record<string, WhiteboardElement["type"]> = {
          line: "line",
          arrow: "arrow",
          rect: "rect",
          circle: "circle",
        };
        setDraftElement({
          id: crypto.randomUUID(),
          type: typeMap[activeTool] || "line",
          x: vx,
          y: vy,
          endX: vx,
          endY: vy,
          width: 0,
          height: 0,
          radiusX: 0,
          radiusY: 0,
          color,
          lineWidth,
        });
      }
    },
    [activeTool, color, lineWidth, pushUndo],
  );

  const handlePointerMove = useCallback(
    (vx: number, vy: number) => {
      if (!isDrawing.current) return;

      if (activeTool === "eraser") {
        setElements((prev) => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (hitTest(prev[i], vx, vy)) {
              const el = prev[i];
              pushUndo({ type: "delete", element: el });
              return prev.filter((e) => e.id !== el.id);
            }
          }
          return prev;
        });
        return;
      }

      if (!draftElement || !startPoint.current) return;

      if (activeTool === "pen") {
        setDraftElement((prev) =>
          prev
            ? { ...prev, points: [...(prev.points || []), { x: vx, y: vy }] }
            : null,
        );
      } else if (activeTool === "line" || activeTool === "arrow") {
        setDraftElement((prev) =>
          prev ? { ...prev, endX: vx, endY: vy } : null,
        );
      } else if (activeTool === "rect") {
        setDraftElement((prev) =>
          prev
            ? {
                ...prev,
                width: vx - startPoint.current!.x,
                height: vy - startPoint.current!.y,
              }
            : null,
        );
      } else if (activeTool === "circle") {
        setDraftElement((prev) =>
          prev
            ? {
                ...prev,
                radiusX: Math.abs(vx - startPoint.current!.x),
                radiusY: Math.abs(vy - startPoint.current!.y),
              }
            : null,
        );
      }
    },
    [activeTool, draftElement, pushUndo],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (activeTool === "eraser") return;

    if (draftElement) {
      // Don't add zero-size shapes
      const isTooSmall =
        draftElement.type === "freehand"
          ? (draftElement.points?.length ?? 0) < 2
          : draftElement.type === "rect"
            ? Math.abs(draftElement.width ?? 0) < 2 && Math.abs(draftElement.height ?? 0) < 2
            : draftElement.type === "circle"
              ? (draftElement.radiusX ?? 0) < 2 && (draftElement.radiusY ?? 0) < 2
              : false;

      if (!isTooSmall) {
        addElement(draftElement);
      }
      setDraftElement(null);
    }
    startPoint.current = null;
  }, [activeTool, draftElement, addElement]);

  const commitText = useCallback(
    (text: string): WhiteboardElement | null => {
      if (!textInput || !text.trim()) {
        setTextInput(null);
        return null;
      }
      const el: WhiteboardElement = {
        id: crypto.randomUUID(),
        type: "text",
        x: textInput.virtualX,
        y: textInput.virtualY,
        text: text.trim(),
        fontSize: 24,
        color,
        lineWidth: 1,
      };
      addElement(el);
      setTextInput(null);
      return el;
    },
    [textInput, color, addElement],
  );

  const cancelText = useCallback(() => {
    setTextInput(null);
  }, []);

  void undoVersion; // used to trigger re-render for canUndo/canRedo

  return {
    elements,
    activeTool,
    setActiveTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    draftElement,
    textInput,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    commitText,
    cancelText,
    addElement,
    addElementLocal,
    deleteElement,
    deleteElementLocal,
    clearAll,
    clearAllLocal,
    undo,
    redo,
    loadSnapshot,
    clearStorage,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
