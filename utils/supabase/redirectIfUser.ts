import { redirect } from "next/navigation"

import { createClient } from "@/utils/supabase/server"

export async function redirectIfUser() {
  
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }
}