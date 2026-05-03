"use client"

import { useState } from "react"
import Link from "next/link"
import { EXAM_REGISTRY } from "@/lib/data/exam-registry"
import { getQuestionsForExam, type SkillQuestion } from "@/lib/data/skill-questions"

interface Props {
  eligibleExamIds: string[]       // from eligibility_results — may be empty
  targetExamId:    string | null
  isPaid:          boolean
  userFirstName:   string | null
}

type Phase = "selector" | "testing" | "results"

const FALLBACK_EXAM_ID = "ibps-po"

export function SkillTestWidget({
  eligibleExamIds = [],            // ← default to [] so .includes() never throws
  targetExamId,
  isPaid,
  userFirstName,
}: Props) {
  // Safe initial selection: targetExam → first eligible → fallback
  const safeIds     = Array.isArray(eligibleExamIds) ? eligibleExamIds : []
  const initialId   = targetExamId ?? safeIds[0] ?? FALLBACK_EXAM_ID

  const [phase,      setPhase]     = useState<Phase>("selector")
  const [selectedId, setSelectedId]= useState<string>(initialId)
  const [questions,  setQuestions] = useState<SkillQuestion[]>([])
  const [current,    setCurrent]   = useState(0)
  const [answers,    setAnswers]   = useState<(number | null)[]>([])
  const [selected,   setSelected]  = useState<number | null>(null)
  const [showExpl,   setShowExpl]  = useState(false)

  // Eligible exams first, then everything else
  const availableExams = [
    ...EXAM_REGISTRY.filter((e) => safeIds.includes(e.id)),
    ...EXAM_REGISTRY.filter((e) => !safeIds.includes(e.id)),
  ]

  function startTest() {
    const qs = getQuestionsForExam(selectedId, 5)
    setQuestions(qs)
    setAnswers([])
    setCurrent(0)
    setSelected(null)
    setShowExpl(false)
    setPhase("testing")
  }

  function handleAnswer(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    setShowExpl(true)
  }

  function handleNext() {
    const newAnswers = [...answers, selected]
    setAnswers(newAnswers)
    setSelected(null)
    setShowExpl(false)
    if (current + 1 >= questions.length) {
      setPhase("results")
    } else {
      setCurrent((c) => c + 1)
    }
  }

  function handleReset() {
    setPhase("selector")
    setSelected(null)
    setShowExpl(false)
  }

  const q     = questions[current]
  const score = answers.filter((a, i) => a === questions[i]?.correct).length
  const pct   = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
  const exam  = EXAM_REGISTRY.find((e) => e.id === selectedId)

  const subjectResults = questions.reduce<Record<string, { correct: number; total: number }>>(
    (acc, q, i) => {
      if (!acc[q.subject]) acc[q.subject] = { correct: 0, total: 0 }
      acc[q.subject].total++
      if (answers[i] === q.correct) acc[q.subject].correct++
      return acc
    },
    {}
  )

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {/* ── Selector ─────────────────────────────────────────────────── */}
      {phase === "selector" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Skill assessment · PYQ based
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold)" }}
            >
              Free
            </span>
          </div>

          <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: "var(--font-serif)" }}>
            {userFirstName ? `${userFirstName}, test your readiness` : "Test your readiness"}
          </p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            5 questions from actual PYQs. Results show your weak areas and exam-specific gaps.
          </p>

          <div className="cc-field mb-5">
            <label className="cc-label">Choose exam to test for</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="cc-select"
            >
              {safeIds.length > 0 && (
                <optgroup label="— You are eligible for —">
                  {availableExams
                    .filter((e) => safeIds.includes(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.short_name}</option>
                    ))}
                </optgroup>
              )}
              <optgroup label="— All exams —">
                {availableExams
                  .filter((e) => !safeIds.includes(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.short_name}</option>
                  ))}
              </optgroup>
            </select>
          </div>

          {exam && (
            <div className="flex flex-wrap gap-2 mb-5">
              {exam.subjects.slice(0, 4).map((s) => (
                <span
                  key={s.name}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "var(--bg-surface-md)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
                >
                  {s.name.split("(")[0].trim()}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={startTest}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: "var(--gold)", color: "#0c0c0c" }}
          >
            Start 5-question test →
          </button>
        </>
      )}

      {/* ── Testing ──────────────────────────────────────────────────── */}
      {phase === "testing" && q && (
        <>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {exam?.short_name} · {q.subject}
            </p>
            <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
              {current + 1} / {questions.length}
            </span>
          </div>

          <div className="w-full h-1 rounded-full mb-4" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(current / questions.length) * 100}%`, background: "var(--gold)" }}
            />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-surface-md)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              {q.topic}
            </span>
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>Source: {q.source}</span>
            <span className="ml-auto">{"⭐".repeat(q.difficulty)}</span>
          </div>

          <p className="text-white text-sm leading-relaxed mb-4 whitespace-pre-line">{q.text}</p>

          <div className="flex flex-col gap-2 mb-4">
            {q.options.map((opt, i) => {
              const isSelected = selected === i
              const isCorrect  = selected !== null && i === q.correct
              const isWrong    = selected !== null && isSelected && i !== q.correct
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                  style={{
                    border:      isCorrect ? "1px solid var(--success)" : isWrong ? "1px solid var(--danger)" : isSelected ? "1px solid var(--gold-border-md)" : "1px solid var(--border)",
                    background:  isCorrect ? "var(--success-bg)" : isWrong ? "var(--danger-bg)" : isSelected ? "var(--gold-faint)" : "var(--bg-surface)",
                    color:       isCorrect ? "var(--success)" : isWrong ? "var(--danger)" : isSelected ? "var(--gold)" : "rgba(255,255,255,0.70)",
                    cursor:      selected !== null ? "default" : "pointer",
                  }}
                >
                  <span className="font-mono text-xs mr-2.5" style={{ color: "var(--text-ghost)" }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                  {isCorrect && <span className="ml-2">✓</span>}
                  {isWrong   && <span className="ml-2">✗</span>}
                </button>
              )
            })}
          </div>

          {showExpl && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-xs leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-md)", color: "var(--text-muted)" }}
            >
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.70)" }}>Explanation: </span>
              {q.explanation}
            </div>
          )}

          {selected !== null && (
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--gold)", color: "#0c0c0c" }}
            >
              {current + 1 < questions.length ? "Next question →" : "See results →"}
            </button>
          )}
        </>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {phase === "results" && (
        <>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            Your results · {exam?.short_name}
          </p>

          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold shrink-0"
              style={{
                background:  pct >= 80 ? "var(--success-bg)" : pct >= 60 ? "var(--gold-faint)" : "var(--danger-bg)",
                border:      `2px solid ${pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--gold)" : "var(--danger)"}`,
                color:        pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--gold)" : "var(--danger)",
                fontFamily:  "var(--font-serif)",
              }}
            >
              {pct}%
            </div>
            <div>
              <p className="text-white text-sm font-medium">
                {pct >= 80 ? "Excellent! Strong foundation." : pct >= 60 ? "Good — focused prep needed." : "Needs significant improvement."}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {score}/{questions.length} correct · {exam?.short_name}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-5">
            {Object.entries(subjectResults).map(([subject, { correct, total }]) => {
              const pctSubj = Math.round((correct / total) * 100)
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-muted)" }}>{subject.split(" (")[0]}</span>
                    <span style={{ color: pctSubj >= 60 ? "var(--success)" : "var(--danger)" }}>{correct}/{total}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctSubj}%`, background: pctSubj >= 60 ? "var(--success)" : "var(--danger)" }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {exam && pct < 80 && (
            <div
              className="rounded-xl px-4 py-3 mb-4"
              style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)" }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: "var(--gold)" }}>
                {exam.short_name} competition score context
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                General cutoff in {exam.cycles[0]?.year ?? "recent cycle"}:{" "}
                <strong style={{ color: "white" }}>{exam.avg_cutoff_general ?? "—"}</strong> marks.
                Competition ratio:{" "}
                <strong style={{ color: "white" }}>{exam.avg_competition_ratio?.toLocaleString() ?? "—"}</strong> applicants/vacancy.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isPaid ? (
              <Link
                href={`/dashboard/chat?q=I+scored+${pct}%25+on+${exam?.short_name}+skill+test.+Help+me+build+a+study+plan.`}
                className="block w-full py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: "var(--gold)", color: "#0c0c0c", textDecoration: "none" }}
              >
                Get AI study plan for weak areas →
              </Link>
            ) : (
              <Link
                href="/pricing"
                className="block w-full py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ background: "var(--gold)", color: "#0c0c0c", textDecoration: "none" }}
              >
                Upgrade Pro — get AI study plan for {exam?.short_name} →
              </Link>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 rounded-xl text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-dim)", background: "transparent" }}
              >
                Try another exam
              </button>
              <button
                type="button"
                onClick={startTest}
                className="flex-1 py-2 rounded-xl text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-dim)", background: "transparent" }}
              >
                Retake test
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}