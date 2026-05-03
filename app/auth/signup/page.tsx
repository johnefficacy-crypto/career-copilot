import Link from "next/link"
import { redirectIfUser } from "@/utils/supabase/redirectIfUser"
import { signUp } from "../actions"

export const metadata = { title: "Create account — Career Copilot" }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string }>
}) {
  await redirectIfUser()
  const params = await searchParams

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex">

      {/* ── Left panel ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-white/[0.06] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#e8d5a3] opacity-[0.04] blur-[100px] rounded-full pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative">
          <Link href="/" className="text-[#e8d5a3] font-serif text-xl font-medium">
            Career Copilot
          </Link>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-white/70 font-serif text-2xl leading-snug">
            Everything you need to prepare smarter for government exams
          </h2>

          <ul className="space-y-3">
            {[
              "Track 500+ exam notifications automatically",
              "Instant eligibility matching for your profile",
              "AI study planner tailored to your deadline",
              "Progress tracker with daily study logs",
              "Structured forum — no more Telegram chaos",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-white/45 text-sm">
                <span className="text-[#e8d5a3]/60 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-white/20 text-xs pt-2">
            Free plan available · No credit card needed · Cancel anytime
          </p>
        </div>

        <div className="relative">
          <p className="text-white/15 text-xs">© {new Date().getFullYear()} Career Copilot</p>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-fadeUp">
        <div className="w-full max-w-sm">

          <Link href="/" className="text-[#e8d5a3] font-serif text-lg font-medium lg:hidden block mb-10">
            Career Copilot
          </Link>

          <h1 className="text-white text-3xl font-serif font-medium mb-2">
            Create your account
          </h1>
          <p className="text-white/40 text-sm mb-8">
            Set up in 2 minutes. Your personalised exam feed awaits.
          </p>

          {params?.error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {decodeURIComponent(params.error)}
            </div>
          )}

          <form action={signUp} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label htmlFor="full_name" className="text-white/50 text-xs uppercase tracking-widest">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Rahul Sharma"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/50 focus:bg-white/[0.06] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-white/50 text-xs uppercase tracking-widest">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/50 focus:bg-white/[0.06] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-white/50 text-xs uppercase tracking-widest">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/50 focus:bg-white/[0.06] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#e8d5a3] text-[#0c0c0c] text-sm font-medium hover:bg-[#f0dfa8] active:scale-[0.99] transition-all mt-2"
            >
              Create account →
            </button>
          </form>

          <p className="text-white/20 text-xs text-center mt-4 leading-relaxed">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline hover:text-white/40 transition-colors">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-white/40 transition-colors">Privacy Policy</Link>.
          </p>

          <p className="text-white/30 text-sm text-center mt-5">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#e8d5a3]/70 hover:text-[#e8d5a3] transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}