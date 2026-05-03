import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"
export const metadata = { title: "Browse Exams — Career Copilot" }

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function urgencyColor(days: number | null): string {
  if (days === null) return "var(--text-ghost)"
  if (days <= 3)  return "#ef4444"
  if (days <= 14) return "#f59e0b"
  return "#34d399"
}

function EligibilityBadge({
  hasAnyEligible,
  hasConditional,
  evaluated,
}: {
  hasAnyEligible: boolean | null
  hasConditional: boolean | null
  evaluated: boolean
}) {
  if (!evaluated) return null
  if (hasAnyEligible) {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: "rgba(134,239,172,0.12)", color: "#86efac", border: "1px solid rgba(134,239,172,0.25)" }}
      >
        Eligible
      </span>
    )
  }
  if (hasConditional) {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: "rgba(250,204,21,0.10)", color: "#fde68a", border: "1px solid rgba(250,204,21,0.22)" }}
      >
        Conditional
      </span>
    )
  }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px]"
      style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.30)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      Not eligible
    </span>
  )
}

type UserExamRow = {
  recruitment_id: string
  exam_name: string | null
  year: number | null
  status: string | null
  apply_end_date: string | null
  official_notification_url: string | null
  organization_name: string | null
  organization_state: string | null
  total_vacancies: number | null
  has_any_eligible_post: boolean | null
  has_conditional_result: boolean | null
  eligible_posts_count: number | null
  evaluated_posts_count: number | null
  is_tracked: boolean | null
}

type PlainRow = {
  recruitment_id: string
  exam_name: string | null
  year: number | null
  status: string | null
  apply_end_date: string | null
  official_notification_url: string | null
  organization_name: string | null
  organization_state: string | null
  total_vacancies: number | null
}

