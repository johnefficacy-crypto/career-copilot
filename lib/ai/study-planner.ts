/**
 * AI Study Planner — Career Copilot
 *
 * Uses Claude API to generate a personalised, week-by-week study plan
 * based on the user's profile, target exam, deadline, and study capacity.
 *
 * Returns structured JSON — no markdown, no prose — so the UI can render
 * it directly into database rows without any parsing guesswork.
 */

// ─── Input / Output types ─────────────────────────────────────────────────────

export type PlannerInput = {
  // Exam context
  examName: string
  examType: string          // e.g. "Banking", "Regulatory", "UPSC"
  targetDate: string | null // ISO date string of deadline / exam date
  examStages: string[]      // e.g. ["Prelims", "Mains", "Interview"]

  // User context
  currentLevel: "beginner" | "intermediate" | "advanced"
  dailyHours: number
  weeklyDays: number
  educationLevel: string    // graduate | postgraduate etc.
  educationStream: string | null
  workingProfessional: boolean
  category: string | null   // for OBC/SC/ST — may affect reservation-specific topics

  // Prior knowledge
  strongSubjects: string[]
  weakSubjects: string[]
  previousAttempts: number
}

export type GeneratedWeek = {
  week_number: number
  title: string
  focus_area: string
  description: string
  topics: string[]
  daily_tasks: Array<{
    day: string        // "Monday" | "Tuesday" etc.
    task: string
    duration_mins: number
  }>
  resources: Array<{
    title: string
    type: "book" | "video" | "practice" | "mock_test" | "revision"
    url?: string
  }>
}

export type GeneratedPlan = {
  exam_name: string
  total_weeks: number
  overview: string
  subject_weightage: Record<string, number>  // {subject: percentage}
  weeks: GeneratedWeek[]
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an expert Indian competitive exam coach and study planner with deep knowledge of UPSC, SSC, Banking (IBPS/SBI/RBI), SEBI, NABARD, State PSCs, Railways, and other government exam patterns.

You create highly personalised, realistic, and actionable study plans. You understand:
- The exact syllabus and exam pattern for each exam
- How much time each topic realistically needs
- The difference between Prelims and Mains preparation strategy
- How to balance multiple subjects over weeks
- Realistic daily study targets for working professionals vs full-time aspirants
- Indian study resource ecosystem (Standard Khan Sir, Adda247, Testbook, Unacademy, standard books)

CRITICAL: You must respond with ONLY valid JSON. No markdown fences, no explanation, no preamble. The JSON must exactly match the schema provided.`
}

function buildUserPrompt(input: PlannerInput): string {
  const weeksAvailable = input.targetDate
    ? Math.max(4, Math.round(
        (new Date(input.targetDate).getTime() - Date.now()) /
        (7 * 24 * 60 * 60 * 1000)
      ))
    : 16

  const totalWeeks = Math.min(weeksAvailable, 24) // cap at 24 weeks

  return `Generate a complete ${totalWeeks}-week study plan for the following aspirant:

EXAM DETAILS:
- Exam: ${input.examName}
- Type: ${input.examType}
- Stages: ${input.examStages.length > 0 ? input.examStages.join(", ") : "Not specified"}
- Weeks available: ${totalWeeks}
- Target/deadline: ${input.targetDate ?? "Not specified — use ${totalWeeks} weeks"}

ASPIRANT PROFILE:
- Current level: ${input.currentLevel}
- Daily study hours: ${input.dailyHours}
- Study days per week: ${input.weeklyDays}
- Education: ${input.educationLevel}${input.educationStream ? ` (${input.educationStream})` : ""}
- Working professional: ${input.workingProfessional}
- Previous attempts: ${input.previousAttempts}
- Strong subjects: ${input.strongSubjects.length > 0 ? input.strongSubjects.join(", ") : "None specified"}
- Weak subjects: ${input.weakSubjects.length > 0 ? input.weakSubjects.join(", ") : "None specified"}

RULES FOR THE PLAN:
1. Allocate more time to weak subjects and high-weightage topics
2. Last 2 weeks must be revision + mock tests only
3. Each week must have exactly ${input.weeklyDays} day entries in daily_tasks
4. Suggest realistic Indian study resources (books, YouTube channels, apps)
5. Progressive difficulty — basics first, then advanced, then integration
6. For working professionals with ≤2 hrs/day, keep tasks ultra-focused

Respond with this EXACT JSON structure (no extra fields, no markdown):

{
  "exam_name": "${input.examName}",
  "total_weeks": ${totalWeeks},
  "overview": "2-3 sentence strategy overview",
  "subject_weightage": {
    "SubjectName": 25,
    "SubjectName2": 20
  },
  "weeks": [
    {
      "week_number": 1,
      "title": "Week title — subject focus",
      "focus_area": "Main Subject",
      "description": "What this week covers and why",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "daily_tasks": [
        {"day": "Monday", "task": "Specific task description", "duration_mins": 90},
        {"day": "Tuesday", "task": "Specific task description", "duration_mins": 60}
      ],
      "resources": [
        {"title": "Resource name", "type": "book"},
        {"title": "YouTube channel or app", "type": "video"}
      ]
    }
  ]
}`
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateStudyPlan(input: PlannerInput): Promise<GeneratedPlan> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: buildSystemPrompt(),
      messages: [
        { role: "user", content: buildUserPrompt(input) }
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const rawText = data.content?.[0]?.text ?? ""

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

  try {
    const plan = JSON.parse(cleaned) as GeneratedPlan
    return plan
  } catch (parseErr) {
    throw new Error(`Failed to parse Claude response as JSON: ${parseErr}`)
  }
}

// ─── Streaming generator (for real-time UI feedback) ─────────────────────────

export async function generateStudyPlanStream(
  input: PlannerInput,
  onChunk: (text: string) => void
): Promise<GeneratedPlan> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      stream: true,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error ${response.status}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))

    for (const line of lines) {
      const jsonStr = line.replace("data: ", "")
      if (jsonStr === "[DONE]") continue
      try {
        const event = JSON.parse(jsonStr)
        if (event.type === "content_block_delta" && event.delta?.text) {
          fullText += event.delta.text
          onChunk(event.delta.text)
        }
      } catch {}
    }
  }

  const cleaned = fullText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
  return JSON.parse(cleaned) as GeneratedPlan
}