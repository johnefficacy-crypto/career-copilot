import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getForumCategories, listForumPosts } from "@/lib/db/forum"
import { PostCard } from "@/components/forum/PostCard"
import { CategorySidebar } from "@/components/forum/CategorySidebar"
import type { PostSortOrder } from "@/types/forum"

export const metadata = { title: "Community Forum — Career Copilot" }

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string
    tag?: string
    q?: string
    sort?: string
    page?: string
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const sort   = (params.sort ?? "latest") as PostSortOrder
  const page   = Number(params.page ?? 1)

  const [categories, { posts, total }] = await Promise.all([
    getForumCategories(),
    listForumPosts(
      {
        category_slug: params.category,
        exam_tag:      params.tag,
        query:         params.q,
        sort,
        page,
      },
      user?.id
    ),
  ])

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeCategory = categories.find((c) => c.slug === params.category)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <nav
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{ borderColor: "var(--border)", background: "rgba(15,15,15,0.90)", height: "56px" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="cc-logo">Career Copilot</Link>
            <span style={{ color: "var(--border-md)" }}>/</span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.60)" }}>Forum</span>
          </div>
          {user && (
            <Link
              href="/forum/new"
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "var(--gold)", color: "#0c0c0c" }}
            >
              + New post
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-7">

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <CategorySidebar
            categories={categories}
            activeSlug={params.category}
            activeTag={params.tag}
          />

          {/* ── Main content ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h1
                  className="text-xl font-medium text-white"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {activeCategory?.name ?? (params.q ? `Search: "${params.q}"` : "All discussions")}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {total.toLocaleString()} post{total !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Sort tabs */}
              <div
                className="flex items-center rounded-xl p-1"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
              >
                {(["latest", "top", "unanswered"] as const).map((s) => (
                  <Link
                    key={s}
                    href={buildUrl(params, { sort: s, page: undefined })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                    style={
                      sort === s
                        ? { background: "var(--gold-faint)", color: "var(--gold)", border: "1px solid var(--gold-border)" }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>

            {/* Search bar */}
            <form method="GET" className="mb-6">
              {params.category && <input type="hidden" name="category" value={params.category} />}
              {params.tag      && <input type="hidden" name="tag"      value={params.tag}      />}
              {params.sort     && <input type="hidden" name="sort"     value={params.sort}     />}
              <div className="relative">
                <span
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: "var(--text-ghost)" }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search discussions…"
                  className="cc-input pl-9"
                />
              </div>
            </form>

            {/* Post list */}
            {posts.length === 0 ? (
              <div
                className="rounded-2xl p-12 text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
              >
                <p className="text-2xl mb-3 opacity-30">📭</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {params.q
                    ? `No results for "${params.q}"`
                    : "No posts yet in this category. Be the first!"}
                </p>
                {user && (
                  <Link
                    href="/forum/new"
                    className="inline-block mt-4 px-5 py-2 rounded-xl text-sm transition-colors"
                    style={{ background: "var(--gold)", color: "#0c0c0c" }}
                  >
                    Start the conversation →
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    viewerId={user?.id ?? null}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {page > 1 && (
                  <Link
                    href={buildUrl(params, { page: page - 1 })}
                    className="px-4 py-2 rounded-xl text-sm transition-colors"
                    style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-sm px-3" style={{ color: "var(--text-dim)" }}>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildUrl(params, { page: page + 1 })}
                    className="px-4 py-2 rounded-xl text-sm transition-colors"
                    style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

// ─── URL builder helper ───────────────────────────────────────────────────────

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams()
  const merged = { ...current, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") params.set(k, String(v))
  }
  return `/forum?${params.toString()}`
}