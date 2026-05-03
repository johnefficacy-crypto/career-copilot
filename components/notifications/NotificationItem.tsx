type NotificationItemProps = {
  title:  string
  body:   string
  kind:   "deadline" | "new_match" | "profile_blocker" | "update"
  unread: boolean
  href:   string
}

const KIND_LABELS: Record<NotificationItemProps["kind"], string> = {
  deadline:        "Deadline",
  new_match:       "New match",
  profile_blocker: "Profile action needed",
  update:          "Update",
}

export function NotificationItem({ title, body, kind, unread, href }: NotificationItemProps) {
  return (
    <li className={`rounded-lg border p-3 ${unread ? "border-white/20 bg-white/5" : "border-white/10"}`}>
      <a href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{body}</p>
          </div>
          <span
            aria-label={unread ? "Unread notification" : "Read notification"}
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              unread ? "bg-blue-900/40 text-blue-400" : "text-muted-foreground"
            }`}
          >
            {unread ? "New" : "Read"}
          </span>
        </div>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          {KIND_LABELS[kind]}
        </p>
      </a>
    </li>
  )
}
