export type FormStatus = "filled" | "declined" | "not_shown"

export function computeFormStatus(input: {
  filledAt?:    string | null
  declinedAt?:  string | null
  firstShownAt?: string | null
}): FormStatus {
  if (input.filledAt)   return "filled"
  if (input.declinedAt) return "declined"
  return "not_shown"
}
