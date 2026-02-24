import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { interactiveLessonApi, exerciseResultApi } from "../services/courseApi";
import { useAuthStore } from "../store/authStore";
import { useLiveSession } from "../hooks/useLiveSession";
import type {
  InteractiveLessonDetail,
  ExerciseBlock,
  ExerciseResultDetails,
} from "../types/course";
import BlockRenderer from "../components/blocks/BlockRenderer";
import RemoteCursor from "../components/RemoteCursor";

// Block type labels for the sidebar
const BLOCK_TYPE_ICONS: Record<string, string> = {
  text: "",
  image: "",
  video: "",
  audio: "",
  fill_gaps: "",
  test: "",
  true_false: "",
  word_order: "",
  matching: "",
  essay: "",
  flashcards: "",
  vocabulary: "",
  article: "",
  table: "",
  image_choice: "",
  remember: "",
  teaching_guide: "",
  divider: "",
  page_break: "",
};

interface NavItem {
  id: number;
  title: string;
  blockType: string;
  index: number;
}

export default function LessonPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [lesson, setLesson] = useState<InteractiveLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [serverDetails, setServerDetails] = useState<
    Record<number, ExerciseResultDetails>
  >({});
  const savedBlockIds = useRef<Set<number>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const isStudent = user?.role === "student";

  // Live Session
  const sessionLessonId = searchParams.get("session");
  const isLiveMode = !!sessionLessonId;
  const isTeacherLive = isLiveMode && !isStudent;
  const isStudentLive = isLiveMode && isStudent;

  const [mediaCommands, setMediaCommands] = useState<Record<number, { action: string; time?: number }>>({});

  const liveSession = useLiveSession(
    isLiveMode ? Number(sessionLessonId) : null,
    {
      onMediaControl: (blockId, action, time) => {
        setMediaCommands((prev) => ({ ...prev, [blockId]: { action, time } }));
      },
      onScrollTo: (scrollPercent, page) => {
        const doScroll = () => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: maxScroll * (scrollPercent / 100), behavior: "smooth" });
        };
        if (page !== undefined && page !== currentPage) {
          setCurrentPage(page);
          // Wait for DOM to update after page switch, then scroll
          setTimeout(doScroll, 100);
        } else {
          doScroll();
        }
      },
      onAnswerChange: (blockId, answer) => {
        if (isTeacherLive) {
          setAnswers((prev) => ({ ...prev, [blockId]: answer }));
        }
      },
      onCheck: (blockId, details) => {
        if (isTeacherLive) {
          setChecked((prev) => ({ ...prev, [blockId]: true }));
          if (details) {
            setServerDetails((prev) => ({ ...prev, [blockId]: details }));
          }
        }
      },
      onReset: (blockId) => {
        if (isTeacherLive) {
          setAnswers((prev) => { const n = { ...prev }; delete n[blockId]; return n; });
          setChecked((prev) => { const n = { ...prev }; delete n[blockId]; return n; });
          setServerDetails((prev) => { const n = { ...prev }; delete n[blockId]; return n; });
        }
      },
      onPageChange: (page) => {
        if (isTeacherLive) {
          setCurrentPage(page);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      onStateSnapshot: (state) => {
        if (isTeacherLive) {
          setAnswers(state.answers as Record<number, unknown>);
          setChecked(state.checked);
          setServerDetails(state.serverDetails);
          setCurrentPage(state.current_page);
        }
      },
      onSessionEnd: () => {
        navigate(-1);
      },
      onPeerJoined: () => {
        // Student sends snapshot when teacher joins/reconnects
        if (isStudentLive) {
          liveSession.sendStateSnapshot({
            answers,
            checked,
            serverDetails,
            current_page: currentPage,
          });
        }
      },
    },
  );

  // Teacher cursor tracking
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isTeacherLive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      liveSession.sendCursorMove(x, y);
    };

    const handleMouseLeave = () => {
      liveSession.sendCursorHide();
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isTeacherLive, liveSession]);

  useEffect(() => {
    if (id) loadLesson();
  }, [id]);

  // Intersection Observer to track active block
  useEffect(() => {
    if (!lesson) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const blockId = Number(entry.target.getAttribute("data-block-id"));
            if (blockId) setActiveBlockId(blockId);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const block of lesson.blocks) {
      const el = blockRefs.current[block.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [lesson]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const data = await interactiveLessonApi.get(Number(id));
      setLesson(data);

      // Load saved results for students
      if (user?.role === "student") {
        try {
          const saved = await exerciseResultApi.getMyResults(Number(id));
          if (saved.results.length > 0) {
            const restoredAnswers: Record<number, unknown> = {};
            const restoredChecked: Record<number, boolean> = {};
            for (const r of saved.results) {
              restoredAnswers[r.block_id] = r.answer;
              restoredChecked[r.block_id] = true;
              savedBlockIds.current.add(r.block_id);
            }
            setAnswers(restoredAnswers);
            setChecked(restoredChecked);
          }
        } catch {
          // Ignore errors loading saved results
        }
      }
    } catch (error) {
      console.error("Failed to load lesson:", error);
      alert("Не удалось загрузить урок");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (blockId: number, answer: unknown) => {
    // Teacher in live mode is read-only
    if (isTeacherLive) return;
    // Don't allow changes to already saved answers
    if (savedBlockIds.current.has(blockId)) return;
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
    if (checked[blockId]) {
      setChecked((prev) => ({ ...prev, [blockId]: false }));
    }
    // Broadcast to teacher
    if (isStudentLive) {
      liveSession.sendAnswerChange(blockId, answer);
    }
  };

  const handleCheck = async (blockId: number) => {
    // Teacher in live mode is read-only
    if (isTeacherLive) return;
    // Save to backend for students and get server-side grading details
    if (isStudent && id) {
      try {
        const result = await exerciseResultApi.submit(Number(id), {
          block_id: blockId,
          answer: answers[blockId],
        });
        savedBlockIds.current.add(blockId);
        if (result.details) {
          setServerDetails((prev) => ({ ...prev, [blockId]: result.details! }));
        }
        // Broadcast to teacher
        if (isStudentLive) {
          liveSession.sendCheck(blockId, result.details ?? undefined);
        }
      } catch (error) {
        console.error("Failed to save answer:", error);
      }
    }
    setChecked((prev) => ({ ...prev, [blockId]: true }));
  };

  const handleReset = (blockId: number) => {
    savedBlockIds.current.delete(blockId);
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    setChecked((prev) => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    setServerDetails((prev) => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    // Broadcast to teacher
    if (isStudentLive) {
      liveSession.sendReset(blockId);
    }
  };

  // Split blocks into pages at page_break boundaries or auto-paginate by titles
  const { pages, isAutoPaginated } = useMemo(() => {
    if (!lesson) return { pages: [[]] as ExerciseBlock[][], isAutoPaginated: false };
    const hasPageBreaks = lesson.blocks.some(
      (b) => b.block_type === "page_break",
    );

    if (hasPageBreaks) {
      const result: ExerciseBlock[][] = [];
      let current: ExerciseBlock[] = [];
      for (const block of lesson.blocks) {
        if (block.block_type === "page_break") {
          result.push(current);
          current = [];
        } else {
          current.push(block);
        }
      }
      result.push(current);
      return { pages: result.filter((page) => page.length > 0), isAutoPaginated: false };
    }

    // Auto-paginate: if >= 3 blocks have titles, split by titled blocks
    const excludedTypes = ["teaching_guide", "divider", "page_break"];
    const titledBlockIndices = lesson.blocks
      .map((b, i) => (b.title && !excludedTypes.includes(b.block_type) ? i : -1))
      .filter((i) => i !== -1);

    if (titledBlockIndices.length >= 3) {
      const result: ExerciseBlock[][] = [];
      for (let i = 0; i < titledBlockIndices.length; i++) {
        const start = titledBlockIndices[i];
        const end = i + 1 < titledBlockIndices.length ? titledBlockIndices[i + 1] : lesson.blocks.length;
        result.push(lesson.blocks.slice(start, end));
      }
      // Blocks before first titled block go to first page
      if (titledBlockIndices[0] > 0) {
        result[0] = [...lesson.blocks.slice(0, titledBlockIndices[0]), ...result[0]];
      }
      return { pages: result.filter((page) => page.length > 0), isAutoPaginated: true };
    }

    return { pages: [lesson.blocks], isAutoPaginated: false };
  }, [lesson]);

  const totalPages = pages.length;
  const currentPageBlocks = pages[currentPage] || [];

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (isStudentLive) {
          liveSession.sendPageChange(page);
        }
      }
    },
    [totalPages, isStudentLive, liveSession],
  );

  // Build navigation items from blocks with titles
  const navItems: NavItem[] = useMemo(() => {
    if (!lesson) return [];
    const excludedTypes = ["teaching_guide", "divider", "page_break"];

    if (isAutoPaginated) {
      // Show all titled blocks across all pages; clicking switches page
      return lesson.blocks
        .map((block, idx) => ({
          id: block.id,
          title: block.title || "",
          blockType: block.block_type,
          index: idx,
        }))
        .filter((item) => item.title && !excludedTypes.includes(item.blockType));
    }

    const blocksForNav = totalPages > 1 ? currentPageBlocks : lesson.blocks;
    return blocksForNav
      .map((block) => ({
        id: block.id,
        title: block.title || "",
        blockType: block.block_type,
        index: lesson.blocks.findIndex((b) => b.id === block.id),
      }))
      .filter((item) => item.title && !excludedTypes.includes(item.blockType));
  }, [lesson, totalPages, currentPageBlocks, isAutoPaginated]);

  // Find which page a block belongs to
  const findPageForBlock = useCallback(
    (blockId: number): number => {
      for (let p = 0; p < pages.length; p++) {
        if (pages[p].some((b) => b.id === blockId)) return p;
      }
      return 0;
    },
    [pages],
  );

  const scrollToBlock = useCallback(
    (blockId: number) => {
      if (isAutoPaginated) {
        const targetPage = findPageForBlock(blockId);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
          // Scroll after page renders
          setTimeout(() => {
            const el = blockRefs.current[blockId];
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        } else {
          const el = blockRefs.current[blockId];
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        const el = blockRefs.current[blockId];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setSidebarOpen(false);
    },
    [isAutoPaginated, currentPage, findPageForBlock],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-12 text-gray-500">Урок не найден</div>
    );
  }

  const showSidebar = navItems.length >= 3;

  return (
    <div ref={contentRef} className={`${showSidebar ? "max-w-5xl" : "max-w-3xl"} mx-auto`}>
      {/* Live Session Banner */}
      {isLiveMode && (
        <div className="mb-4 p-3 rounded-xl border-2 border-purple-200 bg-purple-50 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-medium text-purple-800">
              Совместная работа
            </span>
            <span className="text-xs text-purple-600">
              {liveSession.peerConnected
                ? isTeacherLive ? "Ученик подключён" : "Учитель подключён"
                : isTeacherLive ? "Ожидание ученика..." : "Ожидание учителя..."}
            </span>
            {!liveSession.isConnected && (
              <span className="text-xs text-orange-600">Переподключение...</span>
            )}
          </div>
          {isTeacherLive && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                  const scrollPercent = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
                  liveSession.sendScrollTo(scrollPercent, currentPage);
                }}
                disabled={!liveSession.peerConnected}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                За мной
              </button>
              <button
                onClick={() => liveSession.endSession()}
                className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Завершить
              </button>
            </div>
          )}
        </div>
      )}

      {/* Remote Cursor */}
      {isLiveMode && liveSession.remoteCursor && liveSession.remoteCursor.visible && (
        <RemoteCursor
          x={liveSession.remoteCursor.x}
          y={liveSession.remoteCursor.y}
          visible={liveSession.remoteCursor.visible}
          name={isStudent ? "Учитель" : "Ученик"}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Назад
          </button>

          {/* Mobile sidebar toggle */}
          {showSidebar && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              Содержание
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-800">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-gray-600 mt-2">{lesson.description}</p>
        )}
      </div>

      <div className={`${showSidebar ? "flex gap-6" : ""}`}>
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Page navigation - top */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-6 px-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Назад
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                      i === currentPage
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100"
              >
                Вперёд
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Blocks */}
          <div className="space-y-6">
            {currentPageBlocks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                В этом уроке пока нет контента
              </div>
            ) : (
              currentPageBlocks.map((block) => {
                const globalIndex = lesson.blocks.findIndex(
                  (b) => b.id === block.id,
                );
                return (
                  <div
                    key={block.id}
                    ref={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    data-block-id={block.id}
                    className="scroll-mt-4"
                  >
                    <BlockRenderer
                      block={block}
                      blockNumber={getBlockNumber(lesson.blocks, globalIndex)}
                      answer={answers[block.id]}
                      onAnswerChange={(answer) =>
                        handleAnswerChange(block.id, answer)
                      }
                      isChecked={checked[block.id] || false}
                      onCheck={() => handleCheck(block.id)}
                      onReset={() => handleReset(block.id)}
                      serverDetails={serverDetails[block.id]}
                      onMediaControl={isLiveMode ? (action, time) => liveSession.sendMediaControl(block.id, action, time) : undefined}
                      mediaCommand={isLiveMode ? mediaCommands[block.id] || null : undefined}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Page navigation - bottom */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Назад
              </button>
              <span className="text-sm text-gray-500">
                Страница {currentPage + 1} из {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-purple-600 hover:bg-purple-50"
              >
                Вперёд
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Progress */}
          {lesson.blocks.length > 0 && (
            <div className="mt-8 p-4 bg-white rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Прогресс</span>
                <span className="text-sm font-medium text-gray-800">
                  {
                    Object.keys(checked).filter((k) => checked[Number(k)])
                      .length
                  }{" "}
                  / {getInteractiveBlocksCount(lesson.blocks)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                  style={{
                    width: `${
                      getInteractiveBlocksCount(lesson.blocks) > 0
                        ? (Object.keys(checked).filter(
                            (k) => checked[Number(k)],
                          ).length /
                            getInteractiveBlocksCount(lesson.blocks)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar navigation */}
        {showSidebar && (
          <>
            {/* Desktop sidebar */}
            <nav className="hidden lg:block w-56 flex-shrink-0 self-start">
              <div className="sticky top-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Содержание
                </h3>
                <div className="space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto">
                  {navItems.map((item) => {
                    const isActive = isAutoPaginated
                      ? findPageForBlock(item.id) === currentPage
                      : activeBlockId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => scrollToBlock(item.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
                          isActive
                            ? "bg-purple-100 text-purple-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                        }`}
                        title={item.title}
                      >
                        {BLOCK_TYPE_ICONS[item.blockType]}
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
                <div
                  className="absolute inset-0 bg-black/30"
                  onClick={() => setSidebarOpen(false)}
                />
                <div className="relative w-72 bg-white shadow-xl p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Содержание</h3>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1">
                    {navItems.map((item) => {
                      const isActive = isAutoPaginated
                        ? findPageForBlock(item.id) === currentPage
                        : activeBlockId === item.id;
                      return (
                      <button
                        key={item.id}
                        onClick={() => scrollToBlock(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-purple-100 text-purple-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {item.title}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getInteractiveBlocksCount(blocks: ExerciseBlock[]): number {
  const interactiveTypes = [
    "fill_gaps",
    "test",
    "true_false",
    "word_order",
    "matching",
    "essay",
  ];
  return blocks.filter((b) => interactiveTypes.includes(b.block_type)).length;
}

// Block types that should not be numbered (informational/instructional blocks)
const NON_NUMBERED_TYPES = [
  "teaching_guide",
  "divider",
  "remember",
  "page_break",
];

function getBlockNumber(
  blocks: ExerciseBlock[],
  currentIndex: number,
): number | undefined {
  const block = blocks[currentIndex];

  // Non-numbered block types
  if (NON_NUMBERED_TYPES.includes(block.block_type)) {
    return undefined;
  }

  // Count numbered blocks before this one
  let number = 0;
  for (let i = 0; i <= currentIndex; i++) {
    if (!NON_NUMBERED_TYPES.includes(blocks[i].block_type)) {
      number++;
    }
  }
  return number;
}
