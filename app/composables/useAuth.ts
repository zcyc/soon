export interface AuthUser {
  id: string
  name: string
  role: 'admin' | 'user'
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

  function clearSession(persist = true) {
    user.value = null
    accessToken.value = null
    if (persist && import.meta.client) {
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        console.warn('Unable to remove the saved SOON session from browser storage.')
      }
    }
  }

  async function restoreSession() {
    if (!import.meta.client) return
    let token: string | null
    try {
      token = localStorage.getItem(TOKEN_KEY)
    } catch {
      console.warn('Browser storage is unavailable; the SOON session can only be used in this tab.')
      return
    }
    if (!token) {
      clearSession(false)
      return
    }

    if (accessToken.value !== token) user.value = null
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

  async function establishSession(endpoint: 'login' | 'register', account: string, password: string) {
    const result = await $fetch<{ accessToken: string; user: AuthUser }>(`${getApiBaseURL()}/api/auth/${endpoint}`, {
      method: 'POST',
      body: { account, password }
    })
    accessToken.value = result.accessToken
    user.value = result.user
    if (import.meta.client) {
      try {
        localStorage.setItem(TOKEN_KEY, result.accessToken)
      } catch {
        console.warn('Unable to persist the SOON session; it will be lost when this tab closes.')
      }
    }
  }

  return {
    user,
    accessToken,
    signIn: (account: string, password: string) => establishSession('login', account, password),
    register: (account: string, password: string) => establishSession('register', account, password),
    signOut: clearSession,
    restoreSession
  }
}

export function useCurrentUser() {
  return useAuth().user
}
