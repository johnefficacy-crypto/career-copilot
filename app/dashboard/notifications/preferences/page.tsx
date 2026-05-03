"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"

type DigestFrequency = "instant" | "daily" | "weekly"
type Priority = "low" | "medium" | "high"

interface Preferences {
  email_enabled: boolean
  email_digest_frequency: DigestFrequency
  min_priority_email: Priority
  in_app_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

const DEFAULT_PREFS: Preferences = {
  email_enabled: false,
  email_digest_frequency: "daily",
  min_priority_email: "medium",
  in_app_enabled: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

const FREQ_OPTIONS: { value: DigestFrequency; label: string; desc: string }[] = [
  { value: "instant", label: "Instant",  desc: "As soon as a match is found" },
  { value: "daily",   label: "Daily",    desc: "One digest at 8 AM IST" },
  { value: "weekly",  label: "Weekly",   desc: "Monday morning summary" },
]

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string }[] = [
  { value: "high",   label: "High only",    desc: "Deadlines within 3 days, urgent matches" },
  { value: "medium", label: "Medium & above", desc: "Matches, deadline reminders, status changes" },
  { value: "low",    label: "All alerts",    desc: "Every notification including minor updates" },
]

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors"
      style={{
        background: checked ? "rgba(232,213,163,0.85)" : "rgba(255,255,255,0.10)",
        borderColor: checked ? "rgba(232,213,163,0.60)" : "rgba(255,255,255,0.12)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="inline-block h-4 w-4 translate-y-[-0px] rounded-full shadow transition-transform"
        style={{
          background: checked ? "#0f0f0f" : "rgba(255,255,255,0.50)",
          transform: checked ? "translateX(20px)" : "translateX(2px)",
          marginTop: 1,
        }}
      />
    </button>
  )
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; desc: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className="w-full text-left rounded-xl px-4 py-3 transition-colors"
          style={{
            background: value === opt.value ? "rgba(232,213,163,0.07)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${value === opt.value ? "rgba(232,213,163,0.30)" : "rgba(255,255,255,0.07)"}`,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
              style={{
                borderColor: value === opt.value ? "#e8d5a3" : "rgba(255,255,255,0.25)",
                background: value === opt.value ? "#e8d5a3" : "transparent",
              }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: value === opt.value ? "#e8d5a3" : "rgba(255,255,255,0.70)" }}>
                {opt.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {opt.desc}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then(r => r.json())
      .then(({ preferences }) => {
        if (preferences) {
          setPrefs({
            email_enabled:          preferences.email_enabled          ?? false,
            email_digest_frequency: preferences.email_digest_frequency ?? "daily",
            min_priority_email:     preferences.min_priority_email     ?? "medium",
            in_app_enabled:         preferences.in_app_enabled         ?? true,
            quiet_hours_start:      preferences.quiet_hours_start      ?? null,
            quiet_hours_end:        preferences.quiet_hours_end        ?? null,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function patch<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs(p => ({ ...p, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const { error: msg } = await res.json().catch(() => ({ error: "Unknown error" }))
        setError(msg ?? "Failed to save")
      }
    })
  }

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{ background: "rgba(15,15,15,0.90)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard/notifications" className="text-sm" style={{ color: "rgba(255,255,255,0.30)" }}>
            ← Notifications
          </Link>
          <span style={{ color: "rgba(255,255,255,0.10)" }}>/</span>
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>Preferences</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="mb-2">
          <h1 className="font-serif text-2xl text-white font-medium mb-1">Notification preferences</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Control how and when Career Copilot contacts you. Email defaults to off per DPDP Act — opt in below.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-32 animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* In-app */}
            <Section title="In-app notifications">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">In-app alerts</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Show alerts in the dashboard notification panel
                  </p>
                </div>
                <Toggle
                  checked={prefs.in_app_enabled}
                  onChange={v => patch("in_app_enabled", v)}
                />
              </div>
            </Section>

            {/* Email */}
            <Section title="Email notifications">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Email alerts</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Receive exam match and deadline alerts by email
                  </p>
                </div>
                <Toggle
                  checked={prefs.email_enabled}
                  onChange={v => patch("email_enabled", v)}
                />
              </div>

              {prefs.email_enabled && (
                <>
                  <div>
                    <p className="text-sm font-medium text-white mb-3">Digest frequency</p>
                    <RadioGroup
                      options={FREQ_OPTIONS}
                      value={prefs.email_digest_frequency}
                      onChange={v => patch("email_digest_frequency", v)}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white mb-3">Minimum priority to email</p>
                    <RadioGroup
                      options={PRIORITY_OPTIONS}
                      value={prefs.min_priority_email}
                      onChange={v => patch("min_priority_email", v)}
                    />
                  </div>
                </>
              )}
            </Section>

            {/* Quiet hours */}
            <Section title="Quiet hours">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Suppress in-app alerts during these hours (IST). Leave blank to receive alerts any time.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    From
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_start ?? ""}
                    onChange={e => patch("quiet_hours_start", e.target.value || null)}
                    className="w-full text-sm px-3 py-2 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.70)",
                      outline: "none",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    Until
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end ?? ""}
                    onChange={e => patch("quiet_hours_end", e.target.value || null)}
                    className="w-full text-sm px-3 py-2 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.70)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </Section>

            {/* Save */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-opacity"
                style={{
                  background: "rgba(232,213,163,0.90)",
                  color: "#0f0f0f",
                  opacity: isPending ? 0.6 : 1,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Saving…" : "Save preferences"}
              </button>

              {saved && (
                <span className="text-sm" style={{ color: "#86efac" }}>
                  ✓ Saved
                </span>
              )}
              {error && (
                <span className="text-sm" style={{ color: "#f87171" }}>
                  {error}
                </span>
              )}
            </div>

            {/* DPDP compliance note */}
            <p className="text-xs pt-2 pb-6" style={{ color: "rgba(255,255,255,0.20)" }}>
              Career Copilot complies with India&apos;s Digital Personal Data Protection Act 2023.
              Email notifications are opt-in only and include an unsubscribe link in every email.
              You can update or withdraw consent here at any time.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
