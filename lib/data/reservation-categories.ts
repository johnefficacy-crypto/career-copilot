/**
 * lib/data/reservation-categories.ts
 *
 * State-wise and central reservation category definitions.
 * Based on actual government notifications, constitutional provisions,
 * and state government reservation orders.
 *
 * Used by: onboarding/identity page, eligibility engine
 */

export type ReservationCategory = {
  value:       string
  label:       string
  description: string
  age_relaxation_years?: number   // additional years over general
}

export type PwbdType = {
  value:       string
  label:       string
  description: string
}

// ─── Central Government Reservations ──────────────────────────────────────────
// Source: Ministry of Personnel, DoPT OM & Constitutional articles

export const CENTRAL_RESERVATION_CATEGORIES: ReservationCategory[] = [
  { value: "general",      label: "General (UR)",    description: "Unreserved — no reservation benefit", age_relaxation_years: 0 },
  { value: "obc_ncl",      label: "OBC-NCL",         description: "Other Backward Classes (Non-Creamy Layer) — income below ₹8 lakh per annum", age_relaxation_years: 3 },
  { value: "sc",            label: "SC",              description: "Scheduled Caste as per Constitution (SC/ST Orders)", age_relaxation_years: 5 },
  { value: "st",            label: "ST",              description: "Scheduled Tribe as per Constitution (SC/ST Orders)", age_relaxation_years: 5 },
  { value: "ews",           label: "EWS",             description: "Economically Weaker Sections — family income below ₹8 lakh, no government job, land holding criteria apply", age_relaxation_years: 0 },
  { value: "ex_serviceman", label: "Ex-Serviceman",   description: "Discharged/retired Defence Services personnel. Age: actual age minus service rendered minus 3 years", age_relaxation_years: 0 },
  { value: "pwd_obc",       label: "OBC + PwBD",      description: "OBC + Person with Benchmark Disability", age_relaxation_years: 13 },
  { value: "pwd_sc_st",     label: "SC/ST + PwBD",    description: "SC or ST + Person with Benchmark Disability", age_relaxation_years: 15 },
  { value: "pwd_general",   label: "General + PwBD",  description: "Unreserved + Person with Benchmark Disability", age_relaxation_years: 10 },
]

// ─── State-wise reservation categories ────────────────────────────────────────

type StateReservation = {
  state:          string
  categories:     ReservationCategory[]
  source_note:    string   // which notification/act this is based on
}

