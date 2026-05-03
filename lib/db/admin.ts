import { createClient } from "@/utils/supabase/server"
import type { Json } from "@/types/supabase"

// ─── Role types ───────────────────────────────────────────────────────────────

export type AdminRole =
  | "super_admin"
  | "ops_admin"
  | "content_admin"
  | "scraper_admin"
  | "support_admin"

/** Permissions per role. '*' means unrestricted. */
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin:   ["*"],
  ops_admin:     ["scrape", "sources", "queue", "recruitments", "organizations", "audit", "community"],
  content_admin: ["recruitments", "organizations", "posts", "community"],
  scraper_admin: ["scrape", "sources", "queue"],
  support_admin: ["users", "notifications", "community"],
}

// ─── Guards ───────────────────────────────────────────────────────────────────

export interface AdminContext {
  userId:     string
  userEmail:  string | undefined
  role:       AdminRole | null
  isLegacyAdmin: boolean  // is_admin = true (pre-migration)
}

/**
 * requireAdmin — backward-compatible guard.
 * Accepts any admin: is_admin=true OR any admin_role assigned.
 * Returns userId. Throws UNAUTHENTICATED or UNAUTHORIZED.
 */
export async function requireAdmin(): Promise<string> {
  const ctx = await getAdminContext()
  return ctx.userId
}

/**
 * requireAdminRole — granular guard.
 * Pass a permission string to enforce least-privilege.
 * Example: requireAdminRole("scrape") blocks content_admin and support_admin.
 */
export async function requireAdminRole(permission?: string): Promise<AdminContext> {
  const ctx = await getAdminContext()

  if (permission && !ctx.isLegacyAdmin && ctx.role !== null) {
    const allowed = ROLE_PERMISSIONS[ctx.role] ?? []
    if (!allowed.includes("*") && !allowed.includes(permission)) {
      throw new Error(`FORBIDDEN: role '${ctx.role}' cannot perform '${permission}'`)
    }
  }

  return ctx
}

/** Internal: fetch profile and build AdminContext. Throws if not admin. */
async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("UNAUTHENTICATED")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, admin_role")
    .eq("id", user.id)
    .single()

  const isLegacyAdmin = profile?.is_admin === true
  const role = (profile?.admin_role ?? null) as AdminRole | null

  if (!isLegacyAdmin && role === null) throw new Error("UNAUTHORIZED")

  return {
    userId:        user.id,
    userEmail:     user.email,
    role,
    isLegacyAdmin,
  }
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditParams {
  actorId:    string
  actorEmail?: string
  action:     string       // e.g. 'approve_scrape_item'
  entityType: string       // e.g. 'scrape_queue'
  entityId?:  string
  oldValue?:  unknown
  newValue?:  unknown
  notes?:     string
}

/**
 * logAdminAction — non-throwing audit log write.
 * NEVER throws: audit failures must never break the primary operation.
 */
export async function logAdminAction(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from("admin_audit_logs").insert({
      actor_id:    params.actorId,
      actor_email: params.actorEmail ?? null,
      action:      params.action,
      entity_type: params.entityType,
      entity_id:   params.entityId ?? null,
      old_value:   (params.oldValue != null
        ? (typeof params.oldValue === "object"
            ? params.oldValue
            : { value: params.oldValue })
        : null) as never,
      new_value:   (params.newValue != null
        ? (typeof params.newValue === "object"
            ? params.newValue
            : { value: params.newValue })
        : null) as never,
      notes:       params.notes ?? null,
    })
  } catch {
    // Intentionally swallowed — audit log failure is non-fatal
  }
}

/**
 * getAdminAuditLog — recent audit entries for admin overview.
 * Returns at most `limit` rows, newest first.
 */
