/**
 * lib/db/forum.ts
 * Phase 9 — Community Forum
 *
 * All .select() calls use single unbroken string literals (no + concatenation)
 * to prevent the Supabase GenericStringError inference bug.
 * Local row types declared for every query result.
 * Zero `any`.
 */

import { createClient } from "@/utils/supabase/server"
import type {
  ForumCategory,
  ForumPost,
  ForumPostSummary,
  ForumPostDetail,
  ForumComment,
  ForumCommentWithAuthor,
  LeaderboardEntry,
  ForumFilters,
  PostSortOrder,
} from "@/types/forum"

const PAGE_SIZE = 20

// ─── Local DB row types ───────────────────────────────────────────────────────

type CategoryRow = {
  id: string; name: string; slug: string; description: string | null
  exam_tag: string | null; icon: string | null; color: string | null
  post_count: number; order_index: number; is_active: boolean; created_at: string
}

type PostRow = {
  id: string; user_id: string; category_id: string; title: string; body: string
  exam_tags: string[]; is_pinned: boolean; is_locked: boolean
  upvote_count: number; view_count: number; reply_count: number
  created_at: string; updated_at: string
  forum_categories: { id: string; name: string; slug: string; icon: string | null; color: string | null } | null
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

type CommentRow = {
  id: string; post_id: string; user_id: string; parent_id: string | null
  body: string; upvote_count: number; is_accepted: boolean
  created_at: string; updated_at: string
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

type ReputationRow = {
  user_id: string; points: number; posts_count: number
  comments_count: number; upvotes_received: number; best_answers: number
  profiles: { full_name: string | null; avatar_url: string | null; target_exam: string | null } | null
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getForumCategories(): Promise<ForumCategory[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("forum_categories")
    .select("id, name, slug, description, exam_tag, icon, color, post_count, order_index, is_active, created_at")
    .eq("is_active", true)
    .order("order_index")

  if (error) throw new Error(`getForumCategories: ${error.message}`)
  return (data as CategoryRow[]).map((r) => ({ ...r }))
}

export async function getCategoryBySlug(slug: string): Promise<ForumCategory | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("forum_categories")
    .select("id, name, slug, description, exam_tag, icon, color, post_count, order_index, is_active, created_at")
    .eq("slug", slug)
    .maybeSingle()

  return (data as CategoryRow | null)
}

// ─── Posts — list ─────────────────────────────────────────────────────────────

export async function listForumPosts(
  filters: ForumFilters,
  viewerUserId?: string
): Promise<{ posts: ForumPostSummary[]; total: number }> {
  const supabase = await createClient()

  const page   = filters.page ?? 1
  const from   = (page - 1) * PAGE_SIZE
  const to     = from + PAGE_SIZE - 1
  const sort   = filters.sort ?? "latest"

  let q = supabase
    .from("forum_posts")
    .select("id, user_id, category_id, title, body, exam_tags, is_pinned, is_locked, upvote_count, view_count, reply_count, created_at, updated_at, forum_categories!category_id(id, name, slug, icon, color), profiles!user_id(full_name, avatar_url)", { count: "exact" })

  if (filters.category_slug) {
    const cat = await getCategoryBySlug(filters.category_slug)
    if (cat) q = q.eq("category_id", cat.id)
  }

  if (filters.exam_tag) {
    q = q.contains("exam_tags", [filters.exam_tag])
  }

  if (filters.query) {
    // Full-text search using the generated search_vector column
    q = q.textSearch("search_vector", filters.query, { type: "websearch" })
  }

  // Pinned posts always first
  switch (sort) {
    case "top":
      q = q.order("is_pinned", { ascending: false })
           .order("upvote_count", { ascending: false })
      break
    case "unanswered":
      q = q.eq("reply_count", 0)
           .order("is_pinned", { ascending: false })
           .order("created_at", { ascending: false })
      break
    default:
      q = q.order("is_pinned", { ascending: false })
           .order("created_at", { ascending: false })
  }

  q = q.range(from, to)

  const { data, error, count } = await q
  if (error) throw new Error(`listForumPosts: ${error.message}`)

  const rows = (data as PostRow[]) ?? []

  // Fetch viewer's upvoted and saved post IDs in parallel
  let upvotedIds = new Set<string>()
  let savedIds   = new Set<string>()

  if (viewerUserId && rows.length > 0) {
    const postIds = rows.map((r) => r.id)
    const [uvRes, svRes] = await Promise.all([
      supabase.from("forum_post_upvotes").select("post_id").eq("user_id", viewerUserId).in("post_id", postIds),
      supabase.from("forum_saved_posts").select("post_id").eq("user_id", viewerUserId).in("post_id", postIds),
    ])
    upvotedIds = new Set((uvRes.data ?? []).map((r: { post_id: string }) => r.post_id))
    savedIds   = new Set((svRes.data ?? []).map((r: { post_id: string }) => r.post_id))
  }

  const posts: ForumPostSummary[] = rows.map((r) => ({
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
    viewer_upvoted: upvotedIds.has(r.id),
    viewer_saved:   savedIds.has(r.id),
    comments:       [],
  }))

  return { posts, total: count ?? 0 }
}

// ─── Posts — single ───────────────────────────────────────────────────────────

export async function getForumPost(
  postId: string,
  viewerUserId?: string
): Promise<ForumPostDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("forum_posts")
    .select("id, user_id, category_id, title, body, exam_tags, is_pinned, is_locked, upvote_count, view_count, reply_count, created_at, updated_at, forum_categories!category_id(id, name, slug, icon, color), profiles!user_id(full_name, avatar_url)")
    .eq("id", postId)
    .single()

  if (error || !data) return null

  const row = data as PostRow

  // Increment view count (fire-and-forget — non-critical)
  supabase.from("forum_posts")
    .update({ view_count: row.view_count + 1 })
    .eq("id", postId)
    .then(() => {}) // intentionally not awaited

  const comments = await getPostComments(postId, viewerUserId)

  // Check viewer's upvote and save state
  let viewerUpvoted = false
  let viewerSaved   = false
  if (viewerUserId) {
    const [uvRes, svRes] = await Promise.all([
      supabase.from("forum_post_upvotes").select("post_id").eq("user_id", viewerUserId).eq("post_id", postId).maybeSingle(),
      supabase.from("forum_saved_posts").select("post_id").eq("user_id", viewerUserId).eq("post_id", postId).maybeSingle(),
    ])
    viewerUpvoted = !!uvRes.data
    viewerSaved   = !!svRes.data
  }

  return {
    id:           row.id,
    user_id:      row.user_id,
    category_id:  row.category_id,
    title:        row.title,
    body:         row.body,
    exam_tags:    row.exam_tags ?? [],
    is_pinned:    row.is_pinned,
    is_locked:    row.is_locked,
    upvote_count: row.upvote_count,
    view_count:   row.view_count + 1,
    reply_count:  row.reply_count,
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    category: {
      id:    row.forum_categories?.id    ?? "",
      name:  row.forum_categories?.name  ?? "",
      slug:  row.forum_categories?.slug  ?? "",
      icon:  row.forum_categories?.icon  ?? null,
      color: row.forum_categories?.color ?? null,
    },
    author_name:    row.profiles?.full_name  ?? null,
    author_avatar:  row.profiles?.avatar_url ?? null,
    viewer_upvoted: viewerUpvoted,
    viewer_saved:   viewerSaved,
    comments,
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getPostComments(
  postId: string,
  viewerUserId?: string
): Promise<ForumCommentWithAuthor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("forum_comments")
    .select("id, post_id, user_id, parent_id, body, upvote_count, is_accepted, created_at, updated_at, profiles!user_id(full_name, avatar_url)")
    .eq("post_id", postId)
    .order("is_accepted", { ascending: false })
    .order("upvote_count",  { ascending: false })
    .order("created_at",    { ascending: true })

  if (error) throw new Error(`getPostComments: ${error.message}`)

  const rows = (data as CommentRow[]) ?? []

  // Batch-fetch viewer's upvoted comment IDs
  let upvotedIds = new Set<string>()
  if (viewerUserId && rows.length > 0) {
    const commentIds = rows.map((r) => r.id)
    const { data: uvData } = await supabase
      .from("forum_comment_upvotes")
      .select("comment_id")
      .eq("user_id", viewerUserId)
      .in("comment_id", commentIds)
    upvotedIds = new Set((uvData ?? []).map((r: { comment_id: string }) => r.comment_id))
  }

  const toComment = (r: CommentRow): ForumCommentWithAuthor => ({
    id:             r.id,
    post_id:        r.post_id,
    user_id:        r.user_id,
    parent_id:      r.parent_id,
    body:           r.body,
    upvote_count:   r.upvote_count,
    is_accepted:    r.is_accepted,
    created_at:     r.created_at,
    updated_at:     r.updated_at,
    author_name:    r.profiles?.full_name  ?? null,
    author_avatar:  r.profiles?.avatar_url ?? null,
    viewer_upvoted: upvotedIds.has(r.id),
    replies:        [],
  })

  // Build tree: top-level comments + nested replies (one level)
  const topLevel = rows.filter((r) => !r.parent_id).map(toComment)
  const replies  = rows.filter((r) => !!r.parent_id).map(toComment)

  topLevel.forEach((c) => {
    c.replies = replies.filter((r) => r.parent_id === c.id)
  })

  return topLevel
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createPost(
  userId: string,
  data: { category_id: string; title: string; body: string; exam_tags: string[] }
): Promise<string> {
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("forum_posts")
    .insert({
      user_id:     userId,
      category_id: data.category_id,
      title:       data.title.trim(),
      body:        data.body.trim(),
      exam_tags:   data.exam_tags,
    })
    .select("id")
    .single()

  if (error || !row) throw new Error(`createPost: ${error?.message}`)
  return row.id
}

export async function createComment(
  userId: string,
  data: { post_id: string; parent_id: string | null; body: string }
): Promise<string> {
  const supabase = await createClient()

  // Check post is not locked
  const { data: post } = await supabase
    .from("forum_posts")
    .select("is_locked")
    .eq("id", data.post_id)
    .single()

  if (post?.is_locked) throw new Error("This post is locked")

  const { data: row, error } = await supabase
    .from("forum_comments")
    .insert({
      post_id:   data.post_id,
      user_id:   userId,
      parent_id: data.parent_id,
      body:      data.body.trim(),
    })
    .select("id")
    .single()

  if (error || !row) throw new Error(`createComment: ${error?.message}`)
  return row.id
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId)
  if (error) throw new Error(`deletePost: ${error.message}`)
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("forum_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId)
  if (error) throw new Error(`deleteComment: ${error.message}`)
}

// ─── Upvotes ──────────────────────────────────────────────────────────────────

export async function togglePostUpvote(
  userId: string,
  postId: string
): Promise<"added" | "removed"> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("forum_post_upvotes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle()

  if (existing) {
    await supabase.from("forum_post_upvotes")
      .delete().eq("user_id", userId).eq("post_id", postId)
    return "removed"
  }

  await supabase.from("forum_post_upvotes").insert({ user_id: userId, post_id: postId })
  return "added"
}

export async function toggleCommentUpvote(
  userId: string,
  commentId: string
): Promise<"added" | "removed"> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("forum_comment_upvotes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("comment_id", commentId)
    .maybeSingle()

  if (existing) {
    await supabase.from("forum_comment_upvotes")
      .delete().eq("user_id", userId).eq("comment_id", commentId)
    return "removed"
  }

  await supabase.from("forum_comment_upvotes").insert({ user_id: userId, comment_id: commentId })
  return "added"
}

// ─── Saved posts ──────────────────────────────────────────────────────────────

export async function toggleSavedPost(
  userId: string,
  postId: string
): Promise<"saved" | "unsaved"> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("forum_saved_posts")
    .select("user_id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle()

  if (existing) {
    await supabase.from("forum_saved_posts")
      .delete().eq("user_id", userId).eq("post_id", postId)
    return "unsaved"
  }

  await supabase.from("forum_saved_posts").insert({ user_id: userId, post_id: postId })
  return "saved"
}

// ─── Mark best answer ─────────────────────────────────────────────────────────

export async function markBestAnswer(
  commentId: string,
  postId:    string,
  userId:    string   // must be post author
): Promise<void> {
  const supabase = await createClient()

  // Verify caller is the post author
  const { data: post } = await supabase
    .from("forum_posts")
    .select("user_id")
    .eq("id", postId)
    .single()

  if (post?.user_id !== userId) throw new Error("Only the post author can mark a best answer")

  // Un-accept previous best answer on this post
  await supabase
    .from("forum_comments")
    .update({ is_accepted: false })
    .eq("post_id", postId)
    .eq("is_accepted", true)

  // Accept new one
  const { error } = await supabase
    .from("forum_comments")
    .update({ is_accepted: true })
    .eq("id", commentId)

  if (error) throw new Error(`markBestAnswer: ${error.message}`)

  // Award best_answers reputation point to comment author
  const { data: comment } = await supabase
    .from("forum_comments")
    .select("user_id")
    .eq("id", commentId)
    .single()

  if (comment?.user_id) {
    await supabase
      .from("forum_reputation")
      .upsert(
        { user_id: comment.user_id, best_answers: 1, points: 10 },
        { onConflict: "user_id" }
      )
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 25): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("forum_reputation")
    .select("user_id, points, posts_count, comments_count, upvotes_received, best_answers, profiles!user_id(full_name, avatar_url, target_exam)")
    .order("points", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getLeaderboard: ${error.message}`)

  return (data as ReputationRow[]).map((r) => ({
    user_id:          r.user_id,
    points:           r.points,
    posts_count:      r.posts_count,
    comments_count:   r.comments_count,
    upvotes_received: r.upvotes_received,
    best_answers:     r.best_answers,
    full_name:        r.profiles?.full_name  ?? null,
    avatar_url:       r.profiles?.avatar_url ?? null,
    target_exam:      r.profiles?.target_exam ?? null,
  }))
}