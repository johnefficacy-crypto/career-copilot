"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { beginFocusSession, finishFocusSession } from "@/actions/study-tasks"

type TimerState = "idle" | "running" | "paused" | "done"

const PRESET_MINS = [25, 45, 60, 90]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export default function FocusTimerPage() {
  const [state, setState]           = useState<TimerState>("idle")
  const [targetMins, setTargetMins] = useState(25)
  const [elapsed, setElapsed]       = useState(0)
  const [subject, setSubject]       = useState("")
  const [topic, setTopic]           = useState("")
  const [notes, setNotes]           = useState("")
  const [sessionId, setSessionId]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const targetSeconds = targetMins * 60
  const remaining     = Math.max(0, targetSeconds - elapsed)
  const progress      = Math.min(1, elapsed / targetSeconds)
  const isDone        = elapsed >= targetSeconds

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (state === "running") {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= targetSeconds) {
            clearTimer()
            setState("done")
            return e + 1
          }
          return e + 1
        })
      }, 1000)
    } else {
      clearTimer()
    }
    return clearTimer
  }, [state, targetSeconds, clearTimer])

  async function handleStart() {
    const result = await beginFocusSession({
      subject: subject || undefined,
      topic:   topic || undefined,
    })
    if (result.sessionId) setSessionId(result.sessionId)
    setElapsed(0)
    setSaved(false)
    setState("running")
  }

  function handlePause() {
    setState("paused")
  }

  function handleResume() {
    setState("running")
  }

  async function handleFinish() {
    clearTimer()
    setState("done")
    if (sessionId) {
      setSaving(true)
      await finishFocusSession(sessionId, notes || undefined)
      setSaving(false)
      setSaved(true)
    }
  }

  function handleReset() {
    clearTimer()
    setState("idle")
    setElapsed(0)
    setSessionId(null)
    setSaved(false)
    setNotes("")
  }

  const circumference = 2 * Math.PI * 88
  const dashOffset    = circumference * (1 - progress)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-lg mx-auto px-6 py-10">
        <Link href="/dashboard/study-plan" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
          ← Study plans
        </Link>

        <h1 className="text-white text-3xl font-medium mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Focus timer
        </h1>
        <p className="text-white/35 text-sm mb-8">
          Track focused study sessions. Sessions are saved to your log automatically.
        </p>

        {/* Setup — only shown while idle */}
        {state === "idle" && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-6 flex flex-col gap-4">
            <p className="text-white/40 text-xs uppercase tracking-widest">Session setup</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/35 text-xs">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="General Awareness"
                className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/35 text-xs">Topic (optional)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="RBI Monetary Policy"
                className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/35 text-xs">Duration</label>
              <div className="flex gap-2">
                {PRESET_MINS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTargetMins(m)}
                    className={`flex-1 py-2 rounded-xl border text-sm transition-colors ${
                      targetMins === m
                        ? "border-[#e8d5a3]/40 bg-[#e8d5a3]/[0.06] text-[#e8d5a3]"
                        : "border-white/[0.08] text-white/40"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Timer ring */}
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                stroke={isDone ? "#4ade80" : state === "paused" ? "#fbbf24" : "#e8d5a3"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white text-4xl font-mono tabular-nums font-light">
                {isDone ? "Done!" : formatTime(remaining)}
              </span>
              {state !== "idle" && (
                <span className="text-white/30 text-xs mt-1">
                  {subject || "Focus session"}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {state === "idle" && (
              <button
                onClick={handleStart}
                className="px-8 py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
              >
                Start session
              </button>
            )}

            {state === "running" && (
              <>
                <button
                  onClick={handlePause}
                  className="px-5 py-2.5 rounded-xl border border-white/[0.12] text-white/60 text-sm hover:text-white transition-colors"
                >
                  Pause
                </button>
                <button
                  onClick={handleFinish}
                  className="px-5 py-2.5 rounded-xl border border-[#e8d5a3]/20 text-[#e8d5a3]/60 text-sm hover:text-[#e8d5a3] transition-colors"
                >
                  Finish early
                </button>
              </>
            )}

            {state === "paused" && (
              <>
                <button
                  onClick={handleResume}
                  className="px-8 py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={handleFinish}
                  className="px-5 py-2.5 rounded-xl border border-white/[0.12] text-white/50 text-sm hover:text-white transition-colors"
                >
                  Finish
                </button>
              </>
            )}

            {state === "done" && (
              <button
                onClick={handleReset}
                className="px-8 py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
              >
                New session
              </button>
            )}
          </div>
        </div>

        {/* Notes — shown when session active or done */}
        {(state === "paused" || state === "done") && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-4">
            <label className="text-white/40 text-xs uppercase tracking-widest block mb-2">Session notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you cover? Any key takeaways?"
              rows={3}
              className="w-full bg-transparent text-white/70 text-sm placeholder:text-white/20 focus:outline-none resize-none"
            />
            {state === "done" && !saved && sessionId && (
              <button
                onClick={async () => {
                  setSaving(true)
                  await finishFocusSession(sessionId, notes || undefined)
                  setSaving(false)
                  setSaved(true)
                }}
                disabled={saving}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3]/70 hover:text-[#e8d5a3] transition-colors disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save notes"}
              </button>
            )}
            {saved && (
              <p className="mt-2 text-xs text-emerald-400/70">Session saved to your log.</p>
            )}
          </div>
        )}

        {/* Stats strip */}
        {state !== "idle" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Elapsed",  val: formatTime(elapsed) },
              { label: "Target",   val: `${targetMins}m` },
              { label: "Progress", val: `${Math.round(progress * 100)}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
                <p className="text-white/25 text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-white/70 text-sm font-mono tabular-nums">{s.val}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
