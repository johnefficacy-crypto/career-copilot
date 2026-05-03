"use client"

import { useState } from "react"

const EDU_LEVELS   = ["10th", "12th", "diploma", "graduate", "postgraduate", "phd"] as const
const GROUP_TYPES  = ["Group A", "Group B", "Group C", "Group D"] as const
const JOB_TYPES    = ["permanent", "contractual", "deputation"] as const
const CATEGORIES   = ["general", "obc", "sc", "st", "ews", "pwd", "ex-serviceman"] as const

interface AttemptLimit { category: string | null; max_attempts: number | null }
interface Vacancy      { category: string | null; vacancy_count: number | null ; state: string | null }

type AgeCriteria = {
  min_age?: number | null
  max_age?: number | null
  cutoff_date?: string | null
}

type EducationCriteria = {
  min_qualification_level?: string | null
  min_percentage?: number | null
  allowed_disciplines?: unknown
}

type SalaryDetails = {
  pay_level?: string | null
  in_hand_estimate?: string | null
  basic_pay_min?: number | null
  basic_pay_max?: number | null
  allowances?: string | null
}

type PostFormValues = {
  id?: string
  post_name?: string | null
  group_type?: string | null
  pay_level?: string | null
  job_type?: string | null
  age_criteria?: {
    min_age?: number | null
    max_age?: number | null
    cutoff_date?: string | null
  }[]
  education_criteria?: {
    min_qualification_level?: string | null
    min_percentage?: number | null
    allowed_disciplines?: unknown
  }[]
  salary_details?: {
    pay_level?: string | null
    in_hand_estimate?: string | null
    basic_pay_min?: number | null
    basic_pay_max?: number | null
    allowances?: string | null
  }[]
  // attempt_limits?: {
  //   category: string | null
  //   max_attempts: number
  // }[]
  // vacancies?: {
  //   category: string | null
  //   vacancy_count: number
  //   state: string | null
  // }[]
    attempt_limits?: AttemptLimit[]
    vacancies?: Vacancy[]
}

interface Props {
  recruitmentId: string
  action: (formData: FormData) => Promise<void>
  defaultValues?: PostFormValues
}

const inputCls  = "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
const selectCls = inputCls + " cursor-pointer"
const labelCls  = "text-white/50 text-xs uppercase tracking-widest"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-t border-white/[0.06] pt-4 mt-4">
      <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-3">{title}</p>
    </div>
  )
}

