import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { signIn } from "@/actions/auth"
import { EXAM_STRIP_NAMES } from "@/lib/data/exam-registry"
import { LoginPageClient } from "@/components/auth/LoginPageClient"

export const metadata = { title: "Sign in — Career Copilot" }

const TESTIMONIALS = [
  { name: "Priya Sharma",     role: "RBI Grade B 2024 (Selected)",  quote: "I was tracking 6 exams manually on a spreadsheet. Career Copilot collapsed it into one feed. The eligibility check alone saved me 3 pointless applications." },
  { name: "Arjun Mehta",      role: "SEBI Grade A aspirant",         quote: "The AI study plan accounted for my weak spots in Securities Law and gave me 3 extra weeks on it. First time I felt like I had a real coach." },
  { name: "Sneha Patel",      role: "SSC CGL 2023 (Qualified)",      quote: "Stopped using four apps and three Telegram channels. Everything I need is here. The deadline countdown saved me missing an apply window once already." },
  { name: "Rahul Verma",      role: "UPSC CSE Mains 2024",           quote: "The competition score widget showed me exactly where the cutoff sits and how many people are ahead. Stopped guessing, started planning backwards from the cutoff." },
  { name: "Aishwarya Nair",   role: "IBPS PO 2024 (Selected)",       quote: "The skill test pointed me to my weak spots in Quant and Reasoning before I wasted months on irrelevant material. Best feature on the platform." },
  { name: "Vikram Singh",     role: "Railways NTPC aspirant",        quote: "Official links to results and career pages directly — I wasted so much time on fake notification sites before. Now I only check here." },
  { name: "Meera Krishnan",   role: "NABARD Grade A 2023",           quote: "The forum replaced 7 Telegram groups. Every answer is searchable, permanent, and from real aspirants. Stack Overflow for govt exam prep." },
  { name: "Sameer Gupta",     role: "State PSC (Maharashtra) 2024",  quote: "The Maharashtra state reservation category breakdown was spot on. I didn't know about VJNT until I saw it in my eligibility results here." },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  const params = await searchParams

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex">

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        {/* Background glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "var(--gold)", opacity: 0.04, filter: "blur(100px)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />

        {/* Logo */}
        <div className="relative">
          <Link href="/" className="cc-logo">Career Copilot</Link>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            AI-Powered Government Exam Preparation
          </p>
        </div>

        {/* Exam strip — expanded */}
        <div className="relative">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-ghost)" }}>
            Tracking notifications for
          </p>
          <div className="flex flex-wrap gap-1.5 mb-8">
            {EXAM_STRIP_NAMES.slice(0, 20).map((name) => (
              <span
                key={name}
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ border: "1px solid var(--border)", color: "var(--text-dim)", background: "var(--bg-surface)" }}
              >
                {name}
              </span>
            ))}
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>+{EXAM_STRIP_NAMES.length - 20} more</span>
          </div>

          {/* Rotating testimonials — client component */}
          <LoginPageClient testimonials={TESTIMONIALS} />
        </div>

        <div className="relative">
          <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
            © {new Date().getFullYear()} Career Copilot
          </p>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-fadeUp">
        <div style={{ width: "100%", maxWidth: "24rem" }}>

          {/* Mobile logo */}
          <Link href="/" className="cc-logo lg:hidden block mb-10">Career Copilot</Link>

          <h1 className="cc-auth-title">Welcome back</h1>
          <p className="cc-auth-subtitle">Sign in to continue your exam preparation.</p>

          {params?.message && (
            <div className="cc-alert-success">{decodeURIComponent(params.message)}</div>
          )}
          {params?.error && (
            <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
          )}

          {/* Social login — Google */}
          <SocialLoginButtons redirectTo={params?.redirect} />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>or continue with email</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Email form */}
          <form action={signIn} className="cc-step-form">
            {params?.redirect && (
              <input type="hidden" name="redirect" value={params.redirect} />
            )}

            <div className="cc-field">
              <label htmlFor="email" className="cc-label">Email</label>
              <input id="email" name="email" type="email" required
                placeholder="you@example.com" className="cc-input" autoComplete="email" />
            </div>

            <div className="cc-field">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="cc-label">Password</label>
                <Link href="/auth/forgot-password"
                  className="text-xs transition-colors"
                  style={{ color: "var(--text-ghost)" }}>
                  Forgot?
                </Link>
              </div>
              <input id="password" name="password" type="password" required
                placeholder="••••••••" className="cc-input" autoComplete="current-password" />
            </div>

            <button type="submit" className="cc-btn-primary">Sign in</button>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: "var(--text-dim)" }}>
            New here?{" "}
            <Link href="/auth/signup"
              style={{ color: "var(--gold-dim)" }}
              className="hover:text-[var(--gold)] transition-colors">
              Create an account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Social login buttons (server-rendered, action wired client-side) ─────────

function SocialLoginButtons({ redirectTo }: { redirectTo?: string }) {
  const callbackUrl = redirectTo
    ? `/auth/callback?next=${encodeURIComponent(redirectTo)}`
    : "/auth/callback"

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`/api/auth/google?redirect=${encodeURIComponent(callbackUrl)}`}
        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-colors"
        style={{
          border: "1px solid var(--border-md)",
          color: "rgba(255,255,255,0.75)",
          background: "var(--bg-surface)",
          textDecoration: "none",
        }}
      >
        <GoogleIcon />
        Continue with Google
      </a>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}