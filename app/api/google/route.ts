/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth flow via Supabase Auth.
 * Redirects to Google's OAuth consent screen.
 * After consent, Google redirects to /auth/callback.
 *
 * Setup required in Supabase Dashboard:
 *   Authentication → Providers → Google → Enable
 *   Add Google Client ID and Secret from Google Cloud Console
 *   Add redirect URL: https://your-project.supabase.co/auth/v1/callback
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: NextRequest) {
  const supabase  = await createClient()
  const { searchParams } = new URL(request.url)
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      queryParams: {
        access_type: "offline",
        prompt:      "consent",
      },
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error?.message ?? "OAuth failed")}`, request.url)
    )
  }

  return NextResponse.redirect(data.url)
}