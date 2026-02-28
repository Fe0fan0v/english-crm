import { useCallback, useEffect, useRef, useState } from "react";
import { liveSessionApi } from "../services/liveSessionApi";
import type { ExerciseResultDetails } from "../types/course";
import type { WhiteboardElement } from "./useWhiteboard";

export interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface LiveSessionCallbacks {
  onAnswerChange?: (blockId: number, answer: unknown) => void;
  onCheck?: (blockId: number, serverDetails?: ExerciseResultDetails) => void;
  onReset?: (blockId: number) => void;
  onPageChange?: (page: number) => void;
  onMediaControl?: (blockId: number, action: string, time?: number) => void;
  onScrollTo?: (scrollPercent: number, page?: number) => void;
  onStateSnapshot?: (state: FullState) => void;
  onSessionEnd?: (reason: string) => void;
  onPeerJoined?: (role: string, name: string) => void;
  onPeerDisconnected?: (role: string) => void;
  onDrawingStroke?: (stroke: DrawingStroke) => void;
  onDrawingClear?: () => void;
  onWhiteboardOpen?: () => void;
  onWhiteboardClose?: () => void;
  onWhiteboardAdd?: (element: WhiteboardElement) => void;
  onWhiteboardDelete?: (id: string) => void;
  onWhiteboardClear?: () => void;
  onWhiteboardSnapshot?: (elements: WhiteboardElement[]) => void;
}

export interface FullState {
  answers: Record<number, unknown>;
  checked: Record<number, boolean>;
  serverDetails: Record<number, ExerciseResultDetails>;
  current_page: number;
}

export interface RemoteCursorData {
  x: number;
  y: number;
  visible: boolean;
}

export interface UseLiveSessionReturn {
  isConnected: boolean;
  peerConnected: boolean;
  remoteCursor: RemoteCursorData | null;
  sendAnswerChange: (blockId: number, answer: unknown) => void;
  sendCheck: (blockId: number, serverDetails?: ExerciseResultDetails) => void;
  sendReset: (blockId: number) => void;
  sendPageChange: (page: number) => void;
  sendMediaControl: (blockId: number, action: string, time?: number) => void;
  sendScrollTo: (scrollPercent: number, page?: number) => void;
  sendStateSnapshot: (state: FullState) => void;
  sendCursorMove: (x: number, y: number) => void;
  sendCursorHide: () => void;
  sendDrawingStroke: (stroke: DrawingStroke) => void;
  sendDrawingClear: () => void;
  sendWbOpen: () => void;
  sendWbClose: () => void;
  sendWbAdd: (element: WhiteboardElement) => void;
  sendWbDelete: (id: string) => void;
  sendWbClear: () => void;
  sendWbSnapshot: (elements: WhiteboardElement[]) => void;
  endSession: () => void;
}

