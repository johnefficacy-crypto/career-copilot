import { adminCreateOrganization } from "@/actions/admin"

const ORG_TYPES = ["Banking", "UPSC", "SSC", "PSU", "Regulatory", "State PSC", "Judiciary", "Railways", "Defence", "Insurance", "Other"]

const inputCls  = "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
const selectCls = inputCls

export default function NewOrganizationPage() {
  return (
    <div className="p-8 max-w-md">
      <a href="/admin/organizations" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
        ← Organizations
      </a>
      <h1 className="text-white text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Add organization
      </h1>
      <p className="text-white/40 text-sm mb-8">Register a recruiting body like SEBI, IBPS, SSC, etc.</p>

      <form action={adminCreateOrganization} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-xs uppercase tracking-widest">Full name</label>
          <input name="name" type="text" required placeholder="Securities and Exchange Board of India" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-xs uppercase tracking-widest">Type</label>
          <select name="type" required className={selectCls}>
            <option value="" disabled>Select type</option>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-xs uppercase tracking-widest">State (if state-level body)</label>
          <input name="state" type="text" placeholder="Maharashtra (optional)" className={inputCls} />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
        >
          Save organization
        </button>
      </form>
    </div>
  )
}