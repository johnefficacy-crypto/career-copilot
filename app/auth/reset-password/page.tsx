"use client"

/**
 * app/auth/reset-password/page.tsx
 *
 * Handles the password reset flow after the user clicks the email link.
 * Supabase sends the user to this page with a token in the URL fragment (#).
 * The client reads the fragment, exchanges the token for a session, then
 * lets the user set a new password.
 *
 * Fragment tokens (#access_token=...&type=recovery) are NOT sent to the
 * server, so this MUST be a client component.
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"

export default function ResetPasswordPage() {
  const [password,    setPassword]    = useState("")
  const [confirm,     setConfirm]     = useState("")
  const [status,      setStatus]      = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg,    setErrorMsg]    = useState("")
  const [tokenReady,  setTokenReady]  = useState(false)

  // On mount: Supabase client auto-exchanges the #access_token fragment
  // from the reset email URL into a valid session.
  useEffect(() => {
    const supabase = createClient()

    // Listen for the AUTH_TOKEN_REFRESHED / SIGNED_IN event that fires
    // when Supabase processes the recovery token from the URL fragment.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setTokenReady(true)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.")
      return
    }

    setStatus("loading")

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrorMsg(error.message)
      setStatus("error")
    } else {
      setStatus("success")
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg-root)" }}
    >
      <div style={{ width: "100%", maxWidth: "24rem" }} className="animate-fadeUp">
        <Link href="/" className="cc-logo block mb-10 text-center">
          Career Copilot
        </Link>

        {status === "success" ? (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-5"
              style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}
            >
              ✓
            </div>
            <h1 className="cc-auth-title text-center mb-2">Password updated</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Your password has been changed. You can now sign in with your new password.
            </p>
            <Link href="/auth/login" className="cc-btn-primary block text-center">
              Sign in →
            </Link>
          </div>
        ) : !tokenReady ? (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-xl animate-spin inline-block">⟳</span>
            </div>
            <h1 className="cc-auth-title text-center mb-2">Verifying reset link…</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              If this takes more than a few seconds, your link may have expired.
            </p>
            <Link href="/auth/forgot-password" className="cc-btn-link block text-center mt-4">
              Request a new link →
            </Link>
          </div>
        ) : (
          <>
            <h1 className="cc-auth-title">Set a new password</h1>
            <p className="cc-auth-subtitle">
              Choose a strong password for your Career Copilot account.
            </p>

            {errorMsg && (
              <div className="cc-alert-error">{errorMsg}</div>
            )}

            <form onSubmit={handleSubmit} className="cc-step-form">
              <div className="cc-field">
                <label className="cc-label">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="cc-input"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  className="cc-input"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                {/* Live match indicator */}
                {confirm.length > 0 && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: password === confirm ? "var(--success)" : "var(--danger)" }}
                  >
                    {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="cc-btn-primary"
              >
                {status === "loading" ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}