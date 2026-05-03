"use client"

/**
 * OnboardingProgress — client component that uses usePathname() to
 * determine the current step. The layout is NOT re-rendered on child
 * navigation in Next.js App Router, so the DB-derived step is stale
 * after the first render. Reading the path client-side is always accurate.
 */

import { usePathname } from "next/navigation"

const STEPS = [
  { label: "Profile",     path: "/onboarding"              },
  { label: "Identity",    path: "/onboarding/identity"     },
  { label: "Education",   path: "/onboarding/education"    },
  { label: "Experience",  path: "/onboarding/experience"   },
  { label: "Preferences", path: "/onboarding/preferences"  },
  { label: "Done",        path: "/onboarding/complete"     },
]

export function OnboardingProgress() {
  const pathname = usePathname()

  // Find which step we're on by exact path match
  const activeIdx = (() => {
    const idx = STEPS.findIndex((s) => s.path === pathname)
    return idx === -1 ? 0 : idx
  })()

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done   = i < activeIdx
        const active = i === activeIdx

        return (
          <div key={step.path} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors"
                style={{
                  background: done ? "var(--gold)" : "transparent",
                  border: done
                    ? "none"
                    : active
                    ? "2px solid var(--gold)"
                    : "1px solid var(--border-md)",
                  color: done
                    ? "#0c0c0c"
                    : active
                    ? "var(--gold)"
                    : "var(--text-dim)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="text-[10px] hidden sm:block"
                style={{ color: active ? "var(--gold-dim)" : "var(--text-ghost)" }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{
                  background: i < activeIdx ? "var(--gold-border)" : "var(--border)",
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
