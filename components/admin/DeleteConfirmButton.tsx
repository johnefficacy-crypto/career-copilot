"use client"

/**
 * components/admin/DeleteConfirmButton.tsx
 *
 * Reusable client component for any delete-with-confirm pattern in admin.
 * 
 * WHY THIS EXISTS:
 * Server Components cannot have event handlers (onClick, etc.) — they crash
 * with "Event handlers cannot be passed to Client Component props".
 * Instead of converting entire pages to "use client", we extract just the
 * interactive confirmation button into this small client component.
 */

import { useTransition } from "react"

interface Props {
  action:    (fd: FormData) => Promise<void>
  message:   string
  fields:    Record<string, string>
  label?:    string
  className?: string
}

export function DeleteConfirmButton({
  action,
  message,
  fields,
  label = "Delete",
  className = "text-red-400/40 text-xs hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/[0.05]",
}: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(message)) return
    startTransition(async () => {
      const fd = new FormData()
      for (const [k, v] of Object.entries(fields)) fd.set(k, v)
      await action(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={className}
    >
      {isPending ? "…" : label}
    </button>
  )
}