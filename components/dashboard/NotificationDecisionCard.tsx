import Link from "next/link"

type Props = {
  recruitmentId: string
  recruitmentName: string
  orgName: string | null
  statusLabel: string
  deadlineHint: string
  unreadCount: number
  matchPercent: number
}

export function NotificationDecisionCard({ recruitmentId, recruitmentName, orgName, statusLabel, deadlineHint, unreadCount, matchPercent }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white/85 text-sm font-medium">{recruitmentName}</p>
          <p className="text-white/40 text-xs">{orgName ?? "Organization"}</p>
        </div>
        {unreadCount > 0 && <span className="text-[10px] rounded-full bg-[#e8d5a3]/20 text-[#e8d5a3] px-2 py-0.5">{unreadCount} new</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/60">{statusLabel}</span>
        <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/60">{deadlineHint}</span>
        <span className="px-2 py-0.5 rounded bg-[#e8d5a3]/10 text-[#e8d5a3]">Match {matchPercent}%</span>
      </div>

      <div className="mt-3 flex gap-3 text-xs">
        <Link href={`/dashboard/recruitments/${recruitmentId}`} className="text-[#e8d5a3]/80 hover:text-[#e8d5a3]">View recruitment →</Link>
      </div>
    </div>
  )
}
