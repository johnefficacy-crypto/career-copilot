export default function DashboardLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)", padding: "1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Top greeting */}
        <div className="skeleton" style={{ height: 24, width: 280, borderRadius: 6, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ height: 14, width: 180, borderRadius: 4, marginBottom: "2rem" }} />

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
          {/* Recruitment cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="cc-card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div className="skeleton" style={{ height: 16, width: "45%", borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 12 }} />
                </div>
                <div className="skeleton" style={{ height: 12, width: "30%", borderRadius: 4, marginBottom: "0.5rem" }} />
                <div className="skeleton" style={{ height: 12, width: "55%", borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="cc-card" style={{ padding: "1.25rem" }}>
              <div className="skeleton" style={{ height: 14, width: "50%", borderRadius: 4, marginBottom: "1rem" }} />
              <div className="skeleton" style={{ height: 80, width: "100%", borderRadius: 6 }} />
            </div>
            <div className="cc-card" style={{ padding: "1.25rem" }}>
              <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 4, marginBottom: "1rem" }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div className="skeleton" style={{ height: 36, width: 36, borderRadius: "50%" }} />
                  <div className="skeleton" style={{ height: 12, flex: 1, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
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
