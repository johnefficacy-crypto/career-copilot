import Link from "next/link"
import type { ForumCategory } from "@/types/forum"

interface Props {
  categories:  ForumCategory[]
  activeSlug?: string
  activeTag?:  string
}

export function CategorySidebar({ categories, activeSlug, activeTag }: Props) {
  return (
    <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start">
      <div className="flex flex-col gap-1">
        {/* All discussions */}
        <SidebarLink
          href="/forum"
          label="All discussions"
          icon="💬"
          active={!activeSlug && !activeTag}
          count={null}
        />

        <div
          className="my-2 border-t"
          style={{ borderColor: "var(--border)" }}
        />

        {/* Categories */}
        {categories.map((cat) => (
          <SidebarLink
            key={cat.id}
            href={`/forum?category=${cat.slug}`}
            label={cat.name}
            icon={cat.icon ?? "📁"}
            active={activeSlug === cat.slug}
            count={cat.post_count}
          />
        ))}

        <div
          className="my-2 border-t"
          style={{ borderColor: "var(--border)" }}
        />

        {/* Meta links */}
        <SidebarLink href="/forum/leaderboard" label="Leaderboard"    icon="🏆" active={false} count={null} />
        <SidebarLink href="/forum/new"          label="New discussion" icon="✏"  active={false} count={null} />
      </div>
    </aside>
  )
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  count,
}: {
  href:   string
  label:  string
  icon:   string
  active: boolean
  count:  number | null
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors"
      style={{
        background: active ? "var(--gold-faint)" : "transparent",
        border:     active ? "1px solid var(--gold-border)" : "1px solid transparent",
        color:      active ? "var(--gold)" : "rgba(255,255,255,0.55)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {count !== null && count > 0 && (
        <span
          className="text-xs shrink-0 ml-1"
          style={{ color: active ? "var(--gold-dim)" : "var(--text-ghost)" }}
        >
          {count > 999 ? `${Math.floor(count / 1000)}k` : count}
        </span>
      )}
    </Link>
  )
}