export const STATE_RESERVATIONS: StateReservation[] = [

  // MAHARASHTRA — Source: Maharashtra Government Resolution (GR) on reservations
  {
    state: "Maharashtra",
    source_note: "Maharashtra State Reservation Act & GRs. Includes Maratha (SEBC) per latest court orders.",
    categories: [
      { value: "general",     label: "Open (General)",      description: "Open category — no reservation" },
      { value: "obc",         label: "OBC",                 description: "OBC as per Maharashtra state list — 19% reservation", age_relaxation_years: 3 },
      { value: "sc",          label: "SC (Scheduled Caste)", description: "Scheduled Caste — 13% reservation", age_relaxation_years: 5 },
      { value: "st",          label: "ST (Scheduled Tribe)", description: "Scheduled Tribe — 7% reservation", age_relaxation_years: 5 },
      { value: "vjnt",        label: "VJ/NT (Vimukta Jati & Nomadic Tribes)", description: "VJ-A (Vimukta Jati) 3%, NT-B 2.5%, NT-C 3.5%, NT-D 2% — Maharashtra specific", age_relaxation_years: 3 },
      { value: "sbc",         label: "SBC (Special Backward Class)", description: "SBC — 2% reservation for specific communities not covered under OBC", age_relaxation_years: 3 },
      { value: "ews",         label: "EWS",                 description: "Economically Weaker Sections — 10% reservation", age_relaxation_years: 0 },
      { value: "sebc",        label: "SEBC (Maratha)",      description: "Socially and Educationally Backward Class — subject to ongoing litigation", age_relaxation_years: 3 },
    ],
  },

  // UTTAR PRADESH
  {
    state: "Uttar Pradesh",
    source_note: "UP Government Reservation Rules under UP Public Services (Reservation for SC/ST and Other Backward Classes) Act 1994",
    categories: [
      { value: "general",     label: "General (UR)",         description: "Unreserved" },
      { value: "obc",         label: "OBC",                  description: "Other Backward Classes — 27% state reservation", age_relaxation_years: 3 },
      { value: "sc",          label: "SC",                   description: "Scheduled Caste — 21% state reservation", age_relaxation_years: 5 },
      { value: "st",          label: "ST",                   description: "Scheduled Tribe — 2% state reservation", age_relaxation_years: 5 },
      { value: "ews",         label: "EWS",                  description: "Economically Weaker Sections — 10%", age_relaxation_years: 0 },
      { value: "dependant_ff",label: "Dependent of Freedom Fighter", description: "Son/daughter/grandson of freedom fighter", age_relaxation_years: 5 },
    ],
  },

  // RAJASTHAN
  {
    state: "Rajasthan",
    source_note: "Rajasthan State & Subordinate Services (Direct Recruitment) Rules & Rajasthan Reservation Act",
    categories: [
      { value: "general",  label: "General (UR)",         description: "Unreserved" },
      { value: "obc",      label: "OBC",                  description: "OBC (Non-Creamy Layer) — 21% reservation", age_relaxation_years: 3 },
      { value: "sc",       label: "SC",                   description: "Scheduled Caste — 16% reservation", age_relaxation_years: 5 },
      { value: "st",       label: "ST",                   description: "Scheduled Tribe — 12% reservation", age_relaxation_years: 5 },
      { value: "ews",      label: "EWS",                  description: "Economically Weaker Sections — 10%", age_relaxation_years: 0 },
      { value: "mbc",      label: "MBC (Most Backward Classes)", description: "Most Backward Classes — 5% reservation (Rajasthan specific)", age_relaxation_years: 3 },
      { value: "sbc",      label: "SBC (Special Backward Classes)", description: "Includes Gujjar, Banjara — 1% reservation subject to court orders", age_relaxation_years: 3 },
    ],
  },

  // GUJARAT
  {
    state: "Gujarat",
    source_note: "Gujarat Government reservation orders and SEBC Act",
    categories: [
      { value: "general",  label: "General (UR)",     description: "Unreserved" },
      { value: "sebc",     label: "SEBC (OBC)",       description: "Socially and Educationally Backward Classes — 27% reservation in Gujarat", age_relaxation_years: 3 },
      { value: "sc",       label: "SC",               description: "Scheduled Caste — 7% reservation", age_relaxation_years: 5 },
      { value: "st",       label: "ST",               description: "Scheduled Tribe — 15% reservation", age_relaxation_years: 5 },
      { value: "ews",      label: "EWS",              description: "Economically Weaker Sections — 10%", age_relaxation_years: 0 },
    ],
  },

  // KARNATAKA
  {
    state: "Karnataka",
    source_note: "Karnataka State Civil Services (General Recruitment) Rules & Karnataka Reservation Act",
    categories: [
      { value: "general",   label: "General (2A & above)", description: "Unreserved (also includes some Category-I OBC)" },
      { value: "cat_2a",    label: "Category 2A (OBC)",    description: "Intermediate Castes — 15% reservation", age_relaxation_years: 3 },
      { value: "cat_2b",    label: "Category 2B (OBC)",    description: "Muslims (OBC) — 4% reservation", age_relaxation_years: 3 },
      { value: "cat_3a",    label: "Category 3A (OBC)",    description: "Backward Castes (Right Hand) — 4% reservation", age_relaxation_years: 3 },
      { value: "cat_3b",    label: "Category 3B (OBC)",    description: "Backward Castes (Left Hand) — 5% reservation", age_relaxation_years: 3 },
      { value: "cat_1",     label: "Category 1 (SC/ST equivalent)", description: "Scheduled Tribes & Related groups — 3%", age_relaxation_years: 5 },
      { value: "sc",        label: "SC",                   description: "Scheduled Caste — 15% reservation", age_relaxation_years: 5 },
      { value: "st",        label: "ST",                   description: "Scheduled Tribe — 3% reservation", age_relaxation_years: 5 },
      { value: "ews",       label: "EWS",                  description: "Economically Weaker Sections — 10%", age_relaxation_years: 0 },
    ],
  },

  // TAMIL NADU
  {
    state: "Tamil Nadu",
    source_note: "Tamil Nadu Backward Classes, Scheduled Castes and Scheduled Tribes (Reservation of Seats in Educational Institutions and of Appointments or Posts in Services) Act",
    categories: [
      { value: "general",   label: "OC (Open Competition)", description: "Open category" },
      { value: "bc",        label: "BC (Backward Class)",   description: "Backward Classes — 26.5% reservation in TN", age_relaxation_years: 3 },
      { value: "mbc_dnc",   label: "MBC/DNC",               description: "Most Backward Classes & Denotified Communities — 20% reservation", age_relaxation_years: 3 },
      { value: "sc",        label: "SC",                    description: "Scheduled Caste (including Arunthathiyars) — 18% (3% sub-quota for Arunthathiyars)", age_relaxation_years: 5 },
      { value: "st",        label: "ST",                    description: "Scheduled Tribe — 1% reservation", age_relaxation_years: 5 },
      { value: "bcm",       label: "BCM (Backward Class Muslims)", description: "Backward Class Muslims — 3.5% reservation", age_relaxation_years: 3 },
      { value: "ews",       label: "EWS",                   description: "Economically Weaker Sections — 10%", age_relaxation_years: 0 },
    ],
  },
]

