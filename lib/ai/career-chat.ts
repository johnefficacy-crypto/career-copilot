/**
 * lib/ai/career-chat.ts
 * Phase 8 — AI Career Chat
 *
 * Builds the personalised system prompt from the user's live profile
 * and calls the Anthropic Messages API with streaming.
 */

import type { ChatMessage, ChatUserContext } from "@/types/chat"

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL         = "claude-sonnet-4-6"
const MAX_TOKENS    = 2048
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const API_VERSION   = "2023-06-01"

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: ChatUserContext): string {
  const profileLines: string[] = []

  if (ctx.full_name)         profileLines.push(`Name: ${ctx.full_name}`)
  if (ctx.career_stage)      profileLines.push(`Career stage: ${ctx.career_stage}`)
  if (ctx.target_exam)       profileLines.push(`Target exam: ${ctx.target_exam}`)
  if (ctx.category)          profileLines.push(`Reservation category: ${ctx.category.toUpperCase()}`)
  if (ctx.domicile_state)    profileLines.push(`Domicile state: ${ctx.domicile_state}`)
  if (ctx.education_summary) profileLines.push(`Education: ${ctx.education_summary}`)

  if (ctx.dob) {
    const age = Math.floor(
      (Date.now() - new Date(ctx.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    )
    profileLines.push(`Age: ${age} years`)
  }

  const profileSection = profileLines.length > 0
    ? `\nASPIRANT PROFILE:\n${profileLines.map((l) => `- ${l}`).join("\n")}\n`
    : ""

  // The career_goal is the aspirant's own words about their deeper ambition.
  // It is injected as a named, prominent section so Claude always sees it as
  // the north-star context when framing advice — not just another profile fact.
  const goalSection = ctx.career_goal
    ? `\nASPIRANT'S CAREER GOAL (in their own words):\n"${ctx.career_goal.trim()}"\n\n` +
      `Always keep this goal in mind. Frame exam choices, study plans, and career advice ` +
      `in terms of how they serve this aspiration. Acknowledge it explicitly when relevant.\n`
    : ""

  return `You are an expert career advisor and coaching mentor for Indian government \
and semi-government exam aspirants. You have deep, authoritative knowledge of:

- UPSC Civil Services (IAS/IPS/IFS/IRS), CAPF, EPFO, and all central services
- Banking: IBPS PO/Clerk/SO/RRB, SBI PO/Clerk/SO, RBI Grade B/Assistant, NABARD Grade A/B
- Regulatory bodies: SEBI Grade A, IRDAI, PFRDA, FCI, NHB, SIDBI
- SSC: CGL, CHSL, CPO, JE, MTS, GD Constable, Stenographer
- Railways: RRB NTPC, Group D, JE, ALP, RPF, RRB Group C
- Defence: CDS, NDA, AFCAT, Territorial Army, MNS, ACC
- State PSCs: MPSC, BPSC, UPPSC, KPSC, TNPSC, APPSC, TSPSC, MPPSC, RPSC, WBPSC, and all others
- PSUs: BHEL, ONGC, NTPC, Coal India, GAIL, IOCL, SAIL, BPCL, HPCL, BEL, HAL, DRDO
- Judiciary: All India Judicial Services, District Court, High Court, Notary
- Teaching: KVS, NVS, DSSSB, State TET/TGT/PGT, CTET, UGC NET, CSIR NET
- Insurance: LIC AAO/ADO, GIC, UIIC, NIACL, OICL, Oriental Insurance
${profileSection}${goalSection}
You give personalised, direct, actionable guidance tailored to the aspirant's profile. \
You deeply understand Indian eligibility rules — age relaxations for OBC/SC/ST/PwBD/\
Ex-Serviceman/Govt Employees, attempt limits for each exam, minimum educational qualifications \
for specific posts, domicile requirements for state exams, and document requirements.

RESPONSE RULES:
1. **Always personalise.** Reference the aspirant's age, category, education, state, and stage in every relevant answer. Never give generic advice.
2. **Be direct and specific.** Name exact exams, exact cut-offs, exact books, exact topics. No vague advice.
3. **For exam queries** — mention current pattern, sections, total marks, negative marking, selection stages, and approx vacancies.
4. **For "which exam" questions** — ask 2-3 targeted follow-up questions about timeline, preferred work type, and location preference before recommending.
5. **For study plans** — give week-by-week structure: topics, hours per day, specific books/sources, revision strategy, mock test schedule.
6. **Format well for chat.** Use bullet points for lists. Bold key facts. Keep paragraphs short. This is a mobile-friendly chat interface.
7. **Never claim to know current notification dates or results.** Say "check the official site at [official URL] for current status."
8. **Age + attempt calculations** — compute these precisely from the user's profile. Call out if the user is near an age/attempt limit and must prioritise.
9. **Eligibility red flags** — proactively flag if the user might be ineligible (wrong degree, age exceeded, state domicile mismatch).
10. **Language** — respond in the same language the user writes in (English, Hindi, or Hinglish). Mirror their register (formal vs casual).
11. **Honesty** — if you are uncertain, say so and suggest how to verify. Never fabricate syllabus points or cut-off marks.
12. **Current affairs** — recommend The Hindu, Indian Express (Explained), InsightsOnIndia, Vision IAS or Drishti IAS depending on the exam.

EXAM-SPECIFIC KNOWLEDGE YOU MUST USE:
- UPSC CSE Prelims: 100Q GS + 80Q CSAT (qualifying). Mains: 9 papers (Essay + 4 GS + 2 Optional + 2 Lang). Interview: 275 marks.
- RBI Grade B Phase 1: 200Q (GA/English/Quant/Reasoning) online. Phase 2: Economic Policy + FM + Management. Interview.
- SEBI Grade A: Phase 1 (100Q MCQ) + Phase 2 (Paper 1: Commerce/Economics + Paper 2: Specialist stream) + Interview.
- IBPS PO: Prelims (100Q: English/Quant/Reasoning) + Mains (200Q + Descriptive) + Interview.
- SSC CGL: Tier 1 (100Q, 60 min) + Tier 2 (Paper 1: Math+Reasoning+English+GA; Paper 2: Statistics/Finance for specific posts).
- The current year is 2026. Use this for age calculations.`
}

// ─── Streaming caller ─────────────────────────────────────────────────────────

export async function streamChatResponse(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      stream:     true,
      system:     systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${body}`)
  }

  return response
}

// ─── Title generation ─────────────────────────────────────────────────────────

export async function generateSessionTitle(
  firstUserMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return "Career chat"

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 20,
        system:
          "Generate a concise 4–6 word title for this chat session based on the user's message. " +
          "Examples: 'SEBI Grade A age limit', 'UPSC vs State PSC comparison', 'RBI Grade B study plan'. " +
          "Reply with ONLY the title — no quotes, no punctuation at the end.",
        messages: [{ role: "user", content: firstUserMessage }],
      }),
    })

    if (!response.ok) return "Career chat"

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
    }
    return data.content?.[0]?.text?.trim() ?? "Career chat"
  } catch {
    return "Career chat"
  }
}