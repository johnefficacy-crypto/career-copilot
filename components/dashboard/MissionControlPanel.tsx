"use client"

import { useState } from "react"
import Link from "next/link"
import type { MissionControlData, MissionControlFeedItem } from "@/lib/db/mission-control"

// ─── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, accent, active, onClick,
}: {
  label:   string
  value:   number
  accent:  string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 border transition-colors w-full ${
        active
          ? "border-[#e8d5a3]/40 bg-[#e8d5a3]/[0.06]"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]"
      }`}
    >
      <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-semibold leading-none ${accent}`}
         style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </p>
    </button>
  )
}

// ─── Opportunity card ──────────────────────────────────────────────────────────

function OpportunityRow({ item }: { item: MissionControlFeedItem }) {
  const isEligible    = item.eligibilityStatus === "eligible"
  const isConditional = item.eligibilityStatus === "conditional"

  const statusLabel = isEligible ? "Eligible" : isConditional ? "Conditional" : "Not eligible"
  const statusClass = isEligible
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : isConditional
    ? "bg-amber-400/10 text-amber-300 border-amber-400/20"
    : "bg-white/5 text-white/40 border-white/10"

  const deadlineClass =
    item.daysToDeadline != null && item.daysToDeadline <= 3
      ? "text-red-400"
      : item.daysToDeadline != null && item.daysToDeadline <= 7
      ? "text-amber-300"
      : "text-white/40"

  const deadlineText =
    item.daysToDeadline === 0
      ? "Closes today"
      : item.daysToDeadline != null
      ? `${item.daysToDeadline}d left`
      : null

  return (
    <Link
      href={item.detailHref}
      className="block border border-white/[0.07] rounded-xl p-4 hover:border-white/[0.14] hover:bg-white/[0.02] transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="text-white text-sm font-medium leading-snug truncate group-hover:text-[#e8d5a3] transition-colors"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {item.recruitmentName ?? "Untitled recruitment"}
          </h3>

          {/* Reason codes */}
          {item.reasonCodes && item.reasonCodes.length > 0 && (
            <p className="text-white/35 text-xs mt-1 truncate">
              {item.reasonCodes.slice(0, 3).join(" · ")}
            </p>
          )}

          {/* Conditional explanation */}
          {isConditional && item.explanation && (
            <p className="text-amber-300/60 text-xs mt-1 truncate">{item.explanation}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`border text-xs px-2.5 py-1 rounded-full ${statusClass}`}>
            {statusLabel}
          </span>
          {deadlineText && (
            <span className={`text-xs font-medium tabular-nums ${deadlineClass}`}>
              {deadlineText}
            </span>
          )}
          {item.applied && (
            <span className="text-xs text-emerald-400/70">Applied ✓</span>
          )}
          {item.saved && !item.applied && (
            <span className="text-xs text-[#e8d5a3]/50">Saved</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "all" | "urgent" | "eligible" | "conditional"

const TABS: { id: Tab; label: string }[] = [
  { id: "all",         label: "All"         },
  { id: "urgent",      label: "Urgent"      },
  { id: "eligible",    label: "Eligible"    },
  { id: "conditional", label: "Conditional" },
]

function filterFeed(feed: MissionControlFeedItem[], tab: Tab): MissionControlFeedItem[] {
  switch (tab) {
    case "urgent":
      return feed.filter((x) => x.daysToDeadline != null && x.daysToDeadline <= 7)
    case "eligible":
      return feed.filter((x) => x.eligibilityStatus === "eligible")
    case "conditional":
      return feed.filter((x) => x.eligibilityStatus === "conditional")
    default:
      return feed
  }
}

// ─── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  data: MissionControlData
}

export function MissionControlPanel({ data }: Props) {
  const [activeTab,    setActiveTab]    = useState<Tab>("all")
  const [summaryFilter, setSummaryFilter] = useState<Tab | null>(null)

  const { summary, feed } = data

  function handleSummaryClick(tab: Tab) {
    if (summaryFilter === tab) {
      setSummaryFilter(null)
      setActiveTab("all")
    } else {
      setSummaryFilter(tab)
      setActiveTab(tab)
    }
  }

  const visibleFeed = filterFeed(feed, activeTab)

  return (
    <section className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white/40 uppercase tracking-widest text-xs">Opportunities</h2>
        <Link
          href="/dashboard/exams"
          className="text-xs text-[#e8d5a3] hover:text-[#f0e0b8] transition-colors"
        >
          Browse all →
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <SummaryCard
          label="Eligible"
          value={summary.eligibleNow}
          accent="text-emerald-400"
          active={summaryFilter === "eligible"}
          onClick={() => handleSummaryClick("eligible")}
        />
        <SummaryCard
          label="Closing this week"
          value={summary.closingThisWeek}
          accent="text-amber-300"
          active={summaryFilter === "urgent"}
          onClick={() => handleSummaryClick("urgent")}
        />
        <SummaryCard
          label="Conditional"
          value={summary.conditional}
          accent="text-amber-400"
          active={summaryFilter === "conditional"}
          onClick={() => handleSummaryClick("conditional")}
        />
        <SummaryCard
          label="Profile blockers"
          value={summary.profileBlockers}
          accent="text-white/60"
          active={false}
          onClick={() => {}}
        />
      </div>

      {/* Tab bar */}
      {feed.length > 0 && (
        <div className="flex gap-1 mb-4 border-b border-white/[0.07] pb-3">
          {TABS.map((tab) => {
            const count = filterFeed(feed, tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSummaryFilter(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                aria-pressed={activeTab === tab.id}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                    activeTab === tab.id ? "bg-white/10 text-white/70" : "bg-white/[0.06] text-white/30"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Feed */}
      {visibleFeed.length === 0 ? (
        <EmptyState tab={activeTab} hasAnyData={feed.length > 0} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleFeed.map((item) => (
            <OpportunityRow key={item.recruitmentId} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({ tab, hasAnyData }: { tab: Tab; hasAnyData: boolean }) {
  if (hasAnyData) {
    // Tab has no items but other tabs do
    const messages: Record<Tab, string> = {
      all:         "No opportunities found.",
      urgent:      "No urgent deadlines in the next 7 days.",
      eligible:    "No fully-eligible matches yet.",
      conditional: "No conditional matches.",
    }
    return (
      <p className="text-white/30 text-sm py-2">{messages[tab]}</p>
    )
  }

  // No data at all — view not populated or profile incomplete
  return (
    <div>
      <p className="text-white/60 text-base mb-1">No matches yet.</p>
      <p className="text-white/30 text-sm leading-relaxed">
        Once the eligibility engine processes your profile against open
        recruitments, matched opportunities will appear here.
      </p>
      <div className="flex flex-wrap gap-3 mt-4">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-2 bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3] text-sm px-4 py-2 rounded-lg hover:bg-[#e8d5a3]/15 transition-colors"
        >
          Complete profile
        </Link>
        <Link
          href="/dashboard/exams"
          className="inline-flex items-center gap-2 border border-white/10 text-white/50 text-sm px-4 py-2 rounded-lg hover:border-white/20 hover:text-white/70 transition-colors"
        >
          Browse open exams
        </Link>
      </div>
    </div>
  )
}
