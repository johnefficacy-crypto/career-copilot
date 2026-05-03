import { describe, expect, it } from "vitest"
import { computeFormStatus } from "@/lib/exams/form-status"

describe("computeFormStatus", () => {
  it("returns filled when filledAt is set", () => {
    expect(computeFormStatus({ filledAt: "2026-04-01T00:00:00Z" })).toBe("filled")
  })

  it("returns declined when declinedAt is set and filledAt is null", () => {
    expect(computeFormStatus({ declinedAt: "2026-04-01T00:00:00Z" })).toBe("declined")
  })

  it("prefers filled over declined when both are set", () => {
    expect(
      computeFormStatus({
        filledAt:   "2026-04-01T00:00:00Z",
        declinedAt: "2026-03-01T00:00:00Z",
      })
    ).toBe("filled")
  })

  it("returns not_shown when no dates are set", () => {
    expect(computeFormStatus({})).toBe("not_shown")
  })

  it("returns not_shown when only firstShownAt is set", () => {
    expect(computeFormStatus({ firstShownAt: "2026-04-01T00:00:00Z" })).toBe("not_shown")
  })
})
