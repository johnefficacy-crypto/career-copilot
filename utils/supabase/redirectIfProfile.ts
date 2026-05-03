import { redirect } from "next/navigation"
import { getProfile } from "./getProfile"

export async function redirectIfProfile() {
  const profile = await getProfile()

  if (profile) {
    redirect("/dashboard")
  }
}