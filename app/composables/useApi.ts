import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'

export function useApi() {
  const config = useRuntimeConfig()
  const configuredBase = config.public.apiBase || (import.meta.dev ? 'http://localhost:8787' : '')
  if (!configuredBase) throw new Error('NUXT_PUBLIC_API_BASE must be configured for production')
  const baseURL = String(configuredBase).replace(/\/$/, '')

  async function apiFetch<T>(path: string, options: NitroFetchOptions<NitroFetchRequest> = {}): Promise<T> {
    const { data } = await useSupabase().auth.getSession()
    const headers = new Headers(options.headers as HeadersInit | undefined)
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
    return await $fetch<T>(`${baseURL}/api/${path.replace(/^\//, '')}`, {
      ...options,
      headers
    })
  }

  return { apiFetch, baseURL }
}