export function PostForm({ recruitmentId, action, defaultValues }: Props) {
  const dv : PostFormValues =  defaultValues ?? {}
  const ageCrit  = dv.age_criteria?.[0] ?? {}
  const eduCrit  = dv.education_criteria?.[0] ?? {}
  const salary   = dv.salary_details?.[0] ?? {}

  // const [attemptLimits, setAttemptLimits] = useState<AttemptLimit[]>(
  //   dv.attempt_limits ?? [{ category: null, max_attempts: 6 }]
  // )
  // const [vacancies, setVacancies] = useState<Vacancy[]>(
  //   dv.vacancies ?? [{ category: "general", vacancy_count: 0, state: null }]
  // )
  const [attemptLimits, setAttemptLimits] = useState<AttemptLimit[]>(
  dv.attempt_limits?.map((al) => ({
    category: al.category ?? null,
    max_attempts: al.max_attempts ?? 6,
  })) ?? [{ category: null, max_attempts: 6 }]
)

const [vacancies, setVacancies] = useState<Vacancy[]>(
  dv.vacancies?.map((v) => ({
    category: v.category ?? "general",
    vacancy_count: v.vacancy_count ?? 0,
    state: v.state ?? null,
  })) ?? [{ category: "general", vacancy_count: 0, state: null }]
)
  function addAttemptLimit() {
    setAttemptLimits([...attemptLimits, { category: "obc", max_attempts: 6 }])
  }
  function removeAttemptLimit(i: number) {
    setAttemptLimits(attemptLimits.filter((_, idx) => idx !== i))
  }
  // function updateAttemptLimit(i: number, key: keyof AttemptLimit, value: string | number | null) {
  //   const updated = [...attemptLimits]
  //   updated[i] = { ...updated[i], [key]: key === "max_attempts" ? Number(value) : (value === "null" ? null : value) }
  //   setAttemptLimits(updated)
  // }
  // function updateVacancy(i: number, key: keyof Vacancy, value:  string | number | null) {
  //   const updated = [...vacancies]
  //   updated[i] = { ...updated[i], [key]: key === "vacancy_count" ? Number(value) : (value === "" ? null : value) }
  //   setVacancies(updated)
  // }

  function updateAttemptLimit(
  i: number,
  key: keyof AttemptLimit,
  value: string | number | null
) {
  const updated = [...attemptLimits]
  updated[i] = {
    ...updated[i],
    [key]:
      key === "max_attempts"
        ? value === "" || value === null
          ? null
          : Number(value)
        : value === "null"
          ? null
          : value,
  }
  setAttemptLimits(updated)
}

function updateVacancy(
  i: number,
  key: keyof Vacancy,
  value: string | number | null
) {
  const updated = [...vacancies]
  updated[i] = {
    ...updated[i],
    [key]:
      key === "vacancy_count"
        ? value === "" || value === null
          ? null
          : Number(value)
        : value === ""
          ? null
          : value,
  }
  setVacancies(updated)
}

  function addVacancy() {
    setVacancies([...vacancies, { category: "obc", vacancy_count: 0, state: null }])
  }
  function removeVacancy(i: number) {
    setVacancies(vacancies.filter((_, idx) => idx !== i))
  }
  
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="recruitment_id" value={recruitmentId} />
      {dv.id && <input type="hidden" name="post_id" value={dv.id} />}

      {/* Hidden JSON fields for arrays */}
      <input type="hidden" name="attempt_limits_json" value={JSON.stringify(attemptLimits)} />
      <input type="hidden" name="vacancies_json" value={JSON.stringify(vacancies)} />

      {/* ── Post basics ─────────────────────────────────────────── */}
      <Field label="Post name">
        <input name="post_name" type="text" required defaultValue={dv.post_name ?? ""} placeholder="Grade A Officer" className={inputCls} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Group type">
          <select name="group_type" defaultValue={dv.group_type ?? ""} className={selectCls}>
            <option value="">—</option>
            {GROUP_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Pay level">
          <input name="pay_level" type="text" defaultValue={dv.pay_level ?? ""} placeholder="Level 14" className={inputCls} />
        </Field>
        <Field label="Job type">
          <select name="job_type" defaultValue={dv.job_type ?? ""} className={selectCls}>
            <option value="">—</option>
            {JOB_TYPES.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </Field>
      </div>

      {/* ── Age criteria ─────────────────────────────────────────── */}
      <SectionHeader title="Age criteria" />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Min age">
          <input name="min_age" type="number" defaultValue={ageCrit.min_age ?? ""} placeholder="18" className={inputCls} />
        </Field>
        <Field label="Max age">
          <input name="max_age" type="number" defaultValue={ageCrit.max_age ?? ""} placeholder="30" className={inputCls} />
        </Field>
        <Field label="Cutoff date">
          <input name="cutoff_date" type="date" defaultValue={ageCrit.cutoff_date ?? ""} className={inputCls} />
        </Field>
      </div>
      <p className="text-white/25 text-xs -mt-2">
        Age relaxation (OBC +3, SC/ST +5, PwBD +10) is applied automatically by the engine.
      </p>

      {/* ── Education criteria ───────────────────────────────────── */}
      <SectionHeader title="Education criteria" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min qualification">
          <select name="min_qualification_level" defaultValue={eduCrit.min_qualification_level ?? ""} className={selectCls}>
            <option value="">Any</option>
            {EDU_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Min percentage / CGPA × 10">
          <input name="min_percentage" type="number" step="0.1" defaultValue={eduCrit.min_percentage ?? ""} placeholder="60" className={inputCls} />
        </Field>
      </div>
      <Field label="Allowed disciplines (JSON)">
        <textarea
          name="allowed_disciplines_json"
          defaultValue={eduCrit.allowed_disciplines ? JSON.stringify(eduCrit.allowed_disciplines) : ""}
          placeholder='{"streams": ["commerce", "economics", "finance", "law"]}'
          rows={2}
          className={inputCls + " resize-none font-mono text-xs"}
        />
      </Field>

      {/* ── Attempt limits ───────────────────────────────────────── */}
      <SectionHeader title="Attempt limits" />
      <div className="flex flex-col gap-2">
        {attemptLimits.map((al, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={al.category ?? "null"}
              onChange={(e) => updateAttemptLimit(i, "category", e.target.value)}
              className={selectCls + " flex-1"}
            >
              <option value="null">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <input
              type="number"
              value={al.max_attempts ?? ""}
              onChange={(e) => updateAttemptLimit(i, "max_attempts", e.target.value)}
              className={inputCls + " w-20"}
              placeholder="6"
            />
            <span className="text-white/30 text-xs shrink-0">attempts</span>
            <button
              type="button"
              onClick={() => removeAttemptLimit(i)}
              className="text-red-400/40 hover:text-red-400 text-sm px-1"
            >✕</button>
          </div>
        ))}
        <button type="button" onClick={addAttemptLimit} className="text-[#e8d5a3]/50 text-xs hover:text-[#e8d5a3] text-left transition-colors">
          + Add attempt limit
        </button>
      </div>

      {/* ── Vacancies ────────────────────────────────────────────── */}
      <SectionHeader title="Vacancies" />
      <div className="flex flex-col gap-2">
        {vacancies.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={v.category ?? "null"}
              onChange={(e) => updateVacancy(i, "category", e.target.value === "null" ? null : e.target.value)}
              className={selectCls + " flex-1"}
            >
              <option value="null">Unreserved</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <input
              type="number"
              value={v.vacancy_count ?? ""}
              onChange={(e) => updateVacancy(i, "vacancy_count", e.target.value)}
              placeholder="0"
              className={inputCls + " w-20"}
            />
            <input
              type="text"
              value={v.state ?? ""}
              onChange={(e) => updateVacancy(i, "state", e.target.value)}
              placeholder="State (optional)"
              className={inputCls + " flex-1"}
            />
            <button type="button" onClick={() => removeVacancy(i)} className="text-red-400/40 hover:text-red-400 text-sm px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addVacancy} className="text-[#e8d5a3]/50 text-xs hover:text-[#e8d5a3] text-left transition-colors">
          + Add vacancy row
        </button>
      </div>

      {/* ── Salary details ───────────────────────────────────────── */}
      <SectionHeader title="Salary details" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay level">
          <input name="salary_pay_level" type="text" defaultValue={salary.pay_level ?? ""} placeholder="Level 14 (₹1,44,200)" className={inputCls} />
        </Field>
        <Field label="In-hand estimate">
          <input name="in_hand_estimate" type="text" defaultValue={salary.in_hand_estimate ?? ""} placeholder="₹1,80,000/mo approx" className={inputCls} />
        </Field>
        <Field label="Basic pay min">
          <input name="basic_pay_min" type="number" defaultValue={salary.basic_pay_min ?? ""} placeholder="144200" className={inputCls} />
        </Field>
        <Field label="Basic pay max">
          <input name="basic_pay_max" type="number" defaultValue={salary.basic_pay_max ?? ""} placeholder="218200" className={inputCls} />
        </Field>
      </div>
      <Field label="Allowances">
        <input name="allowances" type="text" defaultValue={salary.allowances ?? ""} placeholder="HRA, DA, TA, Medical" className={inputCls} />
      </Field>

      <button
        type="submit"
        className="w-full py-2.5 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors mt-2"
      >
        {dv.id ? "Save post" : "Add post"}
      </button>
    </form>
  )
}