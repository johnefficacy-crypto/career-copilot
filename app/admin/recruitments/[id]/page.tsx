/**
 * app/admin/recruitments/[id]/page.tsx
 *
 * FIX: Delete post button used to have onClick in a Server Component.
 * Replaced with DeleteConfirmButton client component.
 * Also wrapped data fetching in try/catch to prevent 500 on timeout.
 */

import { notFound } from "next/navigation"
import { getRecruitmentById, getAllOrganizations } from "@/lib/db/admin"
import { adminUpdateRecruitment, adminSavePost, adminDeletePost, adminSubmitForReview, adminPublishRecruitment, adminWithdrawRecruitment } from "@/actions/admin"
import { RecruitmentForm } from "@/components/admin/RecruitmentForm"
import { PostForm } from "@/components/admin/PostForm"
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton"
import Link from "next/link"

const PUBLISH_STYLES: Record<string, { badge: string; label: string }> = {
  draft:        { badge: "bg-white/5 text-white/30 border-white/10",               label: "Draft" },
  needs_review: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",     label: "Needs Review" },
  verified:     { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",        label: "Verified" },
  published:    { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Published" },
  archived:     { badge: "bg-white/5 text-white/20 border-white/10",               label: "Archived" },
  withdrawn:    { badge: "bg-red-500/10 text-red-400 border-red-500/20",           label: "Withdrawn" },
}

export default async function RecruitmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; post?: string }>
}) {
  const { id } = await params
  const { error: pageError, post: postParam } = await searchParams

  let rec: Awaited<ReturnType<typeof getRecruitmentById>> = null
  let organizations: Awaited<ReturnType<typeof getAllOrganizations>> = []
  let fetchError: string | null = null

  try {
    ;[rec, organizations] = await Promise.all([
      getRecruitmentById(id),
      getAllOrganizations(),
    ])
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load data"
  }

  if (!rec && !fetchError) notFound()

  const posts = rec?.posts ?? []
  const editingPostId = postParam ?? null
  const editingPost = editingPostId ? posts.find((p) => p.id === editingPostId) : undefined

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/recruitments" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          Back
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/60 text-sm truncate">{rec?.name ?? id}</span>
      </div>

      {(pageError || fetchError) && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {pageError ? decodeURIComponent(pageError) : fetchError}
        </div>
      )}

      {rec && (
        <>
        {/* Publish workflow panel */}
        {(() => {
          const ps = (rec as { publish_status?: string }).publish_status ?? "draft"
          const style = PUBLISH_STYLES[ps] ?? PUBLISH_STYLES.draft
          return (
            <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <div className="flex-1">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Publish status</p>
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full border ${style.badge}`}>
                  {style.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(ps === "draft" || ps === "withdrawn") && (
                  <form action={adminSubmitForReview}>
                    <input type="hidden" name="id" value={rec.id} />
                    <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
                      Submit for review
                    </button>
                  </form>
                )}
                {(ps === "needs_review" || ps === "verified") && (
                  <form action={adminPublishRecruitment}>
                    <input type="hidden" name="id" value={rec.id} />
                    <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                      Publish
                    </button>
                  </form>
                )}
                {ps === "published" && (
                  <form action={adminWithdrawRecruitment}>
                    <input type="hidden" name="id" value={rec.id} />
                    <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      Withdraw
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Edit recruitment */}
          <div>
            <h2 className="text-white text-lg font-medium mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Recruitment details
            </h2>
            <RecruitmentForm
              organizations={organizations}
              action={adminUpdateRecruitment}
              defaultValues={rec}
              isEdit
            />
          </div>

          {/* Right: Posts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Posts & criteria
              </h2>
              <span className="text-white/30 text-xs">{posts.length} post{posts.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Existing posts */}
            {posts.length > 0 && (
              <div className="flex flex-col gap-2 mb-6">
                {posts.map((post) => (
                  <div key={post.id}
                    className={`border rounded-xl px-4 py-3 transition-colors ${
                      editingPostId === post.id
                        ? "border-[#e8d5a3]/30 bg-[#e8d5a3]/[0.04]"
                        : "border-white/[0.07] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{post.post_name}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/35">
                          {post.group_type && <span>{post.group_type}</span>}
                          {post.pay_level && <span>{post.pay_level}</span>}
                          {post.job_type && <span>{post.job_type}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`/admin/recruitments/${rec.id}?post=${post.id}`}
                          className="text-white/40 text-xs hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/[0.05]">
                          Edit
                        </a>
                        {/* FIX: onClick removed from Server Component — using client component */}
                        <DeleteConfirmButton
                          action={adminDeletePost}
                          message={`Delete post "${post.post_name}"? All criteria will be lost.`}
                          fields={{ post_id: post.id, recruitment_id: rec.id }}
                          label="✕"
                        />
                      </div>
                    </div>

                    {/* Criteria chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.age_criteria?.[0] && (
                        <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">
                          Age {post.age_criteria[0].min_age}–{post.age_criteria[0].max_age}
                        </span>
                      )}
                      {post.education_criteria?.[0] && (
                        <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">
                          {post.education_criteria[0].min_qualification_level ?? "Any edu"}
                          {post.education_criteria[0].min_percentage ? ` · ${post.education_criteria[0].min_percentage}%` : ""}
                        </span>
                      )}
                      {post.attempt_limits && post.attempt_limits.length > 0 && (
                        <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">
                          {post.attempt_limits.length} attempt limit{post.attempt_limits.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {post.vacancies && post.vacancies.length > 0 && (
                        <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">
                          {post.vacancies.reduce((s: number, v) => s + (v.vacancy_count ?? 0), 0)} vacancies
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / edit post form */}
            <div className="border border-white/[0.07] rounded-xl p-5 bg-white/[0.01]">
              <h3 className="text-white/70 text-sm font-medium mb-4">
                {editingPost ? `Editing: ${editingPost.post_name}` : "Add new post"}
              </h3>
              <PostForm
                recruitmentId={rec.id}
                action={adminSavePost}
                defaultValues={editingPost}
              />
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  )
}