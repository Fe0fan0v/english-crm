interface RemoteCursorProps {
  x: number;
  y: number;
  visible: boolean;
  name: string;
}

export default function RemoteCursor({ x, y, visible, name }: RemoteCursorProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transition: "left 0.05s linear, top 0.05s linear",
      }}
    >
      {/* SVG cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
      >
        <path
          d="M5 3L19 12L12 12L8 21L5 3Z"
          fill="#8B5CF6"
          stroke="#6D28D9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Name label */}
      <div
        className="absolute left-5 top-4 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap shadow-md"
      >
        {name}
      </div>
    </div>
  );
}