export function useLiveSession(
  lessonId: number | null,
  callbacks: LiveSessionCallbacks,
): UseLiveSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursorData | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Throttle cursor via rAF
  const cursorRaf = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!lessonId) return;

    const url = liveSessionApi.getWsUrl(lessonId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // Start heartbeat
      pingInterval.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;

      try {
        const msg = JSON.parse(event.data);
        const cb = callbacksRef.current;

        switch (msg.type) {
          case "peer_joined":
          case "peer_reconnected":
            setPeerConnected(true);
            cb.onPeerJoined?.(msg.role, msg.name);
            break;

          case "peer_disconnected":
            setPeerConnected(false);
            setRemoteCursor(null);
            cb.onPeerDisconnected?.(msg.role);
            break;

          case "session_end":
            cb.onSessionEnd?.(msg.reason);
            break;

          case "cursor_move":
            setRemoteCursor({ x: msg.x, y: msg.y, visible: msg.visible ?? true });
            break;

          case "answer_change":
            cb.onAnswerChange?.(msg.block_id, msg.answer);
            break;

          case "answer_check":
            cb.onCheck?.(msg.block_id, msg.server_details);
            break;

          case "answer_reset":
            cb.onReset?.(msg.block_id);
            break;

          case "page_change":
            cb.onPageChange?.(msg.page);
            break;

          case "media_control":
            cb.onMediaControl?.(msg.block_id, msg.action, msg.time);
            break;

          case "scroll_to":
            cb.onScrollTo?.(msg.scroll_percent, msg.page);
            break;

          case "state_snapshot":
            cb.onStateSnapshot?.(msg as unknown as FullState);
            break;

          case "drawing_stroke":
            cb.onDrawingStroke?.({ points: msg.points, color: msg.color, width: msg.width });
            break;

          case "drawing_clear":
            cb.onDrawingClear?.();
            break;

          case "wb_open":
            cb.onWhiteboardOpen?.();
            break;

          case "wb_close":
            cb.onWhiteboardClose?.();
            break;

          case "wb_add":
            cb.onWhiteboardAdd?.(msg.element);
            break;

          case "wb_delete":
            cb.onWhiteboardDelete?.(msg.id);
            break;

          case "wb_clear":
            cb.onWhiteboardClear?.();
            break;

          case "wb_snapshot":
            cb.onWhiteboardSnapshot?.(msg.elements);
            break;
        }
      } catch {
        // Ignore invalid JSON
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }

      // Auto-reconnect with exponential backoff
      if (reconnectAttempts.current < 10) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // Will trigger onclose
    };
  }, [lessonId]);

  useEffect(() => {
    if (lessonId) {
      connect();
    }

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      if (cursorRaf.current) {
        cancelAnimationFrame(cursorRaf.current);
      }
      // Set high limit to prevent auto-reconnect on unmount
      reconnectAttempts.current = 999;
      wsRef.current?.close();
    };
  }, [lessonId, connect]);

  const sendAnswerChange = useCallback(
    (blockId: number, answer: unknown) => {
      send({ type: "answer_change", block_id: blockId, answer });
    },
    [send],
  );

  const sendCheck = useCallback(
    (blockId: number, serverDetails?: ExerciseResultDetails) => {
      send({ type: "answer_check", block_id: blockId, server_details: serverDetails });
    },
    [send],
  );

  const sendReset = useCallback(
    (blockId: number) => {
      send({ type: "answer_reset", block_id: blockId });
    },
    [send],
  );

  const sendPageChange = useCallback(
    (page: number) => {
      send({ type: "page_change", page });
    },
    [send],
  );

  const sendMediaControl = useCallback(
    (blockId: number, action: string, time?: number) => {
      send({ type: "media_control", block_id: blockId, action, time });
    },
    [send],
  );

  const sendScrollTo = useCallback(
    (scrollPercent: number, page?: number) => {
      send({ type: "scroll_to", scroll_percent: scrollPercent, page });
    },
    [send],
  );

  const sendStateSnapshot = useCallback(
    (state: FullState) => {
      send({
        type: "state_snapshot",
        answers: state.answers,
        checked: state.checked,
        serverDetails: state.serverDetails,
        current_page: state.current_page,
      });
    },
    [send],
  );

  const sendCursorMove = useCallback(
    (x: number, y: number) => {
      pendingCursor.current = { x, y };
      if (!cursorRaf.current) {
        cursorRaf.current = requestAnimationFrame(() => {
          cursorRaf.current = null;
          if (pendingCursor.current) {
            send({ type: "cursor_move", x: pendingCursor.current.x, y: pendingCursor.current.y, visible: true });
            pendingCursor.current = null;
          }
        });
      }
    },
    [send],
  );

  const sendCursorHide = useCallback(() => {
    send({ type: "cursor_move", x: 0, y: 0, visible: false });
  }, [send]);

  const sendDrawingStroke = useCallback(
    (stroke: DrawingStroke) => {
      send({ type: "drawing_stroke", points: stroke.points, color: stroke.color, width: stroke.width });
    },
    [send],
  );

  const sendDrawingClear = useCallback(() => {
    send({ type: "drawing_clear" });
  }, [send]);

  const sendWbOpen = useCallback(() => {
    send({ type: "wb_open" });
  }, [send]);

  const sendWbClose = useCallback(() => {
    send({ type: "wb_close" });
  }, [send]);

  const sendWbAdd = useCallback(
    (element: WhiteboardElement) => {
      send({ type: "wb_add", element });
    },
    [send],
  );

  const sendWbDelete = useCallback(
    (id: string) => {
      send({ type: "wb_delete", id });
    },
    [send],
  );

  const sendWbClear = useCallback(() => {
    send({ type: "wb_clear" });
  }, [send]);

  const sendWbSnapshot = useCallback(
    (elements: WhiteboardElement[]) => {
      send({ type: "wb_snapshot", elements });
    },
    [send],
  );

  const endSession = useCallback(() => {
    if (lessonId) {
      liveSessionApi.endSession(lessonId).catch(() => {});
    }
  }, [lessonId]);

  return {
    isConnected,
    peerConnected,
    remoteCursor,
    sendAnswerChange,
    sendCheck,
    sendReset,
    sendPageChange,
    sendMediaControl,
    sendScrollTo,
    sendStateSnapshot,
    sendCursorMove,
    sendCursorHide,
    sendDrawingStroke,
    sendDrawingClear,
    sendWbOpen,
    sendWbClose,
    sendWbAdd,
    sendWbDelete,
    sendWbClear,
    sendWbSnapshot,
    endSession,
  };
}
