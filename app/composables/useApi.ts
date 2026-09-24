import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'
import { getApiBaseURL, isUnauthorizedError, useAuth } from './useAuth'

export function useApi() {
  const baseURL = getApiBaseURL()
  const auth = useAuth()

  async function apiFetch<T>(path: string, options: NitroFetchOptions<NitroFetchRequest> = {}): Promise<T> {
    const headers = new Headers(options.headers as HeadersInit | undefined)
    const token = auth.accessToken.value
    if (token) headers.set('Authorization', `Bearer ${token}`)
    try {
      return await $fetch<T>(`${baseURL}/api/${path.replace(/^\//, '')}`, { ...options, headers })
    } catch (cause) {
      if (token && auth.accessToken.value === token && isUnauthorizedError(cause)) auth.signOut()
      throw cause
    }
  }

  return { apiFetch, baseURL }
}
