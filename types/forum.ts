/**
 * types/forum.ts
 * Phase 9 — Community Forum
 *
 * All shapes are derived from the real DB schema.
 * Zero `any`. Consumed by lib/db/forum.ts, actions/forum.ts, and all UI.
 */

// ─── Category ────────────────────────────────────────────────────────────────

export type ForumCategory = {
  id:          string
  name:        string
  slug:        string
  description: string | null
  exam_tag:    string | null
  icon:        string | null
  color:       string | null
  post_count:  number
  order_index: number
  is_active:   boolean
  created_at:  string
}

// ─── Post ─────────────────────────────────────────────────────────────────────

export type ForumPost = {
  id:           string
  user_id:      string
  category_id:  string
  title:        string
  body:         string
  exam_tags:    string[]
  is_pinned:    boolean
  is_locked:    boolean
  upvote_count: number
  view_count:   number
  reply_count:  number
  created_at:   string
  updated_at:   string
}

// Post with category + author for list view
export type ForumPostSummary = ForumPost & {
  category:    Pick<ForumCategory, "id" | "name" | "slug" | "icon" | "color">
  author_name: string | null
  author_avatar: string | null
  // Whether the current viewer has upvoted (populated server-side when userId is known)
  viewer_upvoted:  boolean
  viewer_saved:    boolean
}

// Post with full detail for single-post view
export type ForumPostDetail = ForumPostSummary & {
  comments:    ForumCommentWithAuthor[]
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export type ForumComment = {
  id:           string
  post_id:      string
  user_id:      string
  parent_id:    string | null
  body:         string
  upvote_count: number
  is_accepted:  boolean
  created_at:   string
  updated_at:   string
}

export type ForumCommentWithAuthor = ForumComment & {
  author_name:   string | null
  author_avatar: string | null
  viewer_upvoted: boolean
  // Nested replies (one level deep)
  replies:       ForumCommentWithAuthor[]
}

// ─── Reputation ───────────────────────────────────────────────────────────────

export type ForumReputation = {
  user_id:          string
  points:           number
  posts_count:      number
  comments_count:   number
  upvotes_received: number
  best_answers:     number
}

export type LeaderboardEntry = ForumReputation & {
  full_name:   string | null
  avatar_url:  string | null
  target_exam: string | null
}

// ─── Form payloads ────────────────────────────────────────────────────────────

export type CreatePostPayload = {
  category_id: string
  title:       string
  body:        string
  exam_tags:   string[]
}

export type CreateCommentPayload = {
  post_id:   string
  parent_id: string | null
  body:      string
}

// ─── Filter / sort options ────────────────────────────────────────────────────

export type PostSortOrder = "latest" | "top" | "unanswered"

export type ForumFilters = {
  category_slug?: string
  exam_tag?:      string
  query?:         string
  sort?:          PostSortOrder
  page?:          number
}