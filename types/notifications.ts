/**
 * types/notifications.ts
 * Career Copilot — Notification Engine v2
 *
 * Single source of truth for all notification/scraping domain types.
 * Import from here everywhere — never import raw Supabase row types directly.
 */

// ─── Alert & Event types ──────────────────────────────────────────────────────

export type AlertType =
  | "new_match"
  | "deadline_3day"
  | "deadline_1day"
  | "status_change"
  | "result_released"
  | "admit_card_released"
  | "corrigendum"

export type EventType =
  | "new_recruitment"
  | "application_open"
  | "deadline_approaching"
  | "deadline_changed"
  | "vacancy_changed"
  | "status_changed"
  | "admit_card_released"
  | "result_released"
  | "cutoff_released"
  | "corrigendum"
  | "recruitment_withdrawn"
  | "eligibility_unlocked"

export type AlertPriority = 1 | 2 | 3 | 4 | 5

export type DeliveryChannel = "in_app" | "email" | "whatsapp" | "telegram" | "sms"

// ─── Notification (in-app read model) ────────────────────────────────────────

export type NotificationAlert = {
  id:                  string
  user_id:             string
  alert_type:          AlertType
  is_read:             boolean
  sent_at:             string
  read_at:             string | null
  priority:            AlertPriority
  explanation:         AlertExplanation | null
  alert_event_id:      string | null
  event_type:          EventType | null
  recruitment_id:      string
  recruitment_name:    string
  recruitment_status:  string | null
  apply_end_date:      string | null
  apply_start_date:    string | null
  notification_date:   string | null
  year:                number
  total_vacancies:     number | null
  org_id:              string | null
  org_name:            string | null
  org_type:            string | null
  org_state:           string | null
  days_to_deadline:    number | null
  is_tracked:          boolean
}

export type AlertExplanation = {
  is_tracked:       boolean
  is_eligible:      boolean
  matched_exam:     boolean
  matched_sector:   boolean
  matched_type:     boolean
}


export type GroupedNotification = {
  recruitment_id: string
  recruitment_name: string
  org_name: string | null
  latest_sent_at: string
  latest_alert_type: AlertType
  latest_priority: AlertPriority
  latest_is_read: boolean
  unread_count: number
  total_events: number
  days_to_deadline: number | null
}

// ─── Alert Events ─────────────────────────────────────────────────────────────

export type AlertEvent = {
  id:                  string
  event_type:          EventType
  recruitment_id:      string
  diff_id:             string | null
  payload:             Record<string, unknown>
  priority:            AlertPriority
  fanout_status:       "pending" | "processing" | "completed" | "failed"
  users_notified:      number
  created_at:          string
}

// ─── Scraping types ───────────────────────────────────────────────────────────

export type AdapterType = "html" | "rss" | "json" | "pdf" | "playwright"
export type SourceTier = 1 | 2 | 3

export type ScrapeSource = {
  id:                    string
  name:                  string
  base_url:              string
  notification_path:     string | null
  org_type:              string
  state:                 string | null
  is_active:             boolean
  is_healthy:            boolean
  last_scraped_at:       string | null
  last_success_at:       string | null
  scrape_interval_hours: number
  tier:                  SourceTier
  trust_score:           number
  adapter_type:          AdapterType
  consecutive_fails:     number
  selector_config:       Record<string, unknown>
  metadata:              Record<string, unknown>
}

export type ScrapeRun = {
  id:               string
  started_at:       string
  finished_at:      string | null
  status:           "running" | "completed" | "partial" | "failed"
  sources_checked:  number
  items_found:      number
  items_new:        number
  items_duplicate:  number
  error_log:        RunError[]
  triggered_by:     "scheduled" | "admin" | "system"
}

export type RunError = {
  source:  string
  error:   string
  at:      string
}

export type ScrapeQueueItem = {
  id:               string
  source_url:       string
  source_name:      string
  extracted_data:   ExtractedRecruitment
  confidence_score: number
  status:           "pending" | "reviewing" | "approved" | "rejected" | "duplicate"
  scrape_run_id:    string | null
  duplicate_of:     string | null
  reviewer_id:      string | null
  reviewer_notes:   string | null
  scraped_at:       string
  reviewed_at:      string | null
}

export type ExtractedRecruitment = {
  title:                     string
  organization_name:         string
  org_type:                  string
  notification_date:         string | null
  apply_start_date:          string | null
  apply_end_date:            string | null
  total_vacancies:           number | null
  year:                      number
  official_notification_url: string
  source_pdf_url:            string | null
  posts:                     unknown[]
  confidence:                number
}

// ─── Source Observation ───────────────────────────────────────────────────────

export type SourceObservation = {
  id:               string
  scrape_run_id:    string | null
  source_id:        string | null
  source_url:       string
  raw_title:        string | null
  raw_org_name:     string | null
  fingerprint:      string | null
  confidence_score: number
  status:           "pending" | "matched" | "new" | "duplicate" | "low_confidence" | "error"
  canonical_id:     string | null
  observed_at:      string
}

// ─── User preferences ─────────────────────────────────────────────────────────

export type UserNotificationPrefs = {
  user_id:               string
  in_app_enabled:        boolean
  email_enabled:         boolean
  email_digest_frequency: "instant" | "daily" | "weekly" | "off"
  whatsapp_enabled:      boolean
  min_priority_in_app:   AlertPriority
  min_priority_email:    AlertPriority
  event_types_muted:     EventType[]
  org_types_muted:       string[]
}

// ─── Admin views ──────────────────────────────────────────────────────────────

export type QueueReviewItem = {
  id:                 string
  source_url:         string
  source_name:        string
  confidence_score:   number
  data_quality_score: number | null  // 0-100 completeness score
  status:             ScrapeQueueItem["status"]
  scraped_at:         string
  reviewed_at:        string | null
  reviewer_notes:     string | null
  title:              string | null
  org_name:           string | null
  apply_end_date:     string | null
  total_vacancies:    string | null
  fingerprint:        string | null
  obs_status:         string | null
  canonical_id:       string | null
  canonical_name:     string | null
  run_started_at:     string | null
  // ── Trust pipeline columns (migration 017 / 018) ──────────────────────────
  extraction_status:         string | null   // unverified|needs_review|verified|rejected|stale|duplicate
  evidence_required:         boolean
  notification_document_id:  string | null
  extraction_provider:       string | null   // rss_direct|llm|selector
  extraction_model:          string | null
  evidence_total_count:      number | null
  evidence_verified_count:   number | null
  evidence_rejected_count:   number | null
  evidence_missing_count:    number | null
}

/** A single field-level evidence row from extracted_field_evidence */
export type FieldEvidence = {
  id:              string
  queue_item_id:   string
  document_id:     string | null
  field_name:      string
  field_value:     string | null
  evidence_text:   string | null
  char_start:      number | null
  char_end:        number | null
  confidence:      number | null
  reviewer_status: "pending" | "verified" | "rejected" | "needs_clarification"
  provider:        string | null
  model_used:      string | null
  created_at:      string
}

export type ScraperStats = {
  lastRun:       ScrapeRun | null
  pendingReview: number
  approvedTotal: number
  failedSources: number
  healthySources: number
}

export type SourceHealthSnapshot = {
  source_id:         string
  name:              string
  tier:              SourceTier
  is_active:         boolean
  is_healthy:        boolean
  last_scraped_at:   string | null
  last_success_at:   string | null
  consecutive_fails: number
  avg_confidence:    number | null
  items_7d:          number
}