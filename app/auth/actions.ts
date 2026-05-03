"use server"

// FIX: Canonical createClient() — no cookieStore argument anywhere.
// FIX: signUp and signIn are correctly separated exports.

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export async function signUp(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string
  const fullName = formData.get("full_name") as string | null

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? "" } },
  })

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/auth/login?message=Account+created!+Check+your+email+to+confirm+then+sign+in.")
}

export async function signIn(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect("/onboarding")
  }

  // Set cookie so proxy can do optimistic onboarding check without a DB query
  const cookieStore = await cookies()
  cookieStore.set("onboarding_completed", "true", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete("onboarding_completed")
  redirect("/auth/login")
}