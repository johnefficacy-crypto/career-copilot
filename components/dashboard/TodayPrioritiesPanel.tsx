import Link from "next/link"
import type { MissionControlData } from "@/lib/db/mission-control"
import type { StudyTask } from "@/lib/db/study-tasks"

type Props = {
  missionControlData: MissionControlData
  todaysTasks: StudyTask[]
}

type PriorityItem = {
  title: string
  reason: string
  href: string
  cta: string
}

function getConfidenceLabel(profileBlockers: number): { label: string; tone: string } {
  if (profileBlockers <= 0) return { label: "High confidence", tone: "text-emerald-300" }
  if (profileBlockers <= 2) return { label: "Medium confidence", tone: "text-amber-300" }
  return { label: "Low confidence", tone: "text-rose-300" }
}

export function TodayPrioritiesPanel({ missionControlData, todaysTasks }: Props) {
  const summary = missionControlData.summary
  const openTasks = todaysTasks.filter((task) => task.status !== "done")

  const priorities: PriorityItem[] = []

  if (summary.closingThisWeek > 0) {
    priorities.push({
      title: "Act on closing deadlines",
      reason: `${summary.closingThisWeek} matching recruitments are closing within 7 days.`,
      href: "/dashboard/exams",
      cta: "Review urgent forms",
    })
  }

  if (summary.profileBlockers > 0) {
    priorities.push({
      title: "Improve match confidence",
      reason: `${summary.profileBlockers} recruitments need profile data before final fit can be confirmed.`,
      href: "/onboarding/identity",
      cta: "Complete missing profile data",
    })
  }

  if (openTasks.length > 0) {
    priorities.push({
      title: "Finish today's study tasks",
      reason: `${openTasks.length} task${openTasks.length === 1 ? "" : "s"} remain in your active plan.`,
      href: "/dashboard/study-plan",
      cta: "Open today's task list",
    })
  }

  if (priorities.length === 0) {
    priorities.push({
      title: "No blockers detected",
      reason: "Your deadlines, profile completeness, and study tasks look stable today.",
      href: "/dashboard/recruitments",
      cta: "Explore new opportunities",
    })
  }

  const confidence = getConfidenceLabel(summary.profileBlockers)

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Today&apos;s priorities</p>
          <h2 className="mt-1 text-lg font-semibold text-white">One deterministic action list</h2>
          <p className="mt-1 text-sm text-white/60">
            Ordered by urgency first (deadlines), confidence next (missing profile data), and then execution (study tasks).
          </p>
        </div>
        <span className={`rounded-full border border-white/10 px-3 py-1 text-xs font-medium ${confidence.tone}`}>
          {confidence.label}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {priorities.slice(0, 3).map((item, idx) => (
          <div key={`${item.title}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-sm font-medium text-white">{idx + 1}. {item.title}</p>
            <p className="mt-1 text-xs text-white/65">{item.reason}</p>
            <Link href={item.href} className="mt-2 inline-flex text-xs text-[#e8d5a3] hover:text-[#f4e8c3]">
              {item.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
