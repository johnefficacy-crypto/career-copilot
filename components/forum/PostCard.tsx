import Link from "next/link"
import type { ForumPostSummary } from "@/types/forum"
import { timeAgo } from "@/lib/utils/dates"

interface Props {
  post:     ForumPostSummary
  viewerId: string | null
}

export function PostCard({ post }: Props) {
  const hasAcceptedAnswer = false

  return (
    <Link
      href={`/forum/post/${post.id}`}
      className="block rounded-2xl px-5 py-4 transition-colors"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-md)"
        e.currentTarget.style.background  = "var(--bg-surface-md)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)"
        e.currentTarget.style.background  = "var(--bg-surface)"
      }}
    >
      <div className="flex items-start gap-4">

        {/* Vote + reply counts */}
        <div className="flex flex-col items-center gap-2 shrink-0 w-10 text-center">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: post.upvote_count > 0 ? "rgba(255,255,255,0.75)" : "var(--text-ghost)" }}
            >
              {post.upvote_count}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>votes</p>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: hasAcceptedAnswer
                ? "var(--success-bg)"
                : post.reply_count > 0
                ? "var(--bg-surface-md)"
                : "transparent",
              border: `1px solid ${hasAcceptedAnswer ? "var(--success-border)" : "var(--border)"}`,
            }}
          >
            <span
              className="text-xs font-semibold"
              style={{ color: hasAcceptedAnswer ? "var(--success)" : "var(--text-dim)" }}
            >
              {post.reply_count}
            </span>
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>
            {hasAcceptedAnswer ? "solved" : "replies"}
          </p>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {/* Category badge */}
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--gold-faint)",
                border: "1px solid var(--gold-border)",
                color: "var(--gold-dim)",
              }}
            >
              {post.category.icon} {post.category.name}
            </span>

            {/* Pinned */}
            {post.is_pinned && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                📌
              </span>
            )}

            {/* Exam tags */}
            {post.exam_tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-surface-md)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-white mb-1 leading-snug line-clamp-2">
            {post.title}
          </h3>

          {/* Body preview */}
          <p
            className="text-xs line-clamp-1 mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {post.body}
          </p>

          {/* Author + time */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: "var(--gold-faint)", color: "var(--gold)" }}
            >
              {post.author_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {post.author_name ?? "Aspirant"}
            </span>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              {timeAgo(post.created_at)}
            </span>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              {post.view_count} views
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}