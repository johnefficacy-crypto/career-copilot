export default function AdminLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header skeleton */}
        <div className="skeleton" style={{ height: 28, width: 220, borderRadius: 6, marginBottom: "2rem" }} />

        {/* Stat cards row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cc-card" style={{ padding: "1.25rem" }}>
              <div className="skeleton" style={{ height: 12, width: "60%", borderRadius: 4, marginBottom: "0.75rem" }} />
              <div className="skeleton" style={{ height: 28, width: "40%", borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="cc-card" style={{ padding: "1.5rem" }}>
          <div className="skeleton" style={{ height: 16, width: 160, borderRadius: 4, marginBottom: "1.25rem" }} />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid var(--border-sm)" }}>
              <div className="skeleton" style={{ height: 12, width: "25%", borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 12, width: "15%", borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 12, width: "20%", borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 12, width: "10%", borderRadius: 4, marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--bg-surface) 25%,
            rgba(255,255,255,0.06) 50%,
            var(--bg-surface) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
