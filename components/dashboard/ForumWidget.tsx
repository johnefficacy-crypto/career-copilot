// components/dashboard/ForumWidget.tsx
// Career Copilot — Phase 9: Forum snapshot on dashboard

import Link from "next/link"
import type { ForumPostSummary } from "@/types/forum"
import { timeAgo } from "@/lib/utils/dates"

interface ForumWidgetProps {
  recentPosts: ForumPostSummary[]
}

export function ForumWidget({ recentPosts }: ForumWidgetProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="text-base">💬</span>
          <p className="text-white/60 text-sm font-medium">Community</p>
        </div>
        <Link href="/forum" className="text-white/25 text-xs hover:text-[#e8d5a3]/60 transition-colors">
          View forum →
        </Link>
      </div>

      {recentPosts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-white/25 text-sm mb-3">No discussions yet</p>
          <Link href="/forum/new" className="text-[#e8d5a3]/60 text-xs hover:text-[#e8d5a3] transition-colors">
            Start the first discussion →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {recentPosts.slice(0, 4).map(post => (
            <Link
              key={post.id}
              href={`/forum/post/${post.id}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors group"
            >
              <div className="flex flex-col items-center gap-0.5 min-w-[32px] pt-0.5">
                <span className="text-white/15 text-[10px]">▲</span>
                <span className="text-white/30 text-xs font-mono">{post.upvote_count}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs leading-snug group-hover:text-white/80 transition-colors line-clamp-2 mb-1">
                  {post.title}
                </p>
                <div className="flex items-center gap-2 text-white/20 text-[10px]">
                  {post.category && (
                    <span>{post.category.icon} {post.category.name}</span>
                  )}
                  <span>·</span>
                  <span>💬 {post.reply_count}</span>
                  <span>·</span>
                  <span>{timeAgo(post.created_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="px-5 py-3 border-t border-white/[0.05]">
        <Link
          href="/forum/new"
          className="block w-full text-center text-white/30 text-xs py-1 hover:text-[#e8d5a3]/60 transition-colors"
        >
          + Start a discussion
        </Link>
      </div>
    </div>
  )
}