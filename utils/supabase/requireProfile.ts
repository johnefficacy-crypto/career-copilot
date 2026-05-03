import { redirect } from "next/navigation"
import { getCurrentUser } from "./getUser"
import { getProfile } from "./getProfile"

// FIX: redirect was pointing to "/login" — correct path in this project is "/auth/login".
// getCurrentUser and getProfile are now both fixed to use the canonical createClient().

export async function requireProfile() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")   // ← FIX: was "/login"
  }

  const profile = await getProfile()

  if (!profile) {
    redirect("/onboarding")
  }

  return profile
}