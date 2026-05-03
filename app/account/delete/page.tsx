import { redirect }     from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { deleteAccount } from "@/actions/account"

export const metadata = { title: "Delete account — Career Copilot" }

export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const displayName = profile?.full_name ?? user.email ?? "your account"

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)", padding: "2rem" }}>
      <div className="cc-card" style={{ maxWidth: 500, width: "100%", padding: "2.5rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}>⚠️</div>

        <h1 style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.5rem", textAlign: "center" }}>
          Delete account
        </h1>

        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem", textAlign: "center" }}>
          You are about to permanently delete <strong>{displayName}</strong>.
        </p>

        <div className="cc-alert-warning" style={{ fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
          <strong>This action is irreversible.</strong> The following data will be permanently erased:
          <ul style={{ marginTop: "0.5rem", marginLeft: "1.25rem", lineHeight: 1.7 }}>
            <li>Your profile and personal details</li>
            <li>Education history and eligibility results</li>
            <li>Notification preferences and alert history</li>
            <li>Tracked recruitments and watchlists</li>
          </ul>
        </div>

        <p style={{ color: "var(--text-ghost)", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
          Your subscription billing records are retained for 7 years as required by GST regulations,
          but your personal data is removed immediately. This satisfies your right to erasure
          under the Digital Personal Data Protection Act 2023.
        </p>

        <form action={deleteAccount}>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <a href="/dashboard" className="cc-btn-ghost">
              Cancel
            </a>
            <button type="submit" className="cc-btn-danger" style={{ width: "auto" }}>
              Delete my account permanently
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
