/**
 * app/admin/recruitments/new/page.tsx
 *
 * FIX: RecruitmentForm receives a server action as the `action` prop.
 * This is valid — <form action={serverAction}> works in client components.
 * The error was NOT here; it was in the delete buttons on other pages.
 * This file is unchanged except for adding error handling.
 */

import Link from "next/link"
import { getAllOrganizations } from "@/lib/db/admin"
import { adminCreateRecruitment } from "@/actions/admin"
import { RecruitmentForm } from "@/components/admin/RecruitmentForm"

export default async function NewRecruitmentPage() {
  let organizations: Awaited<ReturnType<typeof getAllOrganizations>> = []
  try {
    organizations = await getAllOrganizations()
  } catch {
    // If org fetch fails, form still renders — just empty dropdown
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/recruitments" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          ← Back
        </Link>
      </div>
      <h1 className="text-white text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Add recruitment
      </h1>
      <p className="text-white/40 text-sm mb-8">
        Fill in the basic details. You can add posts and criteria after saving.
      </p>
      {organizations.length === 0 && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          No organizations found. <Link href="/admin/organizations" className="underline">Add an organization first</Link> — recruitments must belong to an organization.
        </div>
      )}
      <RecruitmentForm organizations={organizations} action={adminCreateRecruitment} />
    </div>
  )
}