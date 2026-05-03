---
name: Career Copilot Design System
description: Dark, gold-accented, archival-feel design system for Career Copilot — an India-focused platform for government, PSU, banking, and regulatory exam aspirants. Serious, credible, information-dense. Covers both the aspirant product and the admin operating system.
---

# Career Copilot Design System

This skill gives you everything you need to produce on-brand Career Copilot artifacts — marketing pages, aspirant dashboards, onboarding flows, AI chat, and the admin operator console — without diverging from production code.

## When to use

Invoke this skill when the user asks for ANY Career Copilot design work:
- Landing page, auth, onboarding screens
- Aspirant dashboard / recruitment cards / notifications / study plan
- AI career chat surfaces
- Admin overview, scrape dashboard, source registry, recruitment tables, review queues
- New components that need to fit the existing system

## Files in this skill

```
README.md                   ← full design system documentation (content + visual foundations + iconography)
colors_and_type.css         ← CSS variables + utility classes — import FIRST in every artifact
assets/                     ← logo-wordmark.svg, logo-mark.svg, logo-mark-on-gold.svg
preview/                    ← reference cards for every token, component, layout
ui_kits/aspirant/           ← marketing, dashboard, onboarding, chat, primitives
ui_kits/admin/              ← shell, overview, tables, scrape dashboard, source registry
```

## How to use it

### 1. Always read `README.md` first

It is the source of truth for voice, tone, casing, visual tokens, animation, emoji policy, and iconography. Roughly 300 lines — read the whole thing before making decisions about copy or color.

### 2. Import the tokens

Every artifact starts with:

```html
<link rel="stylesheet" href="<path-to-skill>/colors_and_type.css" />
```

This gives you Playfair Display + DM Sans + DM Mono, all color tokens (`--gold`, `--bg-root`, `--border-md`, `--radius-xl`, …), semantic states, and utility helpers (`.cc-icon`, `.cc-surface`, `.cc-mono`).

### 3. Look at the preview cards before inventing

`preview/` has one HTML card per concept. If you need a button, open `preview/components-buttons.html`. If you need a status pill, open `preview/components-badges.html`. If you need a dense admin row, open `preview/components-admin-table.html`. Copy from there — do NOT reinvent.

Categories in `preview/`:
- **Brand** — `brand-logo`, `brand-icons`
- **Type** — `type-display`, `type-body`, `type-mono`
- **Colors** — `colors-brand`, `colors-neutrals`, `colors-semantic`
- **Spacing** — `radii`, `spacing`
- **Components** — buttons, inputs, badges, alerts, stats, filter-bar, onboarding-progress, recruitment-card, notification-rows, eligibility-explainer, admin-table, review-queue, timeline

### 4. Build from the UI kits, not from scratch

`ui_kits/aspirant/index.html` renders a navigable multi-screen kit — marketing landing, onboarding, dashboard, chat, notifications. `ui_kits/admin/index.html` renders the admin shell with overview, recruitments table, scrape dashboard, source registry.

For new screens, lift components from the matching kit:

| You need… | Pull from |
|---|---|
| Top-level app navigation (aspirant) | `ui_kits/aspirant/AppNav.jsx` |
| Dashboard 2+1 grid shell | `ui_kits/aspirant/DashboardShell.jsx` |
| Recruitment card, status pill, progress bar | `ui_kits/aspirant/Primitives.jsx` |
| Onboarding step scaffold | `ui_kits/aspirant/OnboardingStep.jsx` |
| AI chat transcript / composer | `ui_kits/aspirant/ChatPane.jsx` |
| Notifications feed rows | `ui_kits/aspirant/NotificationsFeed.jsx` |
| Admin sidebar + content frame | `ui_kits/admin/AdminShell.jsx` |
| Stat tiles, dense data tables, review queue rows | `ui_kits/admin/*` |

## Non-negotiables

- **Voice:** second person, sentence case, concrete numbers, no hype. See README § Voice & tone.
- **Color:** dark navy-black root + single warm gold (`#e8d5a3`). Semantic colors used at 10–25% opacity on dark, never fully saturated.
- **Type:** Playfair Display for display only; DM Sans for body/UI; DM Mono for tabular numbers and codes.
- **Emoji:** treated as placeholder iconography. Do NOT decorate with emoji. Use Lucide icons (stroke 1.75px, inherit text color).
- **Motion:** functional only. Hover 0.15s. Press `scale(0.99)`. No bouncing, no spring, no parallax, no confetti.
- **Borders:** `1px solid`. Never 2px. Never dashed.
- **Shadows:** effectively none. Elevation comes from transparency layering and border intensity, not drop shadows.
- **Trust microcopy matters:** "No credit card · Free plan forever · 2-minute setup", "The system runs every 6 hours". Don't delete these — they're load-bearing credibility.

## Flagged substitutions

Two things in this system are placeholders the founder should confirm:

1. **Logo.** `assets/logo-*.svg` is a Playfair-typeset wordmark + CC monogram. No designed logo existed in the codebase. Call this out in deliverables.
2. **Icon family.** Lucide (via CDN, stroke 1.75px) is the substituted choice. Tabler / Phosphor / Heroicons-outline would also work. The codebase today uses emoji placeholders — see README § ICONOGRAPHY for the full mapping.

## Source of truth

- Tokens in `colors_and_type.css` are lifted 1:1 from `career-copilot/app/globals.css`. If tokens drift in production, re-sync this file.
- Component patterns trace back to `career-copilot/components/{dashboard, chat, marketplace, auth, onboarding, study-plan, nav, admin}`.
- Copy patterns trace back to `career-copilot/app/page.tsx` (landing) and the onboarding step files.

When in doubt, open the real code.
