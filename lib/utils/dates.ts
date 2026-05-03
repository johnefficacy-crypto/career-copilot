// /**
//  * lib/utils/dates.ts
//  *
//  * Date/time utilities used across forum, dashboard, and chat components.
//  * No external dependencies — pure TypeScript.
//  */

// /**
//  * Returns a human-readable relative time string.
//  * e.g. "just now", "5m ago", "3h ago", "2 days ago", "12 Apr"
//  */
// export function timeAgo(isoString: string): string {
//   const date  = new Date(isoString)
//   const now   = new Date()
//   const secs  = Math.floor((now.getTime() - date.getTime()) / 1000)

//   if (secs < 30)  return "just now"
//   if (secs < 60)  return `${secs}s ago`

//   const mins = Math.floor(secs / 60)
//   if (mins < 60)  return `${mins}m ago`

//   const hours = Math.floor(mins / 60)
//   if (hours < 24) return `${hours}h ago`

//   const days = Math.floor(hours / 24)
//   if (days < 7)   return `${days} day${days !== 1 ? "s" : ""} ago`

//   if (days < 30) {
//     const weeks = Math.floor(days / 7)
//     return `${weeks} week${weeks !== 1 ? "s" : ""} ago`
//   }

//   // Older than a month — show the date
//   return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
// }

// /**
//  * Returns a formatted date string for display.
//  * e.g. "12 April 2025"
//  */
// export function formatDate(isoString: string): string {
//   return new Date(isoString).toLocaleDateString("en-IN", {
//     day:   "numeric",
//     month: "long",
//     year:  "numeric",
//   })
// }

// /**
//  * Returns days remaining until a deadline date.
//  * Negative = already passed.
//  */
// export function daysUntil(isoString: string): number {
//   const target = new Date(isoString)
//   const now    = new Date()
//   return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
// }

// /**
//  * Returns a deadline label with urgency colouring class.
//  */
// export function deadlineLabel(isoString: string): { text: string; urgency: "safe" | "warning" | "danger" | "expired" } {
//   const days = daysUntil(isoString)

//   if (days < 0)  return { text: "Closed",            urgency: "expired" }
//   if (days === 0) return { text: "Closes today",      urgency: "danger"  }
//   if (days === 1) return { text: "1 day left",        urgency: "danger"  }
//   if (days <= 3)  return { text: `${days} days left`, urgency: "danger"  }
//   if (days <= 7)  return { text: `${days} days left`, urgency: "warning" }
//   return { text: `${days} days left`, urgency: "safe" }
// }


/**
 * lib/utils/dates.ts
 *
 * Date/time utilities used across forum, dashboard, and chat components.
 * No external dependencies — pure TypeScript.
 */

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "5m ago", "3h ago", "2 days ago", "12 Apr"
 */
export function timeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const secs = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (secs < 30) return "just now"
  if (secs < 60) return `${secs}s ago`

  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`

  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

/**
 * Returns a formatted date string for display.
 * e.g. "12 April 2025". Returns "—" for null/undefined input.
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—"
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Returns days remaining until a deadline date.
 * Negative = already passed. Returns null for null/undefined input.
 */
export function daysUntil(isoString: string | null | undefined): number | null {
  if (!isoString) return null
  const target = new Date(isoString)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Returns a deadline label with urgency colouring class.
 */
export function deadlineLabel(
  isoString: string | null | undefined
): { text: string; urgency: "safe" | "warning" | "danger" | "expired" } {
  const days = daysUntil(isoString)

  if (days === null || days < 0) return { text: "Closed", urgency: "expired" }
  if (days === 0) return { text: "Closes today", urgency: "danger" }
  if (days === 1) return { text: "1 day left", urgency: "danger" }
  if (days <= 3) return { text: `${days} days left`, urgency: "danger" }
  if (days <= 7) return { text: `${days} days left`, urgency: "warning" }
  return { text: `${days} days left`, urgency: "safe" }
}

/**
 * Returns age in completed years from date of birth.
 * Returns null for missing or invalid input.
 */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null

  const birthDate = new Date(dob)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate())

  if (!hasHadBirthdayThisYear) age -= 1

  return age >= 0 ? age : null
}

/**
 * Returns only the urgency classification for a deadline.
 */
export function getDeadlineUrgency(
  isoString: string | null | undefined
): "safe" | "warning" | "danger" | "expired" {
  if (!isoString) return "expired"
  return deadlineLabel(isoString).urgency
}

/**
 * Returns progress percentage across a date range, bounded 0-100.
 */
export function dateProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate) return 0

  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0

  if (now.getTime() <= start.getTime()) return 0
  if (now.getTime() >= end.getTime()) return 100

  const elapsed = now.getTime() - start.getTime()
  const percent = Math.round((elapsed / total) * 100)

  return Math.min(100, Math.max(0, percent))
}