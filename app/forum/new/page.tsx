import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getForumCategories } from "@/lib/db/forum"
import { createPostAction } from "@/actions/forum"

export const metadata = { title: "New discussion — Career Copilot" }

const EXAM_TAG_OPTIONS = [
  "UPSC", "SSC CGL", "SSC CHSL", "IBPS PO", "IBPS Clerk",
  "SBI PO", "SBI Clerk", "RBI Grade B", "RBI Assistant",
  "SEBI Grade A", "NABARD", "IRDAI", "Railways NTPC",
  "Railways Group D", "CDS", "NDA", "State PSC",
]

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?redirect=/forum/new")

  const params     = await searchParams
  const categories = await getForumCategories()
  const preselect  = params.category ?? ""

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <nav
        className="border-b h-14 flex items-center px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <a href="/dashboard" className="cc-logo">Career Copilot</a>
        <a href="/forum" className="ml-auto text-sm" style={{ color: "var(--text-muted)" }}>
          ← Forum
        </a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1
          className="text-2xl font-medium text-white mb-2"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Start a discussion
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Help a fellow aspirant. Ask a question. Share a tip. Keep it specific and searchable.
        </p>

        {params?.error && (
          <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
        )}

        <form action={createPostAction} className="cc-step-form">

          {/* Category */}
          <div className="cc-field">
            <label className="cc-label">Category *</label>
            <select
              name="category_id"
              required
              defaultValue={preselect}
              className="cc-select"
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="cc-field">
            <label className="cc-label">Title *</label>
            <input
              type="text"
              name="title"
              required
              minLength={10}
              maxLength={200}
              placeholder="What's your question or topic? Be specific."
              className="cc-input"
            />
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Min 10 characters. Good titles get more answers.
            </p>
          </div>

          {/* Body */}
          <div className="cc-field">
            <label className="cc-label">Body *</label>
            <textarea
              name="body"
              required
              minLength={20}
              rows={8}
              placeholder={`Provide context, your attempts so far, what you've already tried...\n\nFor example:\n- Your educational background\n- Which exam cycle you're targeting\n- What specifically you're unsure about`}
              className="cc-input"
              style={{ resize: "vertical", minHeight: "160px", lineHeight: "1.6" }}
            />
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Min 20 characters. Plain text — formatting will be preserved.
            </p>
          </div>

          {/* Exam tags */}
          <div className="cc-field">
            <label className="cc-label">Exam tags (optional)</label>
            <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
              Tag the exams this post is about — helps others find it.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAM_TAG_OPTIONS.map((tag) => (
                <label key={tag} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="exam_tag_check"
                    value={tag}
                    className="sr-only peer"
                  />
                  <span
                    className="inline-block px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {tag}
                  </span>
                </label>
              ))}
            </div>
            {/* Hidden field collects checked tags as comma-separated */}
            <input type="hidden" name="exam_tags" id="exam_tags_hidden" value="" />
          </div>

          <div className="cc-form-nav">
            <a href="/forum" className="cc-btn-link">Cancel</a>
            <button type="submit" className="cc-btn-primary" style={{ width: "auto" }}>
              Post discussion →
            </button>
          </div>
        </form>
      </div>

      {/* Client-side: collect checkbox values into hidden input */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var form = document.querySelector('form');
          if (!form) return;
          form.addEventListener('submit', function() {
            var checked = Array.from(document.querySelectorAll('input[name="exam_tag_check"]:checked'))
              .map(function(el) { return el.value; });
            document.getElementById('exam_tags_hidden').value = checked.join(',');
          });
          // Visual feedback for checkboxes
          document.querySelectorAll('input[name="exam_tag_check"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
              var span = cb.nextElementSibling;
              if (cb.checked) {
                span.style.background = 'var(--gold-faint)';
                span.style.borderColor = 'var(--gold-border)';
                span.style.color = 'var(--gold)';
              } else {
                span.style.background = '';
                span.style.borderColor = 'var(--border)';
                span.style.color = 'var(--text-muted)';
              }
            });
          });
        })();
      ` }} />
    </div>
  )
}