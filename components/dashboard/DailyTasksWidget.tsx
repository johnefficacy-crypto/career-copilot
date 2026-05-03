"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { StudyTask, TaskType } from "@/lib/db/study-tasks"
import { completeTask, skipTask, setTaskInProgress } from "@/actions/study-tasks"

// ─── Icons ────────────────────────────────────────────────────────────────────

const TASK_ICON: Record<TaskType, string> = {
  study:    "📖",
  practice: "✏️",
  revise:   "🔁",
  mock:     "📝",
  read:     "📄",
  watch:    "▶️",
}

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  study:    "Study",
  practice: "Practice",
  revise:   "Revise",
  mock:     "Mock test",
  read:     "Read",
  watch:    "Watch",
}

// ─── Single task row ──────────────────────────────────────────────────────────

function TaskRow({
  task,
  onComplete,
  onSkip,
  onStart,
  busy,
}: {
  task:       StudyTask
  onComplete: (id: string) => void
  onSkip:     (id: string) => void
  onStart:    (id: string) => void
  busy:       boolean
}) {
  const isDone      = task.status === "done"
  const isSkipped   = task.status === "skipped"
  const isActive    = task.status === "in_progress"
  const isInactive  = isDone || isSkipped

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 transition-colors"
      style={{
        background: isDone
          ? "rgba(16,185,129,0.06)"
          : isSkipped
          ? "rgba(255,255,255,0.02)"
          : isActive
          ? "rgba(232,213,163,0.06)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isDone
          ? "rgba(16,185,129,0.15)"
          : isSkipped
          ? "rgba(255,255,255,0.05)"
          : isActive
          ? "rgba(232,213,163,0.20)"
          : "rgba(255,255,255,0.07)"}`,
        opacity: isSkipped ? 0.5 : 1,
      }}
    >
      {/* Status circle / icon */}
      <button
        onClick={() => !isDone && onComplete(task.id)}
        disabled={busy || isInactive}
        className="w-5 h-5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors"
        style={{
          borderColor: isDone ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.20)",
          background:  isDone ? "rgba(16,185,129,0.20)" : "transparent",
        }}
        aria-label="Mark done"
      >
        {isDone && <span className="text-emerald-400 text-xs">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs">{TASK_ICON[task.task_type]}</span>
          <span
            className={`text-sm font-medium truncate ${isInactive ? "line-through text-white/30" : "text-white/85"}`}
          >
            {task.title}
          </span>
        </div>

        {task.subject && (
          <p className="text-xs text-white/35 mt-0.5 truncate">
            {[TASK_TYPE_LABEL[task.task_type], task.subject, task.topic]
              .filter(Boolean)
              .join(" · ")}
            {task.duration_mins && ` · ${task.duration_mins} min`}
          </p>
        )}

        {/* Resources */}
        {Array.isArray(task.resources) && task.resources.length > 0 && !isInactive && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {task.resources.slice(0, 2).map((r, i) => (
              r.url
                ? <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs underline-offset-2 underline transition-opacity hover:opacity-70"
                    style={{ color: "rgba(232,213,163,0.55)" }}>
                    {r.title}
                  </a>
                : <span key={i} className="text-xs text-white/30">{r.title}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isInactive && (
        <div className="flex items-center gap-1.5 shrink-0">
          {!isActive && (
            <button
              onClick={() => onStart(task.id)}
              disabled={busy}
              className="text-xs px-2 py-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
            >
              Start
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onComplete(task.id)}
              disabled={busy}
              className="text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: "rgba(16,185,129,0.80)", background: "rgba(16,185,129,0.10)" }}
            >
              Done
            </button>
          )}
          <button
            onClick={() => onSkip(task.id)}
            disabled={busy}
            className="text-xs px-2 py-1 rounded-lg text-white/20 hover:text-white/40 transition-colors"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Widget ───────────────────────────────────────────────────────────────────

interface Props {
  tasks:       StudyTask[]
  planId:      string
  examName:    string
  planPageUrl: string
}

export function DailyTasksWidget({ tasks, planId, examName, planPageUrl }: Props) {
  const [items, setItems]       = useState(tasks)
  const [pending, startTrans]   = useTransition()

  const done    = items.filter(t => t.status === "done").length
  const total   = items.length
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0

  function updateLocal(id: string, status: StudyTask["status"]) {
    setItems(prev =>
      prev.map(t => t.id === id ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : t.completed_at } : t)
    )
  }

  function handleComplete(id: string) {
    updateLocal(id, "done")
    startTrans(async () => { await completeTask(id) })
  }

  function handleSkip(id: string) {
    updateLocal(id, "skipped")
    startTrans(async () => { await skipTask(id) })
  }

  function handleStart(id: string) {
    updateLocal(id, "in_progress")
    startTrans(async () => { await setTaskInProgress(id) })
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/70">Today&apos;s tasks</h3>
          <Link href={planPageUrl} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            View plan →
          </Link>
        </div>
        <p className="text-xs text-white/30 text-center py-4">
          No tasks scheduled for today.
          <br />
          <Link href={planPageUrl} className="underline underline-offset-2 mt-1 inline-block hover:text-white/50 transition-colors">
            Open plan to generate tasks →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white/70">Today&apos;s tasks</h3>
          <p className="text-xs text-white/30 mt-0.5">{examName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">{done}/{total} done</span>
          <Link href={planPageUrl} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Full plan →
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/[0.06] mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width:      `${pct}%`,
            background: pct === 100
              ? "rgba(16,185,129,0.70)"
              : "rgba(232,213,163,0.50)",
          }}
        />
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {items.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onSkip={handleSkip}
            onStart={handleStart}
            busy={pending}
          />
        ))}
      </div>

      {pct === 100 && (
        <p className="text-center text-xs mt-4" style={{ color: "rgba(16,185,129,0.70)" }}>
          ✓ All tasks done for today. Great work.
        </p>
      )}
    </div>
  )
}
