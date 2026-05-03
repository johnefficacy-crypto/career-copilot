"use server"

import { redirect }       from "next/navigation"
import { createClient }   from "@/utils/supabase/server"
import { ensureProfileRow } from "@/lib/db/profiles"

// ─── Sign up ──────────────────────────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const email     = (formData.get("email")     as string).trim()
  const password  = (formData.get("password")  as string)
  const full_name = (formData.get("full_name") as string | null)?.trim() ?? ""

  if (!email || !password) {
    redirect("/auth/signup?error=Email+and+password+are+required")
  }
  if (password.length < 8) {
    redirect("/auth/signup?error=Password+must+be+at+least+8+characters")
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) {
    const msg = error.message.includes("already registered")
      ? "An account with this email already exists. Try signing in."
      : error.message
    redirect(`/auth/signup?error=${encodeURIComponent(msg)}`)
  }

  redirect("/auth/login?message=Account+created!+Check+your+email+to+confirm+then+sign+in.")
}

// ─── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(formData: FormData) {
  const email    = (formData.get("email")    as string).trim()
  const password = (formData.get("password") as string)
  const redirectTo = (formData.get("redirect") as string | null) ?? "/dashboard"

  if (!email || !password) {
    redirect("/auth/login?error=Email+and+password+are+required")
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      redirect("/auth/login?error=Email+not+confirmed.+Check+your+inbox+for+the+confirmation+link.")
    }
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  const user = data.user

  // Ensure profile row exists — uses INSERT not upsert (see lib/db/profiles.ts)
  await ensureProfileRow(user.id)

  // Check onboarding state
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect("/onboarding")
  }

  // Sanitise redirect — only allow relative paths
  const safe = redirectTo.startsWith("/") ? redirectTo : "/dashboard"
  redirect(safe)
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}