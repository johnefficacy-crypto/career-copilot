"use client"

import { useState, useEffect } from "react"

type Testimonial = {
  name:  string
  role:  string
  quote: string
}

interface Props {
  testimonials: Testimonial[]
}

export function LoginPageClient({ testimonials }: Props) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setVisible(false)
      setTimeout(() => {
        setCurrent((c) => (c + 1) % testimonials.length)
        setVisible(true)
      }, 400) // wait for fade-out then switch
    }, 5000) // rotate every 5 seconds

    return () => clearInterval(interval)
  }, [testimonials.length])

  const t = testimonials[current]

  return (
    <blockquote
      style={{
        borderLeft: "2px solid var(--gold-border)",
        paddingLeft: "1.25rem",
        transition: "opacity 0.4s ease",
        opacity: visible ? 1 : 0,
      }}
    >
      <p
        className="text-sm leading-relaxed italic mb-3"
        style={{ color: "rgba(255,255,255,0.50)" }}
      >
        &ldquo;{t.quote}&rdquo;
      </p>
      <div>
        <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
          {t.name}
        </p>
        <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
          {t.role}
        </p>
      </div>

      {/* Dots indicator */}
      <div className="flex items-center gap-1.5 mt-4">
        {testimonials.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setVisible(false); setTimeout(() => { setCurrent(i); setVisible(true) }, 300) }}
            className="rounded-full transition-all"
            style={{
              width:      i === current ? "16px" : "5px",
              height:     "5px",
              background: i === current ? "var(--gold)" : "var(--border-md)",
            }}
          />
        ))}
      </div>
    </blockquote>
  )
}