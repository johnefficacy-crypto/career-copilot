import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export const metadata = { title: "Forgot password — Career Copilot" }

async function sendResetEmail(formData: FormData) {
  "use server"
  const email = (formData.get("email") as string).trim()
  if (!email) redirect("/auth/forgot-password?error=Please+enter+your+email")

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  })

  // Always show success message — never reveal whether email exists
  if (error) {
    console.error("[sendResetEmail]", error.message)
  }

  redirect("/auth/forgot-password?sent=1")
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg-root)" }}
    >
      <div style={{ width: "100%", maxWidth: "24rem" }} className="animate-fadeUp">

        {/* Logo */}
        <Link href="/" className="cc-logo block mb-10 text-center">
          Career Copilot
        </Link>

        {params.sent ? (
          /* ── Sent confirmation ─────────────────────────────────────── */
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-5"
              style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}
            >
              ✉
            </div>
            <h1 className="cc-auth-title text-center mb-2">Check your inbox</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              If an account exists for that email, a password reset link has been sent.
              The link expires in 60 minutes.
            </p>
            <p className="text-xs mb-6" style={{ color: "var(--text-dim)" }}>
              Didnt receive it? Check your spam folder, or try again.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/auth/login" className="cc-btn-primary">
                Back to sign in
              </Link>
              <form action={sendResetEmail}>
                <input type="hidden" name="email" value="" />
                <Link
                  href="/auth/forgot-password"
                  className="cc-btn-ghost block text-center"
                  style={{ width: "100%" }}
                >
                  Try again
                </Link>
              </form>
            </div>
          </div>
        ) : (
          /* ── Request form ──────────────────────────────────────────── */
          <>
            <h1 className="cc-auth-title">Forgot your password?</h1>
            <p className="cc-auth-subtitle">
              Enter your email and we will send you a reset link.
            </p>

            {params?.error && (
              <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
            )}

            <form action={sendResetEmail} className="cc-step-form">
              <div className="cc-field">
                <label htmlFor="email" className="cc-label">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="cc-input"
                />
              </div>

              <button type="submit" className="cc-btn-primary">
                Send reset link
              </button>
            </form>

            <p className="text-sm text-center mt-5" style={{ color: "var(--text-dim)" }}>
              Remembered it?{" "}
              <Link
                href="/auth/login"
                className="transition-colors"
                style={{ color: "var(--gold-dim)" }}
              >
                Sign in →
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}