// ─── PwBD Categories — based on RPwD Act 2016 and actual exam notifications ───
// Source: Rights of Persons with Disabilities Act 2016 + DOPT guidelines

export const PWBD_CATEGORIES: PwbdType[] = [
  {
    value:       "none",
    label:       "Not applicable",
    description: "No disability",
  },
  {
    value:       "vi_blind",
    label:       "Visual — Blind (VB)",
    description: "Blindness — total absence of sight or visual acuity not exceeding 3/60 or visual field not more than 10 degrees",
  },
  {
    value:       "vi_lv",
    label:       "Visual — Low Vision (LV)",
    description: "Visual acuity not exceeding 6/18 with best correction. Partially sighted.",
  },
  {
    value:       "hh",
    label:       "Hearing — Deaf / Hard of Hearing (HH)",
    description: "Hearing impairment of 60 dB or more in better ear in conversational range",
  },
  {
    value:       "ld",
    label:       "Locomotor Disability (LD)",
    description: "Disability of bones, joints, muscles or nerve causing substantial restriction of movement. Includes affected Upper Limb (OA), Lower Limb (OL), Both Legs & Arms (BL/BA).",
  },
  {
    value:       "cp",
    label:       "Cerebral Palsy (CP)",
    description: "A group of non-progressive neurological conditions affecting movement and motor skills",
  },
  {
    value:       "id",
    label:       "Intellectual Disability (ID)",
    description: "Significant limitation in intellectual functioning and adaptive behaviour as expressed in conceptual, social and practical skills",
  },
  {
    value:       "autism",
    label:       "Autism Spectrum Disorder (ASD)",
    description: "A neuro-developmental condition including social, communication and restricted/repetitive behaviour challenges",
  },
  {
    value:       "md",
    label:       "Multiple Disabilities (MD)",
    description: "Two or more disabilities specified under RPwD Act 2016",
  },
  {
    value:       "dwarfism",
    label:       "Dwarfism",
    description: "Disorder of skeletal development — height of 4 feet 10 inches or less",
  },
  {
    value:       "acid_attack",
    label:       "Acid Attack Survivor",
    description: "Person disfigured due to acid attack under Section 326A of IPC",
  },
  {
    value:       "sld",
    label:       "Specific Learning Disabilities (SLD)",
    description: "Includes dyslexia, dysgraphia, dyscalculia — affects reading, writing, arithmetic",
  },
  {
    value:       "mi",
    label:       "Mental Illness (MI)",
    description: "Substantial disorder of thinking, mood, perception, orientation or memory that grossly impairs judgement",
  },
  {
    value:       "chronic_neuro",
    label:       "Chronic Neurological Conditions",
    description: "Parkinson's Disease, Multiple Sclerosis and other conditions recognised under RPwD Act 2016",
  },
  {
    value:       "blood_disorder",
    label:       "Blood Disorders",
    description: "Haemophilia, Thalassemia, Sickle Cell Disease as recognised under RPwD Act 2016",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns reservation categories for a given state + target type.
 * Falls back to central categories if state is not mapped or if targeting central exams.
 */
export function getReservationCategories(
  state: string | null | undefined,
  targetType: string | null | undefined
): ReservationCategory[] {
  // Central exams always use central categories
  if (!targetType || targetType === "central_govt" || targetType === "banking" || targetType === "regulatory") {
    return CENTRAL_RESERVATION_CATEGORIES
  }

  const stateData = STATE_RESERVATIONS.find(
    (s) => s.state.toLowerCase() === (state ?? "").toLowerCase()
  )

  return stateData?.categories ?? CENTRAL_RESERVATION_CATEGORIES
}

export function getStateReservationNote(state: string | null | undefined): string | null {
  const stateData = STATE_RESERVATIONS.find(
    (s) => s.state.toLowerCase() === (state ?? "").toLowerCase()
  )
  return stateData?.source_note ?? null
}