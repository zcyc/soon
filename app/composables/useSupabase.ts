import type { SupabaseClient } from '@supabase/supabase-js'

export function useSupabase(): SupabaseClient {
  return useNuxtApp().$supabase
}

export function useCurrentUser() {
  return useState<import('@supabase/supabase-js').User | null>('current-user', () => null)
}
