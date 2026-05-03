type StatusPanelProps = {
  status:      "eligible" | "conditional" | "ineligible"
  explanation: string
  nextSteps:   string[]
}

export function StatusPanel({ status, explanation, nextSteps }: StatusPanelProps) {
  const title =
    status === "eligible"
      ? "You are eligible"
      : status === "conditional"
        ? "You may be eligible"
        : "You are currently not eligible"

  const borderClass =
    status === "eligible"
      ? "border-green-700"
      : status === "conditional"
        ? "border-yellow-700"
        : "border-red-700"

  return (
    <section
      aria-labelledby="status-panel-title"
      className={`rounded-xl border ${borderClass} p-4 bg-card`}
    >
      <h2 id="status-panel-title" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{explanation}</p>

      {nextSteps.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Next steps</h3>
          <ol className="mt-1 list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
