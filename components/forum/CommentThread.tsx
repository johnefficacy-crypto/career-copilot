"use client"

import type { ForumCommentWithAuthor } from "@/types/forum"
import { upvoteCommentAction, deleteCommentAction, markBestAnswerAction, reportForumContentAction } from "@/actions/forum"
import { CommentForm } from "./CommentForm"
import { timeAgo } from "@/lib/utils/dates"

interface Props {
  comments:     ForumCommentWithAuthor[]
  postId:       string
  postAuthorId: string
  viewerId:     string | null
  isLocked:     boolean
}

export function CommentThread({
  comments,
  postId,
  postAuthorId,
  viewerId,
  isLocked,
}: Props) {
  if (comments.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No comments yet. Be the first to reply!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          postAuthorId={postAuthorId}
          viewerId={viewerId}
          isLocked={isLocked}
          depth={0}
        />
      ))}
    </div>
  )
}

// ─── Single comment ───────────────────────────────────────────────────────────

interface ItemProps {
  comment:      ForumCommentWithAuthor
  postId:       string
  postAuthorId: string
  viewerId:     string | null
  isLocked:     boolean
  depth:        number
}

function CommentItem({
  comment,
  postId,
  postAuthorId,
  viewerId,
  isLocked,
  depth,
}: ItemProps) {
  const isCommentAuthor = viewerId === comment.user_id
  const isPostAuthor    = viewerId === postAuthorId
  const isLoggedIn      = !!viewerId

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:  comment.is_accepted ? "rgba(16,185,129,0.05)" : "var(--bg-surface)",
        border:      `1px solid ${comment.is_accepted ? "var(--success-border)" : "var(--border)"}`,
        marginLeft:  depth > 0 ? "2rem" : undefined,
      }}
    >
      {/* Best answer badge */}
      {comment.is_accepted && (
        <div
          className="flex items-center gap-1.5 text-xs mb-3 px-2.5 py-1 rounded-full w-fit"
          style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)" }}
        >
          ✓ Best answer
        </div>
      )}

      {/* Author row */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold)" }}
        >
          {comment.author_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
          {comment.author_name ?? "Aspirant"}
          {comment.user_id === postAuthorId && (
            <span
              className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold)" }}
            >
              OP
            </span>
          )}
        </span>
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
          {timeAgo(comment.created_at)}
        </span>
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
        {comment.body}
      </p>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Upvote comment */}
        <form action={upvoteCommentAction}>
          <input type="hidden" name="comment_id" value={comment.id} />
          <input type="hidden" name="post_id"    value={postId}     />
          <button
            type={isLoggedIn ? "submit" : "button"}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: comment.viewer_upvoted ? "var(--gold-faint)" : "transparent",
              border: `1px solid ${comment.viewer_upvoted ? "var(--gold-border)" : "var(--border)"}`,
              color: comment.viewer_upvoted ? "var(--gold)" : "var(--text-muted)",
            }}
          >
            ▲ {comment.upvote_count}
          </button>
        </form>

        {/* Mark best answer (post author, top-level only) */}
        {isPostAuthor && depth === 0 && !isLocked && !comment.is_accepted && (
          <form action={markBestAnswerAction}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="post_id"    value={postId}     />
            <button
              type="submit"
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid var(--success-border)", color: "var(--success)", background: "transparent" }}
            >
              ✓ Mark answer
            </button>
          </form>
        )}

        {/* Report comment */}
        {isLoggedIn && !isCommentAuthor && (
          <details>
            <summary className="text-xs cursor-pointer" style={{ color: "var(--text-dim)" }}>Report</summary>
            <form action={reportForumContentAction} className="mt-2 flex flex-col gap-2 min-w-[220px]">
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="post_page_id" value={postId} />
              <input name="reason" placeholder="Reason" className="px-2 py-1 rounded-md text-xs bg-black/40 border border-white/20 text-white" required />
              <button type="submit" className="text-xs px-2 py-1 rounded-md border border-amber-400/40 text-amber-300">Submit</button>
            </form>
          </details>
        )}

        {/* Delete (comment author) */}
        {isCommentAuthor && (
          <form action={deleteCommentAction}>
            <input type="hidden" name="comment_id" value={comment.id} />
            <input type="hidden" name="post_id"    value={postId}     />
            <button
              type="submit"
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-dim)", background: "transparent" }}
              onClick={(e) => {
                if (!confirm("Delete this comment?")) e.preventDefault()
              }}
            >
              Delete
            </button>
          </form>
        )}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              postAuthorId={postAuthorId}
              viewerId={viewerId}
              isLocked={isLocked}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {/* Reply form — inline, depth 0 only to avoid deep nesting */}
      {!isLocked && isLoggedIn && depth === 0 && (
        <details className="mt-4">
          <summary
            className="text-xs cursor-pointer select-none"
            style={{ color: "var(--text-dim)" }}
          >
            Reply ↩
          </summary>
          <div className="mt-3">
            <CommentForm postId={postId} parentId={comment.id} />
          </div>
        </details>
      )}
    </div>
  )
}