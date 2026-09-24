import { createError } from 'h3'

const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60
const encoder = new TextEncoder()
// Keep the configured login identity separate from account labels and the multi-user D1 ownership model.
export const CONFIGURED_ACCOUNT_ID = 'configured-account'

export interface AuthUser {
  id: string
  name: string
}

function getAuthConfig(env: Cloudflare.Env) {
  if (!env.AUTH_ACCOUNT?.trim() || env.AUTH_ACCOUNT.length > 128 || !env.AUTH_PASSWORD || env.AUTH_PASSWORD.length < 12 || env.AUTH_PASSWORD.length > 1024 || encoder.encode(env.AUTH_SESSION_SECRET || '').length < 32) {
    throw createError({ statusCode: 500, statusMessage: 'Configured account authentication is not set up' })
  }
  return { account: env.AUTH_ACCOUNT.trim(), password: env.AUTH_PASSWORD, secret: env.AUTH_SESSION_SECRET }
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function importSigningKey(secret: string) {
  return await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right))
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index]! ^ rightBytes[index]!
  return difference === 0
}

export async function validateConfiguredCredentials(env: Cloudflare.Env, account: string, password: string) {
  const config = getAuthConfig(env)
  const [accountMatches, passwordMatches] = await Promise.all([
    constantTimeEqual(account, config.account),
    constantTimeEqual(password, config.password)
  ])
  return accountMatches && passwordMatches
}

export async function createAccessToken(env: Cloudflare.Env) {
  const { account, secret } = getAuthConfig(env)
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: account, exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS })))
  const key = await importSigningKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifyAccessToken(env: Cloudflare.Env, token: string): Promise<AuthUser | null> {
  const config = getAuthConfig(env)
  if (token.length > 4096) return null
  const [payloadPart, signaturePart, extra] = token.split('.')
  if (!payloadPart || !signaturePart || extra !== undefined) return null
  const signature = fromBase64Url(signaturePart)
  const payloadBytes = fromBase64Url(payloadPart)
  if (!signature || !payloadBytes) return null

  const key = await importSigningKey(config.secret)
  if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payloadPart))) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { sub?: unknown; exp?: unknown }
    const now = Math.floor(Date.now() / 1000)
    if (payload.sub !== config.account || typeof payload.exp !== 'number' || payload.exp <= now || payload.exp > now + TOKEN_LIFETIME_SECONDS) return null
  } catch {
    return null
  }

  return { id: CONFIGURED_ACCOUNT_ID, name: config.account }
}

export async function getLoginClientKey(env: Cloudflare.Env, address: string) {
  const { secret } = getAuthConfig(env)
  const key = await importSigningKey(secret)
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(address || 'unknown'))
  return toBase64Url(new Uint8Array(digest))
}
