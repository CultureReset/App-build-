import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseEnv } from '@/lib/supabase/env'

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Everything it does runs as the signed-in user (or as `anon`), so Row Level
 * Security applies to every query made through it. There is deliberately no
 * service-role client anywhere in this codebase.
 */
export async function createServerSupabase() {
  const { url, anonKey } = supabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead.
        }
      },
    },
  })
}

export async function getSessionUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
