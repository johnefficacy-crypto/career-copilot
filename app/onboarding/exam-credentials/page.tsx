import { saveExamCredential } from "./save"

export default function ExamCredentialsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl text-white font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Exam credentials</h1>
      <p className="text-white/45 text-sm">Add credentials like GATE / NET / SET / CTET / TET for recruitment-gating checks.</p>

      <form action={saveExamCredential} className="space-y-3 rounded-xl border border-white/[0.1] bg-white/[0.02] p-4">
        <label className="block text-xs text-white/60">Exam
          <select name="exam_key" className="mt-1 w-full bg-white/[0.04] border border-white/[0.1] rounded px-3 py-2 text-white text-sm" defaultValue="gate">
            <option value="gate">GATE</option>
            <option value="net">NET</option>
            <option value="set">SET</option>
            <option value="ctet">CTET</option>
            <option value="tet">TET</option>
          </select>
        </label>
        <label className="block text-xs text-white/60">Score
          <input name="score" type="number" step="0.01" className="mt-1 w-full bg-white/[0.04] border border-white/[0.1] rounded px-3 py-2 text-white text-sm" />
        </label>
        <label className="block text-xs text-white/60">Percentile
          <input name="percentile" type="number" step="0.01" className="mt-1 w-full bg-white/[0.04] border border-white/[0.1] rounded px-3 py-2 text-white text-sm" />
        </label>
        <label className="block text-xs text-white/60">Exam year
          <input name="exam_year" type="number" className="mt-1 w-full bg-white/[0.04] border border-white/[0.1] rounded px-3 py-2 text-white text-sm" />
        </label>
        <button className="px-3 py-2 rounded bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium">Save credential</button>
      </form>
    </div>
  )
}
