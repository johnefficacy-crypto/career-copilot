/**
 * GET /auth/callback
 *
 * Handles the redirect from Supabase OAuth (Google, etc.).
 * Exchanges the code for a session, then routes based on onboarding state.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get("code")
  const next      = searchParams.get("next") ?? "/dashboard"
  const error     = searchParams.get("error")
  const errorDesc = searchParams.get("error_description")

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(errorDesc ?? error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=Missing+OAuth+code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // Session is now set. Check onboarding state.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // Ensure profile row exists (Google login won't trigger signUp action)
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    // First OAuth login — create profile row with name from Google metadata
    const googleName = user.user_metadata?.full_name as string | undefined
    await supabase.from("profiles").insert({
      id:                   user.id,
      full_name:            googleName ?? null,
      onboarding_completed: false,
      onboarding_step:      0,
    })
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  if (!profile.onboarding_completed) {
    return NextResponse.redirect(`${origin}/onboarding`)
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

  // Sanitise next URL — only allow relative paths
  const safeNext = next.startsWith("/") ? next : "/dashboard"
  return NextResponse.redirect(`${origin}${safeNext}`)
}