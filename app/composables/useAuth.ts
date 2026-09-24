export interface AuthUser {
  id: string
  name: string
}

const TOKEN_KEY = 'soon-auth-token'

export function isUnauthorizedError(cause: unknown) {
  return !!cause && typeof cause === 'object'
    && 'statusCode' in cause && cause.statusCode === 401
}

export function getApiBaseURL() {
  const config = useRuntimeConfig()
  const base = config.public.apiBase || (import.meta.dev ? 'http://localhost:8787' : '')
  if (!base) throw new Error('NUXT_PUBLIC_API_BASE must be configured for production')
  return String(base).replace(/\/$/, '')
}

export function useAuth() {
  const user = useState<AuthUser | null>('current-user', () => null)
  const accessToken = useState<string | null>('auth-token', () => null)

  function clearSession() {
    user.value = null
    accessToken.value = null
    if (import.meta.client) localStorage.removeItem(TOKEN_KEY)
  }

  async function restoreSession() {
    if (!import.meta.client) return
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    accessToken.value = token
    try {
      const restoredUser = await $fetch<AuthUser>(`${getApiBaseURL()}/api/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (accessToken.value === token) user.value = restoredUser
    } catch (cause) {
      if (accessToken.value !== token) return
      if (isUnauthorizedError(cause)) clearSession()
      else console.error('Unable to restore the SOON session.', cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function signIn(account: string, password: string) {
    const result = await $fetch<{ accessToken: string; user: AuthUser }>(`${getApiBaseURL()}/api/auth/login`, {
      method: 'POST',
      body: { account, password }
    })
    accessToken.value = result.accessToken
    user.value = result.user
    if (import.meta.client) localStorage.setItem(TOKEN_KEY, result.accessToken)
  }

  return { user, accessToken, signIn, signOut: clearSession, restoreSession }
}

export function useCurrentUser() {
  return useAuth().user
}