export async function getAdminAuditLog(limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("admin_audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function getAllOrganizations() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("name")
  return data ?? []
}

export async function createOrganization(input: {
  name: string
  type: string
  state?: string | null
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateOrganization(id: string, input: {
  name?: string
  type?: string
  state?: string | null
  official_domain?: string | null
  website_url?: string | null
  trust_tier?: string
  is_verified?: boolean
  verification_notes?: string | null
  verified_at?: string | null
  verified_by?: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("organizations")
    .update(input)
    .eq("id", id)
  if (error) throw new Error(error.message)
}

// ─── Recruitments ─────────────────────────────────────────────────────────────

export async function getAllRecruitmentsAdmin() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("recruitments")
    .select(`
      *,
      organizations ( name, type ),
      posts ( id, post_name, group_type )
    `)
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getRecruitmentsAdminPaginated(page = 1, pageSize = 30) {
  const supabase = await createClient()
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from("recruitments")
    .select(`
      *,
      organizations ( name, type ),
      posts ( id, post_name, group_type )
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) throw new Error(`getRecruitmentsAdminPaginated: ${error.message}`)
  const total = count ?? 0
  return {
    rows:       data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getRecruitmentById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("recruitments")
    .select(`
      *,
      organizations ( id, name, type ),
      exam_stages ( id, stage_name, stage_order ),
      posts (
        id, post_name, group_type, pay_level, job_type,
        education_criteria ( * ),
        age_criteria ( * ),
        attempt_limits ( * ),
        vacancies ( * ),
        salary_details ( * ),
        training_details ( * )
      )
    `)
    .eq("id", id)
    .single()
  return data
}

export async function createRecruitment(input: {
  organization_id: string
  name: string
  year: number
  notification_date?: string | null
  apply_start_date?: string | null
  apply_end_date?: string | null
  status?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recruitments")
    .insert({ ...input, status: input.status ?? "upcoming" })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateRecruitment(id: string, input: Partial<{
  name: string
  year: number
  notification_date: string | null
  apply_start_date: string | null
  apply_end_date: string | null
  status: string
}>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("recruitments")
    .update(input)
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteRecruitment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("recruitments")
    .delete()
    .eq("id", id)
  if (error) throw new Error(error.message)
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(input: {
  recruitment_id: string
  post_name: string
  group_type?: string | null
  pay_level?: string | null
  job_type?: string | null
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("posts")
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updatePost(id: string, input: Partial<{
  post_name: string
  group_type: string | null
  pay_level: string | null
  job_type: string | null
}>) {
  const supabase = await createClient()
  const { error } = await supabase.from("posts").update(input).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deletePost(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("posts").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ─── Education criteria ───────────────────────────────────────────────────────

export async function upsertEducationCriteria(postId: string, input: {
  min_qualification_level?: string | null
  min_percentage?: number | null
  allowed_disciplines?: Json | null }) {
  const supabase = await createClient()

  // Delete existing then re-insert (simpler than true upsert here)
  await supabase.from("education_criteria").delete().eq("post_id", postId)

  const { error } = await supabase.from("education_criteria").insert({
    post_id: postId,
    ...input,
  })
  if (error) throw new Error(error.message)
}

// ─── Age criteria ─────────────────────────────────────────────────────────────

export async function upsertAgeCriteria(postId: string, input: {
  min_age?: number | null
  max_age?: number | null
  cutoff_date?: string | null
}) {
  const supabase = await createClient()
  await supabase.from("age_criteria").delete().eq("post_id", postId)
  const { error } = await supabase.from("age_criteria").insert({ post_id: postId, ...input })
  if (error) throw new Error(error.message)
}

// ─── Attempt limits ───────────────────────────────────────────────────────────

export async function replaceAttemptLimits(postId: string, limits: Array<{
  category: string | null
  max_attempts: number
}>) {
  const supabase = await createClient()
  await supabase.from("attempt_limits").delete().eq("post_id", postId)
  if (limits.length > 0) {
    const { error } = await supabase.from("attempt_limits").insert(
      limits.map((l) => ({ post_id: postId, ...l }))
    )
    if (error) throw new Error(error.message)
  }
}

// ─── Vacancies ────────────────────────────────────────────────────────────────

export async function replaceVacancies(postId: string, vacancies: Array<{
  category: string | null
  vacancy_count: number
  state?: string | null
}>) {
  const supabase = await createClient()
  await supabase.from("vacancies").delete().eq("post_id", postId)
  if (vacancies.length > 0) {
    const { error } = await supabase.from("vacancies").insert(
      vacancies.map((v) => ({ post_id: postId, ...v }))
    )
    if (error) throw new Error(error.message)
  }
}

// ─── Salary details ───────────────────────────────────────────────────────────

export async function upsertSalaryDetails(postId: string, input: {
  pay_level?: string | null
  basic_pay_min?: number | null
  basic_pay_max?: number | null
  grade_pay?: number | null
  allowances?: string | null
  in_hand_estimate?: string | null
}) {
  const supabase = await createClient()
  await supabase.from("salary_details").delete().eq("post_id", postId)
  const { error } = await supabase.from("salary_details").insert({ post_id: postId, ...input })
  if (error) throw new Error(error.message)
}

// ─── Exam stages ──────────────────────────────────────────────────────────────

export async function replaceExamStages(recruitmentId: string, stages: Array<{
  stage_name: string
  stage_order: number
}>) {
  const supabase = await createClient()
  await supabase.from("exam_stages").delete().eq("recruitment_id", recruitmentId)
  if (stages.length > 0) {
    const { error } = await supabase.from("exam_stages").insert(
      stages.map((s) => ({ recruitment_id: recruitmentId, ...s }))
    )
    if (error) throw new Error(error.message)
  }
}

// ─── Stats for admin dashboard ────────────────────────────────────────────────

export async function getAdminStats() {
  const supabase = await createClient()

  const [orgsRes, recRes, postsRes, usersRes, eligRes] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("recruitments").select("id, status", { count: "exact" }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("eligibility_results")
      .select("is_eligible", { count: "exact" })
      .eq("is_eligible", true),
  ])

  const openCount = recRes.data?.filter((r) => r.status === "open").length ?? 0
  const upcomingCount = recRes.data?.filter((r) => r.status === "upcoming").length ?? 0

  return {
    organizations: orgsRes.count ?? 0,
    recruitments: recRes.count ?? 0,
    openRecruitments: openCount,
    upcomingRecruitments: upcomingCount,
    posts: postsRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    eligibleMatches: eligRes.count ?? 0,
  }
}