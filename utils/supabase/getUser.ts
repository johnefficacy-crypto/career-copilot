import { createClient } from "@/utils/supabase/server"

// FIX: removed `import { cookies }` and `createClient(cookieStore)`.
// The canonical server.ts already handles cookies() internally.

export async function getCurrentUser() {
  const supabase = await createClient()   // ← no cookieStore arg

  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) return null
  return data.user
}