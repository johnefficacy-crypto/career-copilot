"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { signOut } from "@/actions/auth"

interface Props {
  fullName:   string | null
  planId:     string | null
  avatarUrl:  string | null
  isAdmin:    boolean
}

const PLAN_LABELS: Record<string, string> = {
  free:  "Free",
  pro:   "Pro",
  elite: "Elite",
}

export function UserNav({ fullName, planId, avatarUrl, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const initial = fullName?.[0]?.toUpperCase() ?? "?"
  const planLabel = PLAN_LABELS[planId ?? "free"] ?? "Free"

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors"
        style={{
          background: open ? "var(--gold-faint)" : "transparent",
          border: `1px solid ${open ? "var(--gold-border)" : "transparent"}`,
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style={{
            background: avatarUrl ? "transparent" : "var(--gold-faint)",
            border: "1px solid var(--gold-border)",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName ?? "User"}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span style={{ color: "var(--gold)", fontFamily: "var(--font-serif)" }}>
              {initial}
            </span>
          )}
        </div>

        {/* Name + plan — hidden on small screens */}
        <div className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>
            {fullName ?? "Aspirant"}
          </span>
          <span
            className="text-[10px] mt-0.5"
            style={{
              color: planId === "pro" || planId === "elite"
                ? "var(--gold)"
                : "var(--text-ghost)",
            }}
          >
            {planLabel} plan
          </span>
        </div>

        {/* Chevron */}
        <span
          className="text-xs transition-transform hidden sm:block"
          style={{
            color: "var(--text-dim)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl py-1.5 z-50"
          style={{
            background: "#1a1a1a",
            border: "1px solid var(--border-md)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Profile header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm font-medium text-white">{fullName ?? "Aspirant"}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              {planLabel} plan
              {(planId === "free") && (
                <Link
                  href="/pricing"
                  className="ml-1.5"
                  style={{ color: "var(--gold)" }}
                  onClick={() => setOpen(false)}
                >
                  Upgrade →
                </Link>
              )}
            </p>
          </div>

          {/* Nav items */}
          <div className="py-1">
            <NavItem href="/dashboard"            label="Dashboard"       icon="⊞" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/exams"      label="Browse Exams"    icon="📋" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/tracker"    label="Application Tracker" icon="✔" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/chat"       label="AI Career Chat"  icon="💬" onClick={() => setOpen(false)} badge={planId !== "pro" && planId !== "elite" ? "Pro" : undefined} />
            <NavItem href="/onboarding"           label="Edit profile"    icon="✎" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/study-plan"              label="Study plans"        icon="📅" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/study-plan/focus"       label="Focus timer"        icon="⏱" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/study-plan/mock-tests"   label="Mock test tracker"  icon="📝" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/study-plan/weekly-review" label="Weekly review"       icon="📊" onClick={() => setOpen(false)} />
            <NavItem href="/dashboard/billing"  label="Billing & plan"  icon="💳" onClick={() => setOpen(false)} />
            <NavItem href="/marketplace/my-courses" label="My courses"  icon="📚" onClick={() => setOpen(false)} />

            {isAdmin && (
              <>
                <div
                  className="mx-3 my-1 border-t"
                  style={{ borderColor: "var(--border)" }}
                />
                <NavItem href="/admin" label="Admin panel" icon="⚙" onClick={() => setOpen(false)} />
              </>
            )}

            <div
              className="mx-3 my-1 border-t"
              style={{ borderColor: "var(--border)" }}
            />

            {/* Danger zone */}
            <Link
              href="/account/delete"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors rounded-lg w-full"
              style={{ color: "rgba(239,68,68,0.70)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.08)"
                e.currentTarget.style.color = "rgb(239,68,68)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "rgba(239,68,68,0.70)"
              }}
            >
              <span style={{ width: "16px", textAlign: "center", fontSize: "13px" }}>🗑</span>
              <span className="flex-1">Delete account</span>
            </Link>

            {/* Sign out — form action */}
            <form action={signOut} className="w-full">
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors rounded-lg mx-auto"
                style={{
                  color: "rgba(239,68,68,0.80)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.08)"
                  e.currentTarget.style.color = "rgb(239,68,68)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                  e.currentTarget.style.color = "rgba(239,68,68,0.80)"
                }}
              >
                <span style={{ width: "16px", textAlign: "center" }}>↩</span>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Nav item helper ──────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon,
  badge,
  onClick,
}: {
  href:     string
  label:    string
  icon:     string
  badge?:   string
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors rounded-lg"
      style={{ color: "rgba(255,255,255,0.60)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)"
        e.currentTarget.style.color = "rgba(255,255,255,0.85)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "rgba(255,255,255,0.60)"
      }}
    >
      <span style={{ width: "16px", textAlign: "center", fontSize: "13px" }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background: "var(--gold-faint)",
            border: "1px solid var(--gold-border)",
            color: "var(--gold)",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}