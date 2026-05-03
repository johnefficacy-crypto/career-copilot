import { describe, expect, it } from "vitest"
import { buildSubject, buildBody, type FeedRow } from "../index"

const baseRow: FeedRow = {
  id:               "1",
  user_id:          "u1",
  alert_type:       "new_match",
  priority:         4,
  recruitment_id:   "r1",
  recruitment_name: "Assistant Section Officer",
  org_name:         "State PSC",
  apply_end_date:   "2026-05-01",
  days_to_deadline: 3,
  email_sent:       null,
}

describe("buildSubject", () => {
  it("produces a deadline subject for deadline alerts", () => {
    const row: FeedRow = { ...baseRow, alert_type: "deadline" }
    expect(buildSubject(row)).toContain("Deadline approaching")
    expect(buildSubject(row)).toContain("Assistant Section Officer")
  })

  it("produces a generic subject for new_match alerts", () => {
    expect(buildSubject(baseRow)).toContain("Career Copilot update")
    expect(buildSubject(baseRow)).toContain("Assistant Section Officer")
  })

  it("falls back to 'Opportunity' when recruitment_name is null", () => {
    const row: FeedRow = { ...baseRow, recruitment_name: null }
    expect(buildSubject(row)).toContain("Opportunity")
  })
})

describe("buildBody", () => {
  it("includes org_name, recruitment_name, apply_end_date, and days_to_deadline", () => {
    const body = buildBody(baseRow)
    expect(body).toContain("State PSC")
    expect(body).toContain("Assistant Section Officer")
    expect(body).toContain("2026-05-01")
    expect(body).toContain("3 days remaining")
  })

  it("omits apply_end_date and days_to_deadline when null", () => {
    const row: FeedRow = { ...baseRow, apply_end_date: null, days_to_deadline: null }
    const body = buildBody(row)
    expect(body).toContain("State PSC")
    expect(body).not.toContain("Apply by")
    expect(body).not.toContain("days remaining")
  })

  it("falls back gracefully when org_name and recruitment_name are null", () => {
    const row: FeedRow = { ...baseRow, org_name: null, recruitment_name: null }
    const body = buildBody(row)
    expect(body).toContain("Career Copilot")
    expect(body).toContain("Opportunity update")
  })
})
