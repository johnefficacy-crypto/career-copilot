// ==============================
// ENUMS
// ==============================

export type Gender = "MALE" | "FEMALE" | "OTHER"

export type Category =
  | "GENERAL"
  | "EWS"
  | "OBC"
  | "SC"
  | "ST"

export type EducationLevel =
  | "10TH"
  | "12TH"
  | "DIPLOMA"
  | "ITI"
  | "GRADUATION"
  | "POST_GRADUATION"
  | "PHD"
  | "PROFESSIONAL"
  | "CERTIFICATION"

export type EducationMode = "REGULAR" | "DISTANCE" | "ONLINE"


// ==============================
// PROFILE STEP TYPES (Onboarding)
// ==============================

export interface PersonalDetailsForm {
  dob: string
  gender: Gender
  category: Category
  pwbd: boolean
  domicile_state: string
}

export interface EducationEntry {
  level: EducationLevel
  qualification_type?: string
  specialization?: string
  board_university?: string
  mode?: EducationMode
  percentage?: number | null
  passing_year?: number | null
  is_final_year?: boolean
}

// ==============================
// DATABASE ROW TYPES
// ==============================

export interface EducationRow extends EducationEntry {
  user_id: string
}
// ==============================
// FORM HELPER TYPES
// ==============================

export interface DegreeForm {
  qualification: string
  specialization: string
  university: string
  percentage: number | null
  year: number | null
}
// ==============================
// CERTIFICATIONS
// ==============================

export interface CertificationEntry {
  user_id: string
  name: string
  organization?: string | null
  year?: number | null
}
// ==============================
// WORK EXPERIENCE
// ==============================

export type ExperienceSector =
  | "BANKING"
  | "FINANCE"
  | "GOVT"
  | "PRIVATE"
  | "OTHER"

export interface ExperienceEntry {
  user_id: string
  sector: ExperienceSector
  role: string
  organization: string
  start_date: string
  end_date: string | null
  years_experience: number
}

export interface ExperienceFormRow {
  sector: ExperienceSector
  role: string
  organization: string
  start_date: string
  end_date: string
}
// What client sends
export type ExperienceInsert = Omit<ExperienceEntry, "user_id">

// ==============================
// EXAM ATTEMPTS
// ==============================

export interface ExamAttemptEntry {
  user_id: string
  exam_name: string
  attempts_used: number
}

export type ExamAttemptInsert = Omit<ExamAttemptEntry, "user_id">

export interface ExamAttemptFormRow {
  exam_name: string
  attempts_used: number
}
// ==============================
// PREFERENCES STEP
// ==============================

export type JobType = "CENTRAL_GOVT" | "STATE_GOVT" | "PSU" | "REGULATORY" | "BANKING"

export type StudyMode = "SELF_STUDY" | "COACHING" | "WORKING_AND_PREPARING"

export interface PreferenceFormRow {
  exam_name: string
}

export interface AspirantPreferencesInsert {
  user_id: string
  job_types: JobType[]
  preferred_states: string[]
  study_mode: StudyMode
  study_hours_per_day: number | null
}