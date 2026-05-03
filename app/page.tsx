import Link from "next/link"
import { createClient } from "@/utils/supabase/server"

// ─── Data ─────────────────────────────────────────────────────────────────────

const EXAM_LOGOS = [
  "UPSC", "SEBI", "RBI", "SSC", "IBPS",
  "NABARD", "IRDAI", "Railways", "State PSC",
]

const FEATURES = [
  {
    icon: "🔔",
    title: "Notification tracker",
    desc:  "Every recruitment notification from 500+ bodies — auto-tracked, deduplicated, and delivered to your feed the moment it drops.",
  },
  {
    icon: "✓",
    title: "Eligibility engine",
    desc:  "Your age, category, education, and attempt history matched against each post's exact criteria. No manual checking, ever again.",
  },
  {
    icon: "📅",
    title: "AI study planner",
    desc:  "Claude AI builds a week-by-week schedule tailored to your exam, your deadline, and your weak subjects. Adjusts as you log sessions.",
  },
  {
    icon: "📚",
    title: "Course marketplace",
    desc:  "Buy test series, notes, and video courses from toppers and educators. Sell your own. Zero setup.",
  },
  {
    icon: "💬",
    title: "Structured forum",
    desc:  "Exam-specific discussion — not scattered across 40 Telegram groups. Searchable, moderated, permanent.",
  },
  {
    icon: "📊",
    title: "Progress tracker",
    desc:  "Daily study logs, streak tracking, and week completion — so you know exactly where you stand at any moment.",
  },
]

const TESTIMONIALS = [
  {
    name: "Sankar Ganesan",
    role: "SSC CGL",
    quote: "Career-Copilot solved this exact problem and told me exactly which exams I am eligible for right now, based on my specific age, category, education, attempts, and domicile — automatically, without me having to read 30 PDFs"
  },
  {
    name:  "Priya Sharma",
    role:  "RBI Grade B 2024",
    quote: "I was tracking 6 exams manually on a spreadsheet. Career Copilot collapsed it into one feed. The eligibility check alone saved me 3 pointless applications.",
  },
  {
    name:  "Arjun Mehta",
    role:  "SEBI Grade A aspirant",
    quote: "The AI study plan actually accounted for my weak spots in Quant and gave me 3 extra weeks on it. First time I felt like I had a real coach.",
  },
  {
    name:  "Sneha Patel",
    role:  "SSC CGL 2023 qualifier",
    quote: "Stopped using four different apps and three Telegram channels. Everything I need is here. Especially the deadline countdown — saved me once already.",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="grain min-h-screen bg-[#0c0c0c] overflow-x-hidden">

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0c0c0c]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[#e8d5a3] font-serif text-xl font-medium tracking-tight">
            Career Copilot
          </span>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-white/40 text-sm hover:text-white transition-colors hidden sm:block">
              Pricing
            </Link>
            <Link href="/marketplace" className="text-white/40 text-sm hover:text-white transition-colors hidden sm:block">
              Marketplace
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-1.5 rounded-lg bg-[#e8d5a3] text-[#0c0c0c] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
              >
                Dashboard →
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login" className="text-white/50 text-sm hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-1.5 rounded-lg bg-[#e8d5a3] text-[#0c0c0c] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14">

        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-[#e8d5a3] opacity-[0.04] blur-[120px]" />
        </div>

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center animate-fadeUp">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.06] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e8d5a3] animate-pulse" />
            <span className="text-[#e8d5a3]/70 text-xs tracking-wider uppercase">
              AI-powered exam prep for India
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-medium leading-[1.1] tracking-tight text-white mb-6">
            One platform for
            <br />
            <span className="text-[#e8d5a3]">every govt exam</span>
            <br />
            you&apos;re targeting
          </h1>

          <p className="text-white/45 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            Track notifications, verify eligibility, get an AI study plan, and
            prepare alongside 50,000+ aspirants — for UPSC, SEBI, RBI, SSC,
            IBPS, and hundreds more.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#e8d5a3] text-[#0c0c0c] text-base font-medium hover:bg-[#f0dfa8] transition-colors"
            >
              Start for free →
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/[0.12] text-white/60 text-base hover:text-white hover:border-white/[0.25] transition-colors"
            >
              See how it works
            </Link>
          </div>

          <p className="text-white/25 text-xs mt-5">
            No credit card · Free plan forever · 2-minute setup
          </p>
        </div>

        {/* Exam logos strip */}
        <div className="relative mt-20 w-full max-w-4xl mx-auto">
          <p className="text-white/20 text-xs uppercase tracking-widest text-center mb-5">
            Tracking notifications for
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {EXAM_LOGOS.map((name) => (
              <span
                key={name}
                className="px-4 py-2 rounded-lg border border-white/[0.07] bg-white/[0.02] text-white/35 text-sm font-mono"
              >
                {name}
              </span>
            ))}
            <span className="text-white/20 text-sm">+ 490 more</span>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#e8d5a3]/50 text-xs uppercase tracking-widest mb-3">
              What Career Copilot does
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl font-medium text-white leading-tight">
              Everything scattered across<br />Telegram groups, in one place
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-[#e8d5a3]/20 hover:bg-[#e8d5a3]/[0.03] transition-colors"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-2xl mb-4 opacity-70">{f.icon}</div>
                <h3 className="text-white font-medium text-base mb-2 font-serif">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-medium text-white mb-3">
              Ready in under 3 minutes
            </h2>
            <p className="text-white/40">Sign up, complete onboarding, and your feed is live.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Create your profile", desc: "Tell us your education, category, state, and target exams. Takes 2 minutes." },
              { step: "02", title: "Get your matches", desc: "Our eligibility engine instantly shows you every exam you qualify for — with countdown timers." },
              { step: "03", title: "Start your plan", desc: "Claude AI builds a week-by-week study plan. Log sessions daily and track your progress." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="font-mono text-[#e8d5a3]/20 text-4xl font-medium mb-4">{s.step}</div>
                <h3 className="text-white font-medium text-base mb-2">{s.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/20 text-xs uppercase tracking-widest text-center mb-12">
            What aspirants say
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
              >
                <p className="text-white/55 text-sm leading-relaxed mb-5 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-white/70 text-sm font-medium">{t.name}</p>
                  <p className="text-white/30 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-medium text-white leading-tight mb-5">
            Your next exam notification
            <br />
            <span className="text-[#e8d5a3]">won&apos;t slip past you</span>
          </h2>
          <p className="text-white/40 mb-8 leading-relaxed">
            Join thousands of aspirants who stopped relying on Telegram alerts
            and started preparing with a system.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-10 py-4 rounded-xl bg-[#e8d5a3] text-[#0c0c0c] text-base font-medium hover:bg-[#f0dfa8] transition-colors"
          >
            Create free account →
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[#e8d5a3]/60 font-serif text-base">Career Copilot</span>
          <div className="flex items-center gap-6 text-white/25 text-sm">
            <Link href="/pricing"    className="hover:text-white/50 transition-colors">Pricing</Link>
            <Link href="/marketplace" className="hover:text-white/50 transition-colors">Marketplace</Link>
            <Link href="/auth/login"  className="hover:text-white/50 transition-colors">Sign in</Link>
          </div>
          <p className="text-white/15 text-xs">© {new Date().getFullYear()} Career Copilot</p>
        </div>
      </footer>

    </div>
  )
}