/**
 * app/admin/layout.tsx
 * Career Copilot — Admin Layout
 *
 * FIXES:
 *  - Added "Scrape Dashboard" → /admin/scrape
 *  - Added "Source Registry"  → /admin/sources
 *  - Active link highlight via pathname comparison
 *  - Removed duplicate /admin/scraping route reference (consolidated to /admin/scrape)
 */

import { redirect }     from "next/navigation"
import { headers }      from "next/headers"
import Link             from "next/link"
import { createClient } from "@/utils/supabase/server"

export const metadata = { title: "Admin — Career Copilot" }

const NAV_ITEMS = [
  { href: "/admin",                   label: "Overview",           icon: "⌘" },
  { href: "/admin/recruitments",      label: "Recruitments",       icon: "📋" },
  { href: "/admin/organizations",     label: "Organizations",      icon: "🏛" },
  { href: "/admin/eligibility",       label: "Eligibility",        icon: "✅" },
  { href: "/admin/scrape",            label: "Scrape Dashboard",   icon: "🔄" },
  { href: "/admin/sources",           label: "Source Registry",    icon: "🗂" },
  { href: "/admin/notifications",     label: "Notifications",      icon: "🔔" },
  { href: "/admin/recruitment-feedback", label: "Recruitment Feedback", icon: "🧾" },
  { href: "/admin/eligibility-queue", label: "Eligibility Queue",  icon: "⚙" },
  { href: "/admin/audit",             label: "Audit Log",          icon: "🗒" },
  { href: "/admin/rbac",              label: "RBAC",               icon: "🔑" },
  { href: "/admin/ai-policy",         label: "AI Policy",          icon: "🤖" },
  { href: "/admin/community",         label: "Community Mod",      icon: "🛡️" },
  { href: "/admin/control-support",   label: "Control Support",    icon: "📈" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/dashboard")

  // Read current pathname for active link detection
  const headersList = await headers()
  const pathname    = headersList.get("x-pathname") ?? ""

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-white/[0.06] flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/[0.06] shrink-0">
          <span
            className="text-[#e8d5a3] font-semibold text-sm"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Career Copilot
          </span>
          <span className="ml-2 text-[10px] uppercase tracking-wider bg-[#e8d5a3]/10 text-[#e8d5a3]/60 border border-[#e8d5a3]/20 px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color:      isActive ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.40)",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  fontWeight: isActive ? "500" : "400",
                }}
              >
                <span className="text-base leading-none opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <p className="text-white/30 text-xs truncate mb-1">{profile.full_name}</p>
          <Link
            href="/dashboard"
            className="text-[#e8d5a3]/40 text-xs hover:text-[#e8d5a3] transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}