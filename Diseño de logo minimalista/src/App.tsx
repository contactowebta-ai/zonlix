export default function App() {
  // Z path: single continuous stroke M top-left → top-right → bottom-left → bottom-right
  // ViewBox 64×64 for the mark symbol
  const zTopY = 13
  const zBotY = 51
  const zLeft = 8
  const zRight = 56

  // Midpoint of diagonal (top-right → bottom-left)
  const nodeCx = (zRight + zLeft) / 2   // 32
  const nodeCy = (zTopY + zBotY) / 2    // 32
  const nodeR = 5.5

  return (
    <div
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center gap-16"
    >
      {/* ── Primary logo — horizontal lockup ── */}
      <div className="flex items-center gap-4">
        {/* Symbol */}
        <svg
          viewBox="0 0 64 64"
          width="56"
          height="56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Z — two bars + diagonal as one continuous polyline */}
          <polyline
            points={`${zLeft},${zTopY} ${zRight},${zTopY} ${zLeft},${zBotY} ${zRight},${zBotY}`}
            stroke="#111827"
            strokeWidth="5.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          {/* Emerald diamond node at diagonal midpoint */}
          <polygon
            points={`${nodeCx},${nodeCy - nodeR} ${nodeCx + nodeR},${nodeCy} ${nodeCx},${nodeCy + nodeR} ${nodeCx - nodeR},${nodeCy}`}
            fill="#10b981"
          />
        </svg>

        {/* Wordmark */}
        <span
          style={{
            fontSize: "2rem",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "#111827",
            lineHeight: 1,
          }}
        >
          Zonlix
        </span>
      </div>

      {/* ── Symbol-only variants ── */}
      <div className="flex items-end gap-10">
        {/* Large */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 64 64" width="80" height="80" fill="none">
            <polyline
              points={`${zLeft},${zTopY} ${zRight},${zTopY} ${zLeft},${zBotY} ${zRight},${zBotY}`}
              stroke="#111827"
              strokeWidth="5.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <polygon
              points={`${nodeCx},${nodeCy - nodeR} ${nodeCx + nodeR},${nodeCy} ${nodeCx},${nodeCy + nodeR} ${nodeCx - nodeR},${nodeCy}`}
              fill="#10b981"
            />
          </svg>
          <span style={{ fontSize: "0.7rem", color: "#9ca3af", letterSpacing: "0.06em", fontWeight: 500 }}>80px</span>
        </div>

        {/* Medium */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 64 64" width="48" height="48" fill="none">
            <polyline
              points={`${zLeft},${zTopY} ${zRight},${zTopY} ${zLeft},${zBotY} ${zRight},${zBotY}`}
              stroke="#111827"
              strokeWidth="5.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <polygon
              points={`${nodeCx},${nodeCy - nodeR} ${nodeCx + nodeR},${nodeCy} ${nodeCx},${nodeCy + nodeR} ${nodeCx - nodeR},${nodeCy}`}
              fill="#10b981"
            />
          </svg>
          <span style={{ fontSize: "0.7rem", color: "#9ca3af", letterSpacing: "0.06em", fontWeight: 500 }}>48px</span>
        </div>

        {/* Small / favicon */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 64 64" width="24" height="24" fill="none">
            <polyline
              points={`${zLeft},${zTopY} ${zRight},${zTopY} ${zLeft},${zBotY} ${zRight},${zBotY}`}
              stroke="#111827"
              strokeWidth="5.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <polygon
              points={`${nodeCx},${nodeCy - nodeR} ${nodeCx + nodeR},${nodeCy} ${nodeCx},${nodeCy + nodeR} ${nodeCx - nodeR},${nodeCy}`}
              fill="#10b981"
            />
          </svg>
          <span style={{ fontSize: "0.7rem", color: "#9ca3af", letterSpacing: "0.06em", fontWeight: 500 }}>24px</span>
        </div>
      </div>

      {/* ── Dark ground variant ── */}
      <div
        className="rounded-2xl flex items-center gap-4 px-8 py-6"
        style={{ backgroundColor: "#111827" }}
      >
        <svg viewBox="0 0 64 64" width="48" height="48" fill="none">
          <polyline
            points={`${zLeft},${zTopY} ${zRight},${zTopY} ${zLeft},${zBotY} ${zRight},${zBotY}`}
            stroke="#f9fafb"
            strokeWidth="5.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <polygon
            points={`${nodeCx},${nodeCy - nodeR} ${nodeCx + nodeR},${nodeCy} ${nodeCx},${nodeCy + nodeR} ${nodeCx - nodeR},${nodeCy}`}
            fill="#10b981"
          />
        </svg>
        <span
          style={{
            fontSize: "1.75rem",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "#f9fafb",
            lineHeight: 1,
          }}
        >
          Zonlix
        </span>
      </div>
    </div>
  )
}
