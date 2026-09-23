import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || (import.meta.dev ? 'http://127.0.0.1:54321' : '')
  const supabaseAnonKey = config.public.supabaseAnonKey || (import.meta.dev ? 'missing-anon-key' : '')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY must be configured for production')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  })
  const user = useState<User | null>('current-user', () => null)
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null
  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })

  return { provide: { supabase } }
})
