import Link from "next/link"
import { UserNav } from "@/components/nav/UserNav"

interface Props {
  fullName:  string | null
  planId:    string | null
  avatarUrl: string | null
  isAdmin:   boolean
}

export function DashboardNav({ fullName, planId, avatarUrl, isAdmin }: Props) {
  return (
    <nav
      className="border-b sticky top-0 z-40 backdrop-blur-md"
      style={{
        borderColor: "var(--border)",
        background: "rgba(15,15,15,0.85)",
        height: "56px",
      }}
    >
      <div
        className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between"
      >
        {/* Left — logo + page nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight shrink-0"
            style={{ fontFamily: "var(--font-serif)", color: "var(--gold)" }}
          >
            Career Copilot
          </Link>

          {/* Primary nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard",           label: "Dashboard"    },
              { href: "/dashboard/exams",      label: "Exams"        },
              { href: "/dashboard/tracker",    label: "Tracker"      },
              { href: "/dashboard/chat",       label: "AI Chat"      },
              { href: "/dashboard/study-plan", label: "Study Plan"   },
              { href: "/marketplace",          label: "Marketplace"  },
              { href: "/dashboard/support",   label: "Support"      },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors cc-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right — user nav */}
        <UserNav
          fullName={fullName}
          planId={planId}
          avatarUrl={avatarUrl}
          isAdmin={isAdmin}
        />
      </div>
    </nav>
  )
}