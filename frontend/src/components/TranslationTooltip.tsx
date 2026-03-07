import { useState, useCallback, useRef, useEffect } from "react";
import { vocabularyApi, type TranslationResult } from "../services/api";

const cache = new Map<string, TranslationResult>();

function getWordAtPoint(e: MouseEvent): string | null {
  const target = e.target as HTMLElement;
  if (!target || !target.textContent) return null;
  // Don't translate inside inputs, buttons, selects
  const tag = target.tagName.toLowerCase();
  if (["input", "textarea", "select", "button"].includes(tag)) return null;

  // Use caretPositionFromPoint or caretRangeFromPoint
  let range: Range | null = null;
  const doc = document as unknown as Record<string, unknown>;
  if (typeof doc.caretRangeFromPoint === "function") {
    range = (doc.caretRangeFromPoint as (x: number, y: number) => Range | null)(e.clientX, e.clientY);
  }
  if (!range) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent || "";
  const offset = range.startOffset;

  // Extract word boundaries
  let start = offset;
  let end = offset;
  while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
  while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;

  const word = text.slice(start, end).replace(/^['-]+|['-]+$/g, "");
  if (word.length < 2 || !/^[a-zA-Z]/.test(word)) return null;
  return word.toLowerCase();
}

export default function TranslationTooltip({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: TranslationResult;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef(false);
  const currentWordRef = useRef<string | null>(null);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
    currentWordRef.current = null;
    abortRef.current = true;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const word = getWordAtPoint(e);

      if (!word) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (currentWordRef.current) hideTooltip();
        return;
      }

      if (word === currentWordRef.current) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      currentWordRef.current = word;
      abortRef.current = false;

      timeoutRef.current = setTimeout(async () => {
        if (abortRef.current) return;

        // Check cache
        if (cache.has(word)) {
          const data = cache.get(word)!;
          if (data.definitions.length > 0) {
            setTooltip({ x: e.clientX, y: e.clientY, data });
          }
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const data = await vocabularyApi.translate(word);
          cache.set(word, data);
          if (!abortRef.current && data.definitions.length > 0) {
            setTooltip({ x: e.clientX, y: e.clientY, data });
          }
        } catch {
          // ignore
        } finally {
          if (!abortRef.current) setLoading(false);
        }
      }, 400);
    },
    [hideTooltip],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", hideTooltip);
    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", hideTooltip);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleMouseMove, hideTooltip]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {(tooltip || loading) && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltip ? Math.min(tooltip.x, window.innerWidth - 280) : 0,
            top: tooltip ? tooltip.y + 20 : 0,
          }}
        >
          {loading && !tooltip && (
            <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
              ...
            </div>
          )}
          {tooltip && (
            <div className="bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-[260px]">
              <div className="font-medium mb-1">
                {tooltip.data.word}
                {tooltip.data.ts && (
                  <span className="ml-1.5 text-gray-400 font-normal text-xs">
                    [{tooltip.data.ts}]
                  </span>
                )}
              </div>
              {tooltip.data.definitions.map((def, i) => (
                <div key={i} className="text-gray-200">
                  {def.pos && (
                    <span className="text-gray-400 italic text-xs mr-1">
                      {def.pos}
                    </span>
                  )}
                  {def.tr.join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
