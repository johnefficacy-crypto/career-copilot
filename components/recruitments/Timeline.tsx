type TimelineEvent = {
  label: string
  date: string | null
  status: "done" | "active" | "upcoming" | "unknown"
}

function formatDate(d: string | null): string {
  if (!d) return "TBA"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function daysRelative(d: string | null): string | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days > 0)  return `in ${days}d`
  return `${Math.abs(days)}d ago`
}

function resolveStatus(
  date: string | null,
  index: number,
  activeIndex: number,
): TimelineEvent["status"] {
  if (!date) return "unknown"
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0)               return "done"
  if (index === activeIndex)  return "active"
  return "upcoming"
}

export type TimelineProps = {
  notificationDate: string | null
  applyStartDate:   string | null
  applyEndDate:     string | null
  examDate?:        string | null
  resultDate?:      string | null
}

export function Timeline({
  notificationDate,
  applyStartDate,
  applyEndDate,
  examDate,
  resultDate,
}: TimelineProps) {
  const rawEvents: { label: string; date: string | null }[] = [
    { label: "Notification",   date: notificationDate },
    { label: "Apply opens",    date: applyStartDate },
    { label: "Apply closes",   date: applyEndDate },
    { label: "Exam date",      date: examDate ?? null },
    { label: "Result",         date: resultDate ?? null },
  ]

  // Find the last past event index to determine which is "active"
  let activeIndex = 0
  const now = new Date().getTime()
  for (let i = 0; i < rawEvents.length; i++) {
    const d = rawEvents[i].date
    if (d && new Date(d).getTime() < now) {
      activeIndex = i + 1
    }
  }
  activeIndex = Math.min(activeIndex, rawEvents.length - 1)

  const events: TimelineEvent[] = rawEvents.map((e, i) => ({
    ...e,
    status: resolveStatus(e.date, i, activeIndex),
  }))

  return (
    <div>
      <h2 className="text-sm font-medium mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
        Timeline
      </h2>

      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: 11, background: "rgba(255,255,255,0.08)" }}
        />

        <ol className="space-y-0">
          {events.map((ev, i) => {
            const isDone     = ev.status === "done"
            const isActive   = ev.status === "active"
            const isUnknown  = ev.status === "unknown"
            const isUpcoming = ev.status === "upcoming"

            const dotBg = isDone
              ? "rgba(134,239,172,0.90)"
              : isActive
              ? "#e8d5a3"
              : isUnknown
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.18)"

            const dotBorder = isActive
              ? "3px solid rgba(232,213,163,0.40)"
              : isDone
              ? "2px solid rgba(134,239,172,0.30)"
              : "2px solid rgba(255,255,255,0.10)"

            const labelColor = isActive
              ? "#e8d5a3"
              : isDone
              ? "rgba(255,255,255,0.65)"
              : isUnknown
              ? "rgba(255,255,255,0.20)"
              : "rgba(255,255,255,0.45)"

            const rel = daysRelative(ev.date)

            return (
              <li key={ev.label} className="relative flex items-start gap-4 pb-6 last:pb-0">
                {/* Dot */}
                <div
                  className="shrink-0 mt-0.5 z-10"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: dotBg,
                    border: dotBorder,
                    boxShadow: isActive ? "0 0 0 4px rgba(232,213,163,0.08)" : undefined,
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: labelColor }}
                    >
                      {ev.label}
                      {isActive && (
                        <span
                          className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(232,213,163,0.12)", color: "#e8d5a3" }}
                        >
                          NOW
                        </span>
                      )}
                    </span>

                    <span
                      className="text-xs shrink-0"
                      style={{
                        color: isActive
                          ? "#e8d5a3"
                          : isDone
                          ? "rgba(255,255,255,0.30)"
                          : "rgba(255,255,255,0.25)",
                      }}
                    >
                      {isUnknown ? "—" : formatDate(ev.date)}
                    </span>
                  </div>

                  {rel && !isUnknown && (
                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color: isActive && !isDone
                          ? "rgba(232,213,163,0.55)"
                          : "rgba(255,255,255,0.20)",
                      }}
                    >
                      {rel}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
