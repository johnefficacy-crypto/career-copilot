export type DeadlineStatus = "upcoming" | "open" | "closing_soon" | "closes_today" | "closed" | "unknown"

export function deriveDeadlineStatus(applyEndDate: string | null | undefined): DeadlineStatus {
  if (!applyEndDate) return "unknown"
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const d = new Date(applyEndDate)
  const e = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((e - t) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return "closed"
  if (diffDays === 0) return "closes_today"
  if (diffDays <= 7) return "closing_soon"
  return "open"
}
