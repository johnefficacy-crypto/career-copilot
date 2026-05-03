import { createClient } from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"
import { adminResolveRecruitmentFeedback } from "@/actions/admin-feedback"

export const dynamic = "force-dynamic"

export default async function RecruitmentFeedbackPage() {
  await requireAdminRole("audit")
  const supabase = await createClient()

  type FeedbackRow = { id: string; user_id: string; recruitment_id: string; feedback_type: string; message: string | null; status: string; created_at: string; resolved_at: string | null }

  const db = supabase as unknown as {
    from: (table: string) => {
      select: (q: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: FeedbackRow[] | null }> } }
    }
  }

  const { data: rows } = await db
    .from("user_recruitment_feedback")
    .select("id, user_id, recruitment_id, feedback_type, message, status, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200)

  const feedback = rows ?? []

  return (
    <div className="p-8 space-y-5">
      <div>
        <h1 className="text-2xl text-white font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Recruitment feedback</h1>
        <p className="text-white/40 text-sm">User-reported wrong match, deadline, and official link issues.</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/50">
            <tr>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Recruitment</th>
              <th className="text-left px-3 py-2">Message</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((r: FeedbackRow) => (
              <tr key={r.id} className="border-t border-white/[0.06]">
                <td className="px-3 py-2 text-white/70">{r.feedback_type}</td>
                <td className="px-3 py-2 text-white/50 font-mono text-xs">{r.recruitment_id}</td>
                <td className="px-3 py-2 text-white/60 max-w-[340px] truncate">{r.message || "—"}</td>
                <td className="px-3 py-2 text-white/70">{r.status}</td>
                <td className="px-3 py-2 text-white/40 text-xs">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2">
                  {r.status === "open" || r.status === "reviewing" ? (
                    <form action={adminResolveRecruitmentFeedback} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <button name="resolution" value="resolved" className="text-xs px-2 py-1 rounded border border-emerald-400/30 text-emerald-300">Resolve</button>
                      <button name="resolution" value="rejected" className="text-xs px-2 py-1 rounded border border-red-400/30 text-red-300">Reject</button>
                    </form>
                  ) : <span className="text-white/30 text-xs">Done</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
