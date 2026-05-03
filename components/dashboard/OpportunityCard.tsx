type OpportunityCardProps = {
  title:             string
  orgName:           string
  eligibilityStatus: "eligible" | "conditional" | "ineligible"
  daysToDeadline:    number | null
  why:               string[]
  blockers:          string[]
  href:              string
}

export function OpportunityCard({
  title,
  orgName,
  eligibilityStatus,
  daysToDeadline,
  why,
  blockers,
  href,
}: OpportunityCardProps) {
  const statusLabel =
    eligibilityStatus === "eligible"
      ? "Eligible"
      : eligibilityStatus === "conditional"
        ? "Conditional"
        : "Not eligible"

  const statusClass =
    eligibilityStatus === "eligible"
      ? "bg-green-900/30 text-green-400 border-green-700"
      : eligibilityStatus === "conditional"
        ? "bg-yellow-900/30 text-yellow-400 border-yellow-700"
        : "bg-red-900/30 text-red-400 border-red-700"

  return (
    <article className="rounded-xl border border-white/10 p-4 bg-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{orgName}</p>
        </div>
        <span
          aria-label={`Status: ${statusLabel}`}
          className={`rounded-full border px-2 py-1 text-xs font-medium shrink-0 ${statusClass}`}
        >
          {statusLabel}
        </span>
      </header>

      <div className="mt-3 text-sm">
        {daysToDeadline != null ? (
          <p
            className={daysToDeadline <= 3 ? "text-red-400 font-medium" : "text-muted-foreground"}
            aria-label={`Deadline in ${daysToDeadline} days`}
          >
            {daysToDeadline === 0 ? "Closes today" : `Closing in ${daysToDeadline} day${daysToDeadline === 1 ? "" : "s"}`}
          </p>
        ) : (
          <p className="text-muted-foreground">No deadline set</p>
        )}
      </div>

      {why.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-medium">Why this surfaced</h4>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {why.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {blockers.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-medium text-yellow-400">Blockers</h4>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <a
        className="mt-4 inline-flex rounded-md border border-white/20 px-3 py-2 text-sm font-medium hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        href={href}
      >
        View details
      </a>
    </article>
  )
}
