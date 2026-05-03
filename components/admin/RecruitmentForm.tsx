"use client"

import { useRef } from "react"

// type RecruitmentStatus = "upcoming" | "open" | "closed" | "draft"
type RecruitmentStatus = (typeof STATUSES)[number]

const ORG_TYPES = ["Banking", "UPSC", "SSC", "PSU", "Regulatory", "State PSC", "Judiciary", "Railways", "Defence", "Other"] as const
const STATUSES  = ["upcoming", "open", "closed", "draft"] as const

type RecruitmentFormValues = {
  id?: string
  organization_id?: string | null
  name?: string | null
  year?: number | null
  status?: string | null
  notification_date?: string | null
  apply_start_date?: string | null
  apply_end_date?: string | null
}

interface Props {
  organizations: Array<{ id: string; name: string; type: string }>
  action: (formData: FormData) => Promise<void>
  defaultValues?: RecruitmentFormValues
  isEdit?: boolean
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/50 text-xs uppercase tracking-widest">{label}</label>
      {children}
      {hint && <p className="text-white/25 text-xs">{hint}</p>}
    </div>
  )
}

const inputCls = "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
const selectCls = inputCls + " cursor-pointer"

export function RecruitmentForm({ organizations, action, defaultValues, isEdit }: Props) {
  const dv = defaultValues ?? {}

  return (
    <form action={action} className="flex flex-col gap-5">
      {isEdit && <input type="hidden" name="id" value={dv.id} />}

      <Field label="Organization">
        <select name="organization_id" required defaultValue={dv.organization_id ?? ""} className={selectCls}>
          <option value="" disabled>Select organization</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
          ))}
        </select>
      </Field>

      <Field label="Recruitment name" hint="e.g. SEBI Grade A Officer 2025">
        <input
          name="name"
          type="text"
          required
          defaultValue={dv.name ?? ""}
          placeholder="SEBI Grade A Officer"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Year">
          <input
            name="year"
            type="number"
            required
            defaultValue={dv.year ?? new Date().getFullYear()}
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={dv.status ?? "upcoming"} className={selectCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Notification date">
          <input
            name="notification_date"
            type="date"
            defaultValue={dv.notification_date ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Apply start">
          <input
            name="apply_start_date"
            type="date"
            defaultValue={dv.apply_start_date ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Apply end (deadline)">
          <input
            name="apply_end_date"
            type="date"
            defaultValue={dv.apply_end_date ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="w-full py-2.5 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
      >
        {isEdit ? "Save changes" : "Create recruitment"}
      </button>
    </form>
  )
}