/**
 * proxy.ts — Next.js 16 edge proxy (previously middleware.ts)
 *
 * CRITICAL: The exported function MUST be named `proxy` (or default export).
 * Next.js 16 renamed both the file (middleware.ts → proxy.ts) AND the
 * required export name (middleware → proxy). Exporting `middleware` silently
 * fails with: "must export a function, either as a default or named 'proxy' export"
 *
 * ─── Three rules ──────────────────────────────────────────────────────────────
 * Rule 1: No valid session           → redirect /auth/login?redirect={pathname}
 * Rule 2: Session + onboarding=false → redirect /onboarding
 * Rule 3: Session + onboarding done  → allow through
 *
 * ─── Public routes (no auth check, no DB call) ────────────────────────────────
 *   /               Landing page
 *   /auth/*         Login, signup, callback, forgot-password
 *   /api/auth/*     Google OAuth initiation + callback
 *   /api/webhooks/* Razorpay webhook — must never be blocked
 *   /api/chat       Streaming chat — auth handled inside route handler
 *   /pricing        Public pricing page
 *   /marketplace/*  Public course catalogue (unauthenticated browse)
 *   /forum/*        Semi-public (reads open, writes guarded in actions)
 *
 * ─── Phase 3D fix ────────────────────────────────────────────────────────────
 * Removed the profiles.onboarding_completed DB call from the proxy.
 * Previously every request made 2 Supabase round-trips (getUser + profiles SELECT).
 * Now only getUser() runs here — JWT refresh is the only reason we need it.
 * Onboarding redirect is handled in app/dashboard/layout.tsx (runs once on
 * dashboard load, not on every static asset or API request).
 *
 * Matcher excludes _next/static, _next/image, and static file extensions so
 * the proxy never runs on JS bundles, CSS, fonts, or images.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse }        from "next/server"
import type { NextRequest }    from "next/server"

// ─── Route classification ─────────────────────────────────────────────────────

const PUBLIC_PREFIXES = [
  "/auth/",
  "/api/auth/",
  "/api/webhooks/",
  "/api/chat",
  "/pricing",
  "/marketplace",
  "/forum",
]

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

// ─── Named proxy export — required by Next.js 16 ─────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast path — public routes skip all Supabase calls
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Build Supabase Edge-compatible client
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to both request and response so refreshed JWTs propagate
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() also refreshes near-expiry JWT — must run before any redirect.
  // This is the ONLY Supabase call in the proxy now (Phase 3D: removed
  // the profiles.onboarding_completed DB lookup that was causing 15-48s dev latency).
  const { data: { user } } = await supabase.auth.getUser()

  // Rule 1: No session → redirect to login with return path
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Rule 2 (onboarding redirect) is now handled in app/dashboard/layout.tsx.
  // The proxy no longer makes a DB call to check onboarding_completed —
  // that was the source of the 15–48s per-request latency in dev.
  // Allow all authenticated requests through from here.
  return response
}

// ─── Matcher — excludes static files for performance ─────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff|woff2|ttf|eot)$).*)",
  ],
}