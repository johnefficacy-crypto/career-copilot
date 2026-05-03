import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { generatePlan } from "@/actions/study-planner"

const inputCls  = "w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/50 transition-colors"
const selectCls = inputCls + " cursor-pointer"

export default async function NewStudyPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exam?: string; recruitment_id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const params = await searchParams

  // Load user profile + their targets for smart defaults
  const [profileRes, targetsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("user_targets")
      .select(`
        id,
        recruitments ( id, name, year, apply_end_date, status, organizations(type) )
      `)
      .eq("user_id", user.id)
      .limit(10),
  ])

  const profile = profileRes.data
  const targets = (targetsRes.data ?? [])
    .map((t) => t.recruitments)
    .filter((r): r is NonNullable<typeof r> => r != null)

  const prefilledExam = params.exam ?? profile?.target_exam ?? ""
  const prefilledRecId = params.recruitment_id ?? ""

  const EXAM_TYPES = ["Banking", "UPSC", "SSC", "Regulatory", "PSU", "State PSC", "Judiciary", "Railways", "Defence", "Insurance"]
  const LEVELS     = ["beginner", "intermediate", "advanced"]

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/dashboard/study-plan" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
          ← Study plans
        </Link>

        <h1 className="text-white text-3xl font-medium mb-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Generate study plan
        </h1>
        <p className="text-white/40 text-sm mb-8">
          Our AI coach will build a week-by-week plan tailored to your exam, timeline, and daily hours.
          This takes about 20–30 seconds.
        </p>

        {params.error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {decodeURIComponent(params.error)}
          </div>
        )}

        <form action={generatePlan} className="flex flex-col gap-6">

          {/* ── Exam details ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Exam details</p>

            {targets.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Pick from your targets (optional)</label>
                <select
                  className={selectCls}
                  onChange={() => {}} /* handled below via name */
                  name="recruitment_id"
                  defaultValue={prefilledRecId}
                >
                  <option value="">— Select a target exam —</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.year} ({t.organizations?.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-white/40 text-xs">Exam name *</label>
              <input
                name="exam_name"
                required
                defaultValue={prefilledExam}
                placeholder="SEBI Grade A Officer"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Exam type</label>
                <select name="exam_type" className={selectCls} defaultValue="Banking">
                  {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Target / deadline date</label>
                <input name="target_date" type="date" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Your profile ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Your preparation</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/40 text-xs">Current preparation level</label>
              <div className="flex gap-2">
                {LEVELS.map((l) => (
                  <label key={l} className="flex-1 cursor-pointer">
                    <input type="radio" name="current_level" value={l} defaultChecked={l === "beginner"} className="sr-only peer" />
                    <div className="text-center py-2 rounded-xl border border-white/[0.08] text-white/40 text-sm peer-checked:border-[#e8d5a3]/40 peer-checked:bg-[#e8d5a3]/[0.06] peer-checked:text-[#e8d5a3] transition-colors capitalize">
                      {l}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Daily study hours</label>
                <select name="daily_hours" className={selectCls} defaultValue="2">
                  {[1, 1.5, 2, 3, 4, 5, 6, 8].map((h) => (
                    <option key={h} value={h}>{h}h / day</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Study days per week</label>
                <select name="weekly_days" className={selectCls} defaultValue="5">
                  {[3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/40 text-xs">Previous attempts at this exam</label>
              <select name="previous_attempts" className={selectCls} defaultValue="0">
                {[0, 1, 2, 3, "4+"].map((n) => (
                  <option key={n} value={n === "4+" ? "4" : n}>
                    {n === 0 ? "First attempt" : `${n} previous attempt${n !== 1 ? "s" : ""}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Subject preferences ──────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Subject preferences</p>
            <p className="text-white/30 text-xs -mt-1">These help the AI allocate more time where you need it most.</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/40 text-xs">Strong subjects (comma-separated)</label>
              <input
                name="strong_subjects"
                type="text"
                placeholder="Quantitative Aptitude, English"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-white/40 text-xs">Weak subjects (comma-separated)</label>
              <input
                name="weak_subjects"
                type="text"
                placeholder="Reasoning, General Awareness"
                className={inputCls}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
          >
            Generate my study plan →
          </button>

          <p className="text-white/25 text-xs text-center">
            Takes 20–30 seconds · Powered by Claude AI · Plan is saved automatically
          </p>
        </form>
      </div>
    </div>
  )
}