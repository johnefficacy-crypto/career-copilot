import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getForumPost } from "@/lib/db/forum"
import { PostBody } from "@/components/forum/PostBody"
import { CommentThread } from "@/components/forum/CommentThread"
import { CommentForm } from "@/components/forum/CommentForm"
import {
  upvotePostAction,
  savePostAction,
  deletePostAction,
  reportForumContentAction,
} from "@/actions/forum"
import { timeAgo } from "@/lib/utils/dates"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("forum_posts")
    .select("title")
    .eq("id", id)
    .maybeSingle()
  return { title: data?.title ? `${data.title} — Forum` : "Forum — Career Copilot" }
}

export default async function ForumPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; reported?: string }>
}) {
  const { id } = await params
  const sp     = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const post = await getForumPost(id, user?.id)
  if (!post) notFound()

  const isAuthor = user?.id === post.user_id
  const isLoggedIn = !!user

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <nav
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{ borderColor: "var(--border)", background: "rgba(15,15,15,0.90)", height: "56px" }}
      >
        <div className="max-w-4xl mx-auto px-6 h-full flex items-center gap-3">
          <Link href="/dashboard" className="cc-logo">Career Copilot</Link>
          <span style={{ color: "var(--border-md)" }}>/</span>
          <Link href="/forum" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.50)" }}>
            Forum
          </Link>
          <span style={{ color: "var(--border-md)" }}>/</span>
          <Link
            href={`/forum?category=${post.category.slug}`}
            className="text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            {post.category.name}
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {sp?.reported && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Thanks — your report was submitted for admin review.</div>
        )}

        {sp?.error && (
          <div className="cc-alert-error mb-5">{decodeURIComponent(sp.error)}</div>
        )}

        {/* ── Post ─────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-7 mb-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Category badge */}
            <Link
              href={`/forum?category=${post.category.slug}`}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: "var(--gold-faint)",
                border: "1px solid var(--gold-border)",
                color: "var(--gold)",
              }}
            >
              <span>{post.category.icon}</span>
              {post.category.name}
            </Link>

            {/* Exam tags */}
            {post.exam_tags.map((tag) => (
              <Link
                key={tag}
                href={`/forum?tag=${encodeURIComponent(tag)}`}
                className="text-xs px-2 py-0.5 rounded-full transition-colors"
                style={{ background: "var(--bg-surface-md)", border: "1px solid var(--border-md)", color: "var(--text-muted)" }}
              >
                {tag}
              </Link>
            ))}

            {post.is_pinned && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
                📌 Pinned
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-2xl font-medium text-white mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {post.title}
          </h1>

          {/* Author + time */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold)" }}
            >
              {post.author_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              {post.author_name ?? "Aspirant"}
            </span>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {timeAgo(post.created_at)}
            </span>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {post.view_count} views
            </span>
          </div>

          {/* Body */}
          <PostBody body={post.body} />

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
            {/* Upvote */}
            <form action={upvotePostAction}>
              <input type="hidden" name="post_id" value={post.id} />
              <button
                type={isLoggedIn ? "submit" : "button"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors"
                style={{
                  background: post.viewer_upvoted ? "var(--gold-faint)" : "transparent",
                  border: `1px solid ${post.viewer_upvoted ? "var(--gold-border)" : "var(--border)"}`,
                  color: post.viewer_upvoted ? "var(--gold)" : "var(--text-muted)",
                }}
              >
                ▲ {post.upvote_count}
              </button>
            </form>

            {/* Save */}
            <form action={savePostAction}>
              <input type="hidden" name="post_id" value={post.id} />
              <button
                type={isLoggedIn ? "submit" : "button"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors"
                style={{
                  background: post.viewer_saved ? "var(--bg-surface-md)" : "transparent",
                  border: "1px solid var(--border)",
                  color: post.viewer_saved ? "rgba(255,255,255,0.80)" : "var(--text-muted)",
                }}
              >
                {post.viewer_saved ? "🔖 Saved" : "🔖 Save"}
              </button>
            </form>

            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              {post.reply_count} comment{post.reply_count !== 1 ? "s" : ""}
            </span>

            {isLoggedIn && !isAuthor && (
              <details className="ml-auto">
                <summary className="text-xs cursor-pointer" style={{ color: "var(--text-dim)" }}>Report post</summary>
                <form action={reportForumContentAction} className="mt-2 flex flex-col gap-2 min-w-[240px]">
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="post_page_id" value={post.id} />
                  <input name="reason" placeholder="Reason (e.g. misleading info)" className="px-2 py-1.5 rounded-md text-xs bg-black/40 border border-white/20 text-white" required />
                  <textarea name="details" rows={2} placeholder="Optional details" className="px-2 py-1.5 rounded-md text-xs bg-black/40 border border-white/20 text-white" />
                  <button type="submit" className="text-xs px-2.5 py-1.5 rounded-md border border-amber-400/40 text-amber-300">Submit report</button>
                </form>
              </details>
            )}

            {/* Delete (author only) */}
            {isAuthor && (
              <form action={deletePostAction} className="ml-auto">
                <input type="hidden" name="post_id"       value={post.id}           />
                <input type="hidden" name="category_slug" value={post.category.slug} />
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded-xl transition-colors"
                  style={{ border: "1px solid var(--danger-border)", color: "var(--danger)", background: "transparent" }}
                >
                  Delete post
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Comments ─────────────────────────────────────────────────── */}
        <div id="comments">
          <h2
            className="text-base font-medium text-white mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {post.reply_count} comment{post.reply_count !== 1 ? "s" : ""}
          </h2>

          <CommentThread
            comments={post.comments}
            postId={post.id}
            postAuthorId={post.user_id}
            viewerId={user?.id ?? null}
            isLocked={post.is_locked}
          />

          {/* Add comment */}
          {!post.is_locked && (
            <div className="mt-6">
              {isLoggedIn ? (
                <CommentForm postId={post.id} parentId={null} />
              ) : (
                <div
                  className="rounded-2xl p-6 text-center"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                    Sign in to join the discussion
                  </p>
                  <Link
                    href="/auth/login"
                    className="inline-block px-5 py-2 rounded-xl text-sm transition-colors"
                    style={{ background: "var(--gold)", color: "#0c0c0c" }}
                  >
                    Sign in →
                  </Link>
                </div>
              )}
            </div>
          )}

          {post.is_locked && (
            <div
              className="rounded-2xl p-4 mt-4 text-center"
              style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--warning)" }}>
                🔒 This post is locked and no longer accepting comments.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}