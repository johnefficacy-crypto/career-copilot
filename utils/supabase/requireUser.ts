import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

// FIX: removed `import { cookies }` and `createClient(cookieStore)`.
// FIX: redirect was pointing to "/login" — correct path in this project is "/auth/login".

export async function requireUser() {
  const supabase = await createClient()   // ← no cookieStore arg

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")   // ← FIX: was "/login"
  }

  return user
}