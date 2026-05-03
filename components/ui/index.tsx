"use client"
/**
 * components/ui/index.tsx
 * Career Copilot — shared UI primitives from the Claude Design System.
 *
 * All components are purely visual (no data fetching, no server actions).
 * Import from "@/components/ui".
 */

import React from "react"

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  style?: React.CSSProperties
}

export function Card({ children, className = "", hover = true, style }: CardProps) {
  return (
    <div
      className={`cc-card ${hover ? "" : "cc-card-static"} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

// ── RowCard ───────────────────────────────────────────────────────────────────

interface RowCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function RowCard({ children, className = "", style }: RowCardProps) {
  return (
    <div className={`cc-row-card ${className}`} style={style}>
      {children}
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────

type PillTone = "success" | "warning" | "danger" | "gold" | "muted"

interface PillProps {
  tone?: PillTone
  children: React.ReactNode
  className?: string
}

export function Pill({ tone = "muted", children, className = "" }: PillProps) {
  return (
    <span className={`cc-pill cc-pill--${tone} ${className}`}>
      {children}
    </span>
  )
}

// ── Eyebrow ───────────────────────────────────────────────────────────────────

interface EyebrowProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Eyebrow({ children, className = "", style }: EyebrowProps) {
  return (
    <div className={`cc-eyebrow ${className}`} style={style}>
      {children}
    </div>
  )
}

// ── StatTile ──────────────────────────────────────────────────────────────────

interface StatTileProps {
  label:    string
  value:    string | number
  sub?:     string
  accent?:  boolean
  className?: string
}

export function StatTile({ label, value, sub, accent, className = "" }: StatTileProps) {
  return (
    <div className={`cc-stat-tile ${accent ? "cc-stat-tile--accent" : ""} ${className}`}>
      <div className="cc-stat-value">{value}</div>
      <div className="cc-stat-label">{label}</div>
      {sub && <div className="cc-stat-sub">{sub}</div>}
    </div>
  )
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

interface ProgressBarProps {
  pct:      number  // 0–100
  color?:   string
  className?: string
}

export function ProgressBar({ pct, color, className = "" }: ProgressBarProps) {
  return (
    <div className={`cc-progress ${className}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color ?? "var(--gold)" }} />
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "link"
  size?:    "default" | "sm"
  children: React.ReactNode
  className?: string
}

export function Button({
  variant = "primary",
  size = "default",
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "ghost" ? "cc-btn-ghost" :
    variant === "link"  ? "cc-btn-link"  :
    "cc-btn-primary"

  const sizeClass = size === "sm" ? "cc-btn-sm" : ""

  return (
    <button className={`cc-btn ${variantClass} ${sizeClass} ${className}`} {...rest}>
      {children}
    </button>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`cc-section-label ${className}`}>{children}</span>
}

// ── BounceLoader ──────────────────────────────────────────────────────────────

export function BounceLoader({ className = "" }: { className?: string }) {
  return (
    <span className={`cc-bounce ${className}`}>
      <i /><i /><i />
    </span>
  )
}
