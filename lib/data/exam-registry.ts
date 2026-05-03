/**
 * lib/data/exam-registry.ts
 *
 * Canonical registry of Indian competitive examinations.
 * Used by: skill tests, study plan builder, exam detail pages,
 * recommendations, login page exam strips, and course suggestions.
 *
 * Data sources: Official notifications, UPSC/IBPS/SSC/RBI/SEBI websites.
 * Update annually after each notification cycle.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExamCategory =
  | "UPSC" | "Banking" | "SSC" | "Railways" | "State PSC"
  | "Regulatory" | "Defence" | "Insurance" | "Teaching" | "Judiciary"

export type ExamStage = {
  name:     string
  type:     "written_objective" | "written_descriptive" | "typing" | "interview" | "physical" | "skill"
  duration: string   // e.g. "3 hours"
}

export type CategoryCutoff = {
  category: string
  score:    number
  vacancy:  number
}

export type YearlyCycle = {
  year:           number
  notification:   string    // ISO date
  apply_start:    string
  apply_end:      string
  exam_date?:     string
  result_date?:   string
  vacancies_total: number
  cutoffs?:       CategoryCutoff[]
  competition_ratio?: number  // applicants per vacancy
}

export type SyllabusSubject = {
  name:       string
  weight_pct: number     // approximate % of marks
  difficulty: 1 | 2 | 3 | 4 | 5
}

export type ExamEntry = {
  id:              string
  name:            string
  short_name:      string
  category:        ExamCategory
  conducting_body: string
  official_url:    string
  career_url:      string
  notification_url?: string
  description:     string

  // Eligibility basics
  min_age:         number
  max_age:         number    // general category
  education:       string    // minimum qualification

  // Format
  stages:          ExamStage[]
  medium:          string[]  // ["English", "Hindi"]

  // Syllabus
  subjects:        SyllabusSubject[]

  // Historical data
  cycles:          YearlyCycle[]

  // Competition score — calculated from cycles
  avg_cutoff_general?: number
  avg_competition_ratio?: number
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const EXAM_REGISTRY: ExamEntry[] = [

  // ── UPSC CSE ──────────────────────────────────────────────────────────────
  {
    id:              "upsc-cse",
    name:            "UPSC Civil Services Examination",
    short_name:      "UPSC CSE",
    category:        "UPSC",
    conducting_body: "Union Public Service Commission",
    official_url:    "https://upsc.gov.in",
    career_url:      "https://upsc.gov.in/examinations/active-examinations",
    notification_url:"https://upsc.gov.in/examinations/active-examinations",
    description:     "Recruitment to IAS, IPS, IFS and 24 other Group A & B Central Services. Most competitive exam in India.",
    min_age: 21, max_age: 32,
    education: "Graduate in any discipline from a recognised university",
    medium: ["English", "Hindi", "Regional languages (Mains)"],
    stages: [
      { name: "Prelims",   type: "written_objective",   duration: "4 hours (2 papers)" },
      { name: "Mains",     type: "written_descriptive", duration: "~25 hours over 9 papers" },
      { name: "Interview", type: "interview",            duration: "30-45 minutes" },
    ],
    subjects: [
      { name: "General Studies I (History, Geography, Society)", weight_pct: 12, difficulty: 4 },
      { name: "General Studies II (Polity, Governance, IR)",     weight_pct: 12, difficulty: 4 },
      { name: "General Studies III (Economy, Science, Env)",     weight_pct: 12, difficulty: 4 },
      { name: "General Studies IV (Ethics)",                     weight_pct: 12, difficulty: 3 },
      { name: "Optional Subject Paper I",                        weight_pct: 16, difficulty: 5 },
      { name: "Optional Subject Paper II",                       weight_pct: 16, difficulty: 5 },
      { name: "Essay",                                           weight_pct: 10, difficulty: 3 },
      { name: "Aptitude (CSAT)",                                 weight_pct: 10, difficulty: 2 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-02-14", apply_start: "2024-02-14", apply_end: "2024-03-05",
        exam_date: "2024-05-26", result_date: "2024-06-24",
        vacancies_total: 1056, competition_ratio: 1026,
        cutoffs: [
          { category: "General", score: 100, vacancy: 508 },
          { category: "OBC",     score: 91,  vacancy: 279 },
          { category: "SC",      score: 76,  vacancy: 161 },
          { category: "ST",      score: 69,  vacancy: 87  },
          { category: "EWS",     score: 90,  vacancy: 105 },
        ],
      },
      {
        year: 2023, notification: "2023-02-01", apply_start: "2023-02-01", apply_end: "2023-02-21",
        vacancies_total: 1105, competition_ratio: 924,
        cutoffs: [
          { category: "General", score: 104, vacancy: 533 },
          { category: "OBC",     score: 93,  vacancy: 296 },
          { category: "SC",      score: 78,  vacancy: 166 },
          { category: "ST",      score: 70,  vacancy: 89  },
        ],
      },
    ],
    avg_cutoff_general: 102,
    avg_competition_ratio: 975,
  },

  // ── RBI Grade B ───────────────────────────────────────────────────────────
  {
    id:              "rbi-grade-b",
    name:            "RBI Grade B Officer (DR) Examination",
    short_name:      "RBI Grade B",
    category:        "Banking",
    conducting_body: "Reserve Bank of India",
    official_url:    "https://www.rbi.org.in",
    career_url:      "https://opportunities.rbi.org.in",
    description:     "Grade B Officer in RBI's General, DEPR, and DSIM streams. One of the most prestigious banking jobs.",
    min_age: 21, max_age: 30,
    education: "Graduate with minimum 60% (55% for SC/ST) OR PG with 55% (50% SC/ST)",
    medium: ["English"],
    stages: [
      { name: "Phase I (Online)",   type: "written_objective",   duration: "2 hours" },
      { name: "Phase II (Online)",  type: "written_descriptive", duration: "3 hours per paper" },
      { name: "Interview",          type: "interview",            duration: "20-30 minutes" },
    ],
    subjects: [
      { name: "General Awareness (Economy & Finance)", weight_pct: 25, difficulty: 4 },
      { name: "English (Writing)",                     weight_pct: 20, difficulty: 3 },
      { name: "Economic & Social Issues",              weight_pct: 20, difficulty: 4 },
      { name: "Finance & Management",                  weight_pct: 20, difficulty: 4 },
      { name: "Quantitative Methods",                  weight_pct: 15, difficulty: 4 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-01-12", apply_start: "2024-01-12", apply_end: "2024-02-06",
        vacancies_total: 94, competition_ratio: 3404,
        cutoffs: [
          { category: "General", score: 189, vacancy: 41 },
          { category: "OBC",     score: 177, vacancy: 25 },
          { category: "SC",      score: 160, vacancy: 12 },
          { category: "ST",      score: 154, vacancy: 7  },
        ],
      },
      {
        year: 2023, notification: "2023-03-28", apply_start: "2023-03-28", apply_end: "2023-04-21",
        vacancies_total: 291, competition_ratio: 1780,
        cutoffs: [
          { category: "General", score: 183, vacancy: 130 },
          { category: "OBC",     score: 170, vacancy: 78  },
          { category: "SC",      score: 155, vacancy: 44  },
        ],
      },
    ],
    avg_cutoff_general: 186,
    avg_competition_ratio: 2592,
  },

  // ── SEBI Grade A ──────────────────────────────────────────────────────────
  {
    id:              "sebi-grade-a",
    name:            "SEBI Grade A Officer Examination",
    short_name:      "SEBI Grade A",
    category:        "Regulatory",
    conducting_body: "Securities and Exchange Board of India",
    official_url:    "https://www.sebi.gov.in",
    career_url:      "https://www.sebi.gov.in/careers.html",
    description:     "Officer Grade A in SEBI — regulator of securities markets. General, Legal, IT, Research, and Official Language streams.",
    min_age: 21, max_age: 30,
    education: "Graduate with 60% (55% SC/ST). Post-graduation preferred for certain streams.",
    medium: ["English"],
    stages: [
      { name: "Phase I",   type: "written_objective",   duration: "2 hours" },
      { name: "Phase II",  type: "written_descriptive", duration: "2 hours" },
      { name: "Interview", type: "interview",            duration: "20 minutes" },
    ],
    subjects: [
      { name: "Securities Market & Economy",   weight_pct: 30, difficulty: 5 },
      { name: "English (Comprehension/Essay)", weight_pct: 20, difficulty: 3 },
      { name: "Quantitative Aptitude",         weight_pct: 20, difficulty: 3 },
      { name: "General Awareness",             weight_pct: 15, difficulty: 3 },
      { name: "Reasoning",                     weight_pct: 15, difficulty: 3 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-02-27", apply_start: "2024-02-27", apply_end: "2024-03-18",
        vacancies_total: 97, competition_ratio: 4700,
        cutoffs: [
          { category: "General", score: 156, vacancy: 44 },
          { category: "OBC",     score: 147, vacancy: 26 },
          { category: "SC",      score: 130, vacancy: 14 },
          { category: "ST",      score: 122, vacancy: 7  },
        ],
      },
    ],
    avg_cutoff_general: 156,
    avg_competition_ratio: 4700,
  },

  // ── IBPS PO ───────────────────────────────────────────────────────────────
  {
    id:              "ibps-po",
    name:            "IBPS Probationary Officer (PO) Examination",
    short_name:      "IBPS PO",
    category:        "Banking",
    conducting_body: "Institute of Banking Personnel Selection",
    official_url:    "https://www.ibps.in",
    career_url:      "https://www.ibps.in/crp-po-mts-clerk",
    description:     "Probationary Officer recruitment for 12+ nationalised banks including Punjab National Bank, Bank of Baroda, Canara Bank, Union Bank.",
    min_age: 20, max_age: 30,
    education: "Graduate in any discipline from a recognised university",
    medium: ["English", "Hindi"],
    stages: [
      { name: "Prelims",  type: "written_objective", duration: "1 hour" },
      { name: "Mains",    type: "written_objective", duration: "3.5 hours (4 sections + descriptive)" },
      { name: "Interview",type: "interview",          duration: "15-20 minutes" },
    ],
    subjects: [
      { name: "English Language",           weight_pct: 20, difficulty: 3 },
      { name: "Quantitative Aptitude",      weight_pct: 25, difficulty: 3 },
      { name: "Reasoning Ability",          weight_pct: 25, difficulty: 3 },
      { name: "General / Economy Awareness",weight_pct: 20, difficulty: 3 },
      { name: "Computer Knowledge",         weight_pct: 10, difficulty: 2 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-07-30", apply_start: "2024-07-30", apply_end: "2024-08-20",
        vacancies_total: 4455, competition_ratio: 1960,
        cutoffs: [
          { category: "General", score: 67.25, vacancy: 2040 },
          { category: "OBC",     score: 63.50, vacancy: 1198 },
          { category: "SC",      score: 54.25, vacancy: 667  },
          { category: "ST",      score: 47.75, vacancy: 334  },
          { category: "EWS",     score: 64.00, vacancy: 216  },
        ],
      },
      {
        year: 2023, notification: "2023-07-28", apply_start: "2023-07-28", apply_end: "2023-08-18",
        vacancies_total: 3049, competition_ratio: 2145,
        cutoffs: [
          { category: "General", score: 66.75, vacancy: 1396 },
          { category: "OBC",     score: 62.00, vacancy: 820  },
          { category: "SC",      score: 52.50, vacancy: 458  },
          { category: "ST",      score: 45.25, vacancy: 229  },
        ],
      },
    ],
    avg_cutoff_general: 67,
    avg_competition_ratio: 2053,
  },

  // ── SSC CGL ───────────────────────────────────────────────────────────────
  {
    id:              "ssc-cgl",
    name:            "SSC Combined Graduate Level Examination",
    short_name:      "SSC CGL",
    category:        "SSC",
    conducting_body: "Staff Selection Commission",
    official_url:    "https://ssc.gov.in",
    career_url:      "https://ssc.gov.in/Portal/Home",
    description:     "Graduate-level recruitment for Group B and C posts across central ministries — Income Tax Inspector, Assistant Section Officer, CBI Sub-Inspector, etc.",
    min_age: 18, max_age: 32,
    education: "Graduate in any discipline",
    medium: ["English", "Hindi"],
    stages: [
      { name: "Tier I (CBT)",  type: "written_objective", duration: "1 hour" },
      { name: "Tier II (CBT)", type: "written_objective", duration: "2.5 hours" },
    ],
    subjects: [
      { name: "General Intelligence & Reasoning", weight_pct: 25, difficulty: 3 },
      { name: "General Awareness",                weight_pct: 25, difficulty: 3 },
      { name: "Quantitative Aptitude",            weight_pct: 25, difficulty: 3 },
      { name: "English Comprehension",            weight_pct: 25, difficulty: 2 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-06-24", apply_start: "2024-06-24", apply_end: "2024-07-24",
        vacancies_total: 17727, competition_ratio: 761,
        cutoffs: [
          { category: "General", score: 179.05, vacancy: 8117 },
          { category: "OBC",     score: 173.36, vacancy: 4765 },
          { category: "SC",      score: 160.07, vacancy: 2659 },
          { category: "ST",      score: 148.10, vacancy: 1329 },
          { category: "EWS",     score: 172.49, vacancy: 1768 },
        ],
      },
    ],
    avg_cutoff_general: 179,
    avg_competition_ratio: 761,
  },

  // ── SBI PO ────────────────────────────────────────────────────────────────
  {
    id:              "sbi-po",
    name:            "SBI Probationary Officer Examination",
    short_name:      "SBI PO",
    category:        "Banking",
    conducting_body: "State Bank of India",
    official_url:    "https://bank.sbi",
    career_url:      "https://bank.sbi/careers",
    description:     "PO recruitment in India's largest public sector bank. Includes both objective and descriptive tests.",
    min_age: 21, max_age: 30,
    education: "Graduate in any discipline",
    medium: ["English", "Hindi"],
    stages: [
      { name: "Prelims",           type: "written_objective",   duration: "1 hour" },
      { name: "Mains",             type: "written_objective",   duration: "3 hours" },
      { name: "Descriptive Test",  type: "written_descriptive", duration: "30 minutes" },
      { name: "GD + Interview",    type: "interview",            duration: "30-45 minutes" },
    ],
    subjects: [
      { name: "Reasoning & Computer Aptitude", weight_pct: 25, difficulty: 4 },
      { name: "Data Analysis & Interpretation",weight_pct: 25, difficulty: 4 },
      { name: "General/Economy/Banking Awareness", weight_pct: 30, difficulty: 3 },
      { name: "English Language",               weight_pct: 20, difficulty: 3 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-02-07", apply_start: "2024-02-07", apply_end: "2024-02-27",
        vacancies_total: 600, competition_ratio: 3785,
        cutoffs: [
          { category: "General", score: 55.34, vacancy: 274 },
          { category: "OBC",     score: 52.34, vacancy: 162 },
          { category: "SC",      score: 43.34, vacancy: 90  },
          { category: "ST",      score: 38.34, vacancy: 45  },
        ],
      },
    ],
    avg_cutoff_general: 55,
    avg_competition_ratio: 3785,
  },

  // ── NABARD Grade A ────────────────────────────────────────────────────────
  {
    id:              "nabard-grade-a",
    name:            "NABARD Development Assistant Grade A",
    short_name:      "NABARD Grade A",
    category:        "Banking",
    conducting_body: "National Bank for Agriculture and Rural Development",
    official_url:    "https://www.nabard.org",
    career_url:      "https://www.nabard.org/content.aspx?id=591",
    description:     "Development Assistant recruitment for agriculture finance, rural development and economic research roles.",
    min_age: 21, max_age: 30,
    education: "Graduate with 60% OR PG with 55%",
    medium: ["English"],
    stages: [
      { name: "Phase I (Online)", type: "written_objective",   duration: "2.5 hours" },
      { name: "Phase II (Online)",type: "written_descriptive", duration: "1.5 hours" },
      { name: "Interview",        type: "interview",            duration: "20 minutes" },
    ],
    subjects: [
      { name: "Agriculture & Rural Development",weight_pct: 30, difficulty: 4 },
      { name: "Economic & Social Issues",       weight_pct: 25, difficulty: 4 },
      { name: "English (Drafting & Essay)",     weight_pct: 20, difficulty: 3 },
      { name: "Quantitative Methods",           weight_pct: 15, difficulty: 3 },
      { name: "General Awareness",              weight_pct: 10, difficulty: 2 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-05-17", apply_start: "2024-05-17", apply_end: "2024-06-07",
        vacancies_total: 102, competition_ratio: 4216,
        cutoffs: [
          { category: "General", score: 149, vacancy: 47 },
          { category: "OBC",     score: 138, vacancy: 27 },
          { category: "SC",      score: 124, vacancy: 15 },
          { category: "ST",      score: 117, vacancy: 8  },
        ],
      },
    ],
    avg_cutoff_general: 149,
    avg_competition_ratio: 4216,
  },

  // ── Railways NTPC ─────────────────────────────────────────────────────────
  {
    id:              "rrb-ntpc",
    name:            "RRB Non-Technical Popular Categories Examination",
    short_name:      "RRB NTPC",
    category:        "Railways",
    conducting_body: "Railway Recruitment Board",
    official_url:    "https://indianrailways.gov.in",
    career_url:      "https://www.rrbapply.gov.in",
    description:     "Non-technical posts — Junior Clerk, Accounts Clerk, Junior Time Keeper, Traffic Assistant, Station Master, Goods Guard, and Senior Clerk.",
    min_age: 18, max_age: 30,
    education: "12th pass (Level 2/3) or Graduate (Level 4-6)",
    medium: ["English", "Hindi", "Regional languages"],
    stages: [
      { name: "CBT Stage 1", type: "written_objective", duration: "1.5 hours" },
      { name: "CBT Stage 2", type: "written_objective", duration: "1.5 hours" },
      { name: "Typing Skill Test (for select posts)", type: "typing", duration: "10 minutes" },
      { name: "Document Verification", type: "interview", duration: "1 day" },
    ],
    subjects: [
      { name: "Mathematics",                    weight_pct: 33, difficulty: 2 },
      { name: "General Intelligence & Reasoning",weight_pct: 33, difficulty: 2 },
      { name: "General Awareness",              weight_pct: 34, difficulty: 2 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-09-14", apply_start: "2024-09-14", apply_end: "2024-10-13",
        vacancies_total: 11558, competition_ratio: 1220,
        cutoffs: [
          { category: "General", score: 68.32, vacancy: 5292 },
          { category: "OBC",     score: 64.15, vacancy: 3103 },
          { category: "SC",      score: 56.72, vacancy: 1733 },
          { category: "ST",      score: 50.44, vacancy: 866  },
        ],
      },
    ],
    avg_cutoff_general: 68,
    avg_competition_ratio: 1220,
  },

  // ── NDA ───────────────────────────────────────────────────────────────────
  {
    id:              "nda",
    name:            "National Defence Academy & Naval Academy Examination",
    short_name:      "NDA",
    category:        "Defence",
    conducting_body: "Union Public Service Commission",
    official_url:    "https://upsc.gov.in",
    career_url:      "https://upsc.gov.in/examinations/active-examinations",
    description:     "Entry to Army, Navy and Air Force wings of NDA and Naval Academy for 10+2 qualified candidates.",
    min_age: 16, max_age: 19,
    education: "12th pass or appearing for Army wing. PCM for Air Force and Naval Academy.",
    medium: ["English", "Hindi"],
    stages: [
      { name: "Written",   type: "written_objective",  duration: "5 hours" },
      { name: "SSB Interview", type: "interview",      duration: "5 days" },
      { name: "Medical",   type: "physical",           duration: "1 day" },
    ],
    subjects: [
      { name: "Mathematics", weight_pct: 50, difficulty: 3 },
      { name: "GAT (English, GK, Physics, Chemistry, History, Geography)", weight_pct: 50, difficulty: 3 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-12-11", apply_start: "2024-12-11", apply_end: "2024-12-31",
        vacancies_total: 406, competition_ratio: 1330,
        cutoffs: [
          { category: "General", score: 360, vacancy: 200 },
          { category: "SC",      score: 310, vacancy: 65  },
          { category: "ST",      score: 295, vacancy: 45  },
        ],
      },
    ],
    avg_cutoff_general: 360,
    avg_competition_ratio: 1330,
  },

  // ── IBPS Clerk ────────────────────────────────────────────────────────────
  {
    id:              "ibps-clerk",
    name:            "IBPS Clerk (CRP Clerks) Examination",
    short_name:      "IBPS Clerk",
    category:        "Banking",
    conducting_body: "Institute of Banking Personnel Selection",
    official_url:    "https://www.ibps.in",
    career_url:      "https://www.ibps.in",
    description:     "Clerical cadre recruitment for 12 public sector banks. Computer-based tests in two phases.",
    min_age: 20, max_age: 28,
    education: "Graduate in any discipline",
    medium: ["English", "Hindi"],
    stages: [
      { name: "Prelims", type: "written_objective", duration: "1 hour" },
      { name: "Mains",   type: "written_objective", duration: "2.75 hours" },
    ],
    subjects: [
      { name: "English Language",       weight_pct: 25, difficulty: 2 },
      { name: "Numerical Ability",      weight_pct: 25, difficulty: 2 },
      { name: "Reasoning Ability",      weight_pct: 25, difficulty: 2 },
      { name: "General / Financial Awareness", weight_pct: 15, difficulty: 2 },
      { name: "Computer Knowledge",     weight_pct: 10, difficulty: 1 },
    ],
    cycles: [
      {
        year: 2024, notification: "2024-07-01", apply_start: "2024-07-01", apply_end: "2024-07-21",
        vacancies_total: 6128, competition_ratio: 950,
        cutoffs: [
          { category: "General", score: 89.25, vacancy: 2806 },
          { category: "OBC",     score: 85.50, vacancy: 1644 },
          { category: "SC",      score: 77.25, vacancy: 919  },
          { category: "ST",      score: 71.00, vacancy: 459  },
        ],
      },
    ],
    avg_cutoff_general: 89,
    avg_competition_ratio: 950,
  },

]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getExamById(id: string): ExamEntry | undefined {
  return EXAM_REGISTRY.find((e) => e.id === id)
}

export function getExamsByCategory(category: ExamCategory): ExamEntry[] {
  return EXAM_REGISTRY.filter((e) => e.category === category)
}

export function getExamsByIds(ids: string[]): ExamEntry[] {
  return EXAM_REGISTRY.filter((e) => ids.includes(e.id))
}

export function searchExams(query: string): ExamEntry[] {
  const q = query.toLowerCase()
  return EXAM_REGISTRY.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.short_name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
  )
}

// All unique exam short names — used in login page strip, dropdowns
export const ALL_EXAM_NAMES = EXAM_REGISTRY.map((e) => e.short_name)

// Used for the login page rotating strip — more than what was there before
export const EXAM_STRIP_NAMES = [
  "UPSC CSE", "RBI Grade B", "SEBI Grade A", "IBPS PO", "SBI PO",
  "SSC CGL", "SSC CHSL", "NABARD Grade A", "IRDAI AO", "NDA",
  "RRB NTPC", "RRB Group D", "IBPS Clerk", "SBI Clerk",
  "CDS", "CAPF AC", "AFCAT", "State PSC", "MPSC", "UPPSC",
  "BPSC", "KPSC", "TNPSC", "SSC CPO", "SSC JE", "FCI AG-III",
  "ESIC SSO", "LIC AAO", "LIC ADO", "GIC Scale I",
]