export default async function BrowseExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams
  const filter = params.filter ?? "open"
  const q = params.q ?? ""
  const today = new Date().toISOString().split("T")[0]

  // Try personalized view first (requires migration 029 + user_recruitment_state)
  let userRows: UserExamRow[] = []
  let plainRows: PlainRow[] = []
  let isPersonalized = false

  try {
    let userQ = supabase
      .from("user_exam_summary")
      .select(`
        recruitment_id, exam_name, year, status, apply_end_date,
        official_notification_url, organization_name, organization_state,
        total_vacancies, has_any_eligible_post, has_conditional_result,
        eligible_posts_count, evaluated_posts_count, is_tracked
      `)
      .eq("user_id", user.id)
      .order("apply_end_date", { ascending: true, nullsFirst: false })
      .limit(60)

    if (filter === "open") {
      userQ = userQ
        .in("status", ["open", "upcoming", "published"])
        .or(`apply_end_date.gte.${today},apply_end_date.is.null`)
    } else if (filter === "closing") {
      const in7days = new Date(new Date().getTime() + 7 * 86_400_000).toISOString().split("T")[0]
      userQ = userQ.gte("apply_end_date", today).lte("apply_end_date", in7days)
    }

    if (q) userQ = userQ.ilike("exam_name", `%${q}%`)

    const { data } = await userQ
    if (data && data.length > 0) {
      userRows = data as UserExamRow[]
      isPersonalized = true
    }
  } catch {
    // view not migrated yet — fall through to plain query
  }

  // Fallback: plain exam_summary view (no eligibility info)
  if (!isPersonalized) {
    try {
      let plainQ = supabase
        .from("exam_summary")
        .select(`
          recruitment_id, exam_name, year, status, apply_end_date,
          official_notification_url, organization_name, organization_state, total_vacancies
        `)
        .order("apply_end_date", { ascending: true, nullsFirst: false })
        .limit(60)

      if (filter === "open") {
        plainQ = plainQ
          .in("status", ["open", "upcoming", "published"])
          .or(`apply_end_date.gte.${today},apply_end_date.is.null`)
      } else if (filter === "closing") {
        const in7days = new Date(new Date().getTime() + 7 * 86_400_000).toISOString().split("T")[0]
        plainQ = plainQ.gte("apply_end_date", today).lte("apply_end_date", in7days)
      }
      if (q) plainQ = plainQ.ilike("exam_name", `%${q}%`)

      const { data } = await plainQ
      plainRows = (data ?? []) as PlainRow[]
    } catch {
      // both views missing — stay empty
    }
  }

  const filters = [
    { key: "open",    label: "Open now" },
    { key: "closing", label: "Closing soon" },
    { key: "all",     label: "All" },
  ]

  const totalCount = isPersonalized ? userRows.length : plainRows.length
  const eligibleCount = isPersonalized
    ? userRows.filter(r => r.has_any_eligible_post).length
    : 0

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{ background: "rgba(15,15,15,0.9)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm" style={{ color: "var(--text-dim)" }}>
              ← Dashboard
            </Link>
            <span style={{ color: "var(--border-md)" }}>/</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Browse Exams</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Title + eligibility summary */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-1" style={{ fontFamily: "var(--font-serif)" }}>
            Open Recruitments
          </h1>
          {isPersonalized && eligibleCount > 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              You are eligible for{" "}
              <span style={{ color: "#86efac", fontWeight: 500 }}>{eligibleCount}</span> of{" "}
              {totalCount} recruitments shown.
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Browse active government exam notifications.{" "}
              {!isPersonalized && (
                <Link href="/dashboard" style={{ color: "var(--gold)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                  Complete your profile
                </Link>
              )}{!isPersonalized && " to see eligibility."}
            </p>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)" }}>
            {filters.map(f => (
              <Link
                key={f.key}
                href={`/dashboard/exams?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: filter === f.key ? "var(--gold-faint)" : "transparent",
                  color: filter === f.key ? "var(--gold)" : "var(--text-dim)",
                  border: filter === f.key ? "1px solid var(--gold-border)" : "1px solid transparent",
                }}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <form method="get" action="/dashboard/exams" className="flex-1 min-w-[200px] max-w-xs">
            <input type="hidden" name="filter" value={filter} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search recruitments…"
              className="w-full text-sm px-3 py-2 rounded-xl"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </form>

          {isPersonalized && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-ghost)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "#86efac" }}
              />
              Eligibility active
            </div>
          )}
        </div>

        {/* Results */}
        {totalCount === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <p className="text-3xl mb-3 opacity-20">📋</p>
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>No recruitments found</p>
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
              The scraper is running — check back soon or try a different filter.
            </p>
          </div>
        ) : isPersonalized ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userRows.map((r) => {
              const days = daysUntil(r.apply_end_date)
              const evaluated = (r.evaluated_posts_count ?? 0) > 0
              return (
                <div
                  key={r.recruitment_id}
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-colors hover:border-white/[0.14]"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  {/* Title + org — the whole title row is the link */}
                  <Link href={`/dashboard/recruitments/${r.recruitment_id}`} className="block">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white leading-snug">{r.exam_name}</p>
                      <EligibilityBadge
                        hasAnyEligible={r.has_any_eligible_post}
                        hasConditional={r.has_conditional_result}
                        evaluated={evaluated}
                      />
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {r.organization_name}
                      {r.organization_state && (
                        <span className="ml-1.5" style={{ color: "var(--text-ghost)" }}>· {r.organization_state}</span>
                      )}
                    </p>
                  </Link>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-ghost)" }}>
                    {(r.total_vacancies ?? 0) > 0 && (
                      <span>👥 {(r.total_vacancies!).toLocaleString("en-IN")} posts</span>
                    )}
                    {r.apply_end_date && (
                      <span style={{ color: urgencyColor(days) }}>
                        {days !== null && days <= 0
                          ? "Closed"
                          : days !== null
                          ? `⏰ ${days}d left`
                          : `Apply by ${new Date(r.apply_end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                      </span>
                    )}
                    {r.status && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
                        style={{
                          background: r.status === "open" ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.05)",
                          color: r.status === "open" ? "#34d399" : "var(--text-dim)",
                        }}
                      >
                        {r.status}
                      </span>
                    )}
                    {r.is_tracked && (
                      <span style={{ color: "var(--gold)" }}>★ Tracked</span>
                    )}
                  </div>

                  {/* Eligible posts count */}
                  {evaluated && (r.eligible_posts_count ?? 0) > 0 && (
                    <p className="text-xs" style={{ color: "#86efac" }}>
                      Eligible for {r.eligible_posts_count} post{r.eligible_posts_count !== 1 ? "s" : ""}
                    </p>
                  )}

                  {/* Official link — separate from the card link to avoid nested <a> */}
                  {r.official_notification_url && (
                    <a
                      href={r.official_notification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs self-start"
                      style={{ color: "var(--gold)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                    >
                      Official notification ↗
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Plain fallback cards (no eligibility)
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plainRows.map((r) => {
              const days = daysUntil(r.apply_end_date)
              return (
                <div
                  key={r.recruitment_id}
                  className="rounded-2xl p-5 flex flex-col gap-3"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug mb-1">{r.exam_name}</p>
                    <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {r.organization_name}
                      {r.organization_state && (
                        <span className="ml-1.5" style={{ color: "var(--text-ghost)" }}>· {r.organization_state}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-ghost)" }}>
                    {(r.total_vacancies ?? 0) > 0 && (
                      <span>👥 {(r.total_vacancies!).toLocaleString("en-IN")} posts</span>
                    )}
                    {r.apply_end_date && (
                      <span style={{ color: urgencyColor(days) }}>
                        {days !== null && days <= 0
                          ? "Closed"
                          : days !== null
                          ? `⏰ ${days}d left`
                          : `Apply by ${new Date(r.apply_end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                      </span>
                    )}
                    {r.status && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
                        style={{
                          background: r.status === "open" ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.05)",
                          color: r.status === "open" ? "#34d399" : "var(--text-dim)",
                        }}
                      >
                        {r.status}
                      </span>
                    )}
                  </div>

                  {r.official_notification_url && (
                    <a
                      href={r.official_notification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs self-start"
                      style={{ color: "var(--gold)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                    >
                      Official notification ↗
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
