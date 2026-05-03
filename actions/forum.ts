/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import {
  createPost,
  createComment,
  deletePost,
  deleteComment,
  togglePostUpvote,
  toggleCommentUpvote,
  toggleSavedPost,
  markBestAnswer,
} from "@/lib/db/forum"

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")
  return user
}

// ─── Create post ──────────────────────────────────────────────────────────────

export async function createPostAction(formData: FormData) {
  const user = await requireUser()

  const categoryId = formData.get("category_id") as string
  const title      = (formData.get("title") as string).trim()
  const body       = (formData.get("body") as string).trim()
  const examTagsRaw = formData.get("exam_tags") as string

  if (!categoryId || !title || !body) {
    redirect("/forum/new?error=Please+fill+in+all+required+fields")
  }
  if (title.length < 10) {
    redirect("/forum/new?error=Title+must+be+at+least+10+characters")
  }
  if (body.length < 20) {
    redirect("/forum/new?error=Post+body+must+be+at+least+20+characters")
  }

  const examTags = examTagsRaw
    ? examTagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : []

  let postId: string
  try {
    postId = await createPost(user.id, { category_id: categoryId, title, body, exam_tags: examTags })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create post"
    redirect(`/forum/new?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath("/forum")
  redirect(`/forum/post/${postId}`)
}

// ─── Delete post ──────────────────────────────────────────────────────────────

export async function deletePostAction(formData: FormData) {
  const user = await requireUser()

  const postId       = formData.get("post_id") as string
  const categorySlug = (formData.get("category_slug") as string) || ""

  try {
    await deletePost(postId, user.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete post"
    redirect(`/forum/post/${postId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath("/forum")
  redirect(categorySlug ? `/forum?category=${categorySlug}` : "/forum")
}

// ─── Create comment ───────────────────────────────────────────────────────────

export async function createCommentAction(formData: FormData) {
  const user = await requireUser()

  const postId   = formData.get("post_id")   as string
  const parentId = (formData.get("parent_id") as string) || null
  const body     = (formData.get("body") as string).trim()

  if (!body || body.length < 5) {
    redirect(`/forum/post/${postId}?error=Comment+must+be+at+least+5+characters`)
  }

  try {
    await createComment(user.id, { post_id: postId, parent_id: parentId, body })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add comment"
    redirect(`/forum/post/${postId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`/forum/post/${postId}`)
  redirect(`/forum/post/${postId}#comments`)
}

// ─── Delete comment ───────────────────────────────────────────────────────────

export async function deleteCommentAction(formData: FormData) {
  const user      = await requireUser()
  const commentId = formData.get("comment_id") as string
  const postId    = formData.get("post_id")    as string

  try {
    await deleteComment(commentId, user.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete comment"
    redirect(`/forum/post/${postId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`/forum/post/${postId}`)
  redirect(`/forum/post/${postId}#comments`)
}

// ─── Upvote post ──────────────────────────────────────────────────────────────

export async function upvotePostAction(formData: FormData) {
  const user   = await requireUser()
  const postId = formData.get("post_id") as string

  await togglePostUpvote(user.id, postId)
  revalidatePath(`/forum/post/${postId}`)
  revalidatePath("/forum")
}

// ─── Upvote comment ───────────────────────────────────────────────────────────

export async function upvoteCommentAction(formData: FormData) {
  const user      = await requireUser()
  const commentId = formData.get("comment_id") as string
  const postId    = formData.get("post_id")    as string

  await toggleCommentUpvote(user.id, commentId)
  revalidatePath(`/forum/post/${postId}`)
}

// ─── Save / unsave post ───────────────────────────────────────────────────────

export async function savePostAction(formData: FormData) {
  const user   = await requireUser()
  const postId = formData.get("post_id") as string
  const postSlug = formData.get("post_id") as string // reuse as redirect target

  await toggleSavedPost(user.id, postId)
  revalidatePath(`/forum/post/${postSlug}`)
}

// ─── Mark best answer ─────────────────────────────────────────────────────────

export async function markBestAnswerAction(formData: FormData) {
  const user      = await requireUser()
  const commentId = formData.get("comment_id") as string
  const postId    = formData.get("post_id")    as string

  try {
    await markBestAnswer(commentId, postId, user.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to mark best answer"
    redirect(`/forum/post/${postId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`/forum/post/${postId}`)
  redirect(`/forum/post/${postId}#comments`)
}

export async function reportForumContentAction(formData: FormData) {
  const user = await requireUser()
  const supabase = await createClient() as unknown as { from: (table: string) => any }

  const postId = (formData.get("post_id") as string) || null
  const commentId = (formData.get("comment_id") as string) || null
  const postPageId = (formData.get("post_page_id") as string) || postId || ""
  const reason = String(formData.get("reason") ?? "").trim()
  const details = String(formData.get("details") ?? "").trim() || null

  if (!reason || (!postId && !commentId)) {
    redirect(`/forum/post/${postPageId}?error=${encodeURIComponent("Invalid report payload")}`)
  }

  const lc = reason.toLowerCase()
  const severity = lc.includes("scam") || lc.includes("abuse") || lc.includes("hate") || lc.includes("threat")
    ? "p0_harmful"
    : (lc.includes("mislead") || lc.includes("wrong") || lc.includes("fake") ? "p1_misleading" : "p2_spam_noise")

  const payload: Record<string, unknown> = {
    reporter_user_id: user.id,
    reason,
    details,
    severity,
    target_type: commentId ? "comment" : "post",
    post_id: postId,
    comment_id: commentId,
  }

  const { error } = await supabase.from("forum_reports").insert(payload)
  if (error) {
    redirect(`/forum/post/${postPageId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/forum/post/${postPageId}`)
  redirect(`/forum/post/${postPageId}?reported=1#comments`)
}
