/**
 * lib/db/forum-dashboard.ts
 *
 * Lightweight forum queries used only by the dashboard page.
 * Kept separate from lib/db/forum.ts to avoid loading the full
 * forum module (with its large listForumPosts logic) on every
 * dashboard render.
 */

import { createClient } from "@/utils/supabase/server"
import type { ForumPostSummary } from "@/types/forum"

type RecentPostRow = {
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
  forum_categories: {
    id:    string
    name:  string
    slug:  string
    icon:  string | null
    color: string | null
  } | null
  profiles: {
    full_name:  string | null
    avatar_url: string | null
  } | null
}

type RepRow = {
  points:      number
  posts_count: number
}

/**
 * Returns the 4 most recent posts for the dashboard ForumWidget.
 */
export async function getRecentForumPosts(limit = 4): Promise<ForumPostSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("forum_posts")
    .select("id, user_id, category_id, title, body, exam_tags, is_pinned, is_locked, upvote_count, view_count, reply_count, created_at, updated_at, forum_categories!category_id(id, name, slug, icon, color), profiles!user_id(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentForumPosts: ${error.message}`)

  return ((data as RecentPostRow[]) ?? []).map((r) => ({
    id:           r.id,
    user_id:      r.user_id,
    category_id:  r.category_id,
    title:        r.title,
    body:         r.body,
    exam_tags:    r.exam_tags ?? [],
    is_pinned:    r.is_pinned,
    is_locked:    r.is_locked,
    upvote_count: r.upvote_count,
    view_count:   r.view_count,
    reply_count:  r.reply_count,
    created_at:   r.created_at,
    updated_at:   r.updated_at,
    category: {
      id:    r.forum_categories?.id    ?? "",
      name:  r.forum_categories?.name  ?? "",
      slug:  r.forum_categories?.slug  ?? "",
      icon:  r.forum_categories?.icon  ?? null,
      color: r.forum_categories?.color ?? null,
    },
    author_name:    r.profiles?.full_name  ?? null,
    author_avatar:  r.profiles?.avatar_url ?? null,
    viewer_upvoted: false,
    viewer_saved:   false,
    comments:       [],
  }))
}

/**
 * Returns the user's reputation points and post count for the dashboard badge.
 */
export async function getUserForumStats(
  userId: string
): Promise<{ points: number; postsCount: number }> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("forum_reputation")
    .select("points, posts_count")
    .eq("user_id", userId)
    .maybeSingle()

  const row = data as RepRow | null
  return {
    points:     row?.points      ?? 0,
    postsCount: row?.posts_count ?? 0,
  }
}