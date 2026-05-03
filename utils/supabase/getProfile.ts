import { createClient } from "@/utils/supabase/server"

// FIX: removed `import { cookies }` and `createClient(cookieStore)`.

export async function getProfile() {
  const supabase = await createClient()   // ← no cookieStore arg

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile
}