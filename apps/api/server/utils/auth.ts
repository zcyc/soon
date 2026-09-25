import { createError } from 'h3'

const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60
const PASSWORD_HASH_ITERATIONS = 600_000
const MAX_AUTH_ATTEMPTS = 5
const AUTH_WINDOW_SECONDS = 15 * 60
const encoder = new TextEncoder()

export interface AuthUser {
  id: string
  name: string
  role: 'admin' | 'user'
  sessionVersion?: number
}

function getSessionSecret(env: Cloudflare.Env) {
  if (encoder.encode(env.AUTH_SESSION_SECRET || '').length < 32) {
    throw createError({ statusCode: 500, statusMessage: 'AUTH_SESSION_SECRET must contain at least 32 bytes' })
  }
  return env.AUTH_SESSION_SECRET
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

export async function verifySetupToken(env: Cloudflare.Env, token: string) {
  const expectedToken = env.AUTH_SETUP_TOKEN || ''
  if (encoder.encode(expectedToken).length < 32) {
    throw createError({ statusCode: 500, statusMessage: 'AUTH_SETUP_TOKEN must contain at least 32 bytes' })
  }
  if (encoder.encode(token).length > 1024) return false
  const [expected, actual] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expectedToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(token))
  ])
  const expectedBytes = new Uint8Array(expected)
  const actualBytes = new Uint8Array(actual)
  let difference = 0
  for (let index = 0; index < expectedBytes.length; index += 1) difference |= expectedBytes[index]! ^ actualBytes[index]!
  return difference === 0
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations }, key, 256))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS)
  return `pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

export async function verifyPassword(password: string, encodedHash: string | null | undefined) {
  const parts = encodedHash?.split('$')
  const validFormat = parts?.length === 4 && parts[0] === 'pbkdf2-sha256' && parts[1] === String(PASSWORD_HASH_ITERATIONS)
  const salt = validFormat ? fromBase64Url(parts?.[2] || '') : null
  const expected = validFormat ? fromBase64Url(parts?.[3] || '') : null
  const actual = await derivePasswordHash(password, salt?.length === 16 ? salt : new Uint8Array(16), PASSWORD_HASH_ITERATIONS)
  if (!validFormat || !salt || salt.length !== 16 || !expected || expected.length !== actual.length) return false
  let difference = 0
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index]! ^ expected[index]!
  return difference === 0
}

export async function createAccessToken(env: Cloudflare.Env, user: AuthUser) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    sub: user.id,
    ver: user.sessionVersion ?? 0,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS
  })))
  const key = await importSigningKey(getSessionSecret(env))
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifyAccessToken(env: Cloudflare.Env, token: string): Promise<AuthUser | null> {
  if (token.length > 4096) return null
  const [payloadPart, signaturePart, extra] = token.split('.')
  if (!payloadPart || !signaturePart || extra !== undefined) return null
  const signature = fromBase64Url(signaturePart)
  const payloadBytes = fromBase64Url(payloadPart)
  if (!signature || !payloadBytes) return null

  const key = await importSigningKey(getSessionSecret(env))
  if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payloadPart))) return null
  let payload: { sub?: unknown; ver?: unknown; exp?: unknown }
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { sub?: unknown; ver?: unknown; exp?: unknown }
  } catch {
    return null
  }
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.sub !== 'string' || !Number.isInteger(payload.ver) || typeof payload.exp !== 'number' || payload.exp <= now || payload.exp > now + TOKEN_LIFETIME_SECONDS) return null
  const user = await env.DB.prepare('SELECT id, account AS name, role, session_version AS sessionVersion FROM users WHERE id = ? AND is_active = 1')
    .bind(payload.sub).first<AuthUser>()
  if (!user || user.sessionVersion !== payload.ver) return null
  return { id: user.id, name: user.name, role: user.role }
}

export async function getLoginClientKey(env: Cloudflare.Env, address: string) {
  const key = await importSigningKey(getSessionSecret(env))
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(address || 'unknown'))
  return toBase64Url(new Uint8Array(digest))
}

export async function assertAuthNotLocked(env: Cloudflare.Env, clientKey: string, now: number) {
  await env.DB.prepare('DELETE FROM auth_login_attempts WHERE window_started_at < ? AND locked_until <= ?')
    .bind(now - 24 * 60 * 60, now).run()
  const attempt = await env.DB.prepare('SELECT locked_until FROM auth_login_attempts WHERE client_key = ?')
    .bind(clientKey).first<{ locked_until: number }>()
  if (attempt && attempt.locked_until > now) {
    throw createError({ statusCode: 429, statusMessage: 'Too many authentication attempts. Try again later.' })
  }
}

export async function recordAuthAttempt(env: Cloudflare.Env, clientKey: string, now: number) {
  const result = await env.DB.prepare(`
    INSERT INTO auth_login_attempts (client_key, window_started_at, attempts, locked_until)
    VALUES (?, ?, 1, 0)
    ON CONFLICT(client_key) DO UPDATE SET
      attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END,
      window_started_at = CASE WHEN window_started_at <= ? THEN excluded.window_started_at ELSE window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END) >= ? THEN ?
        ELSE locked_until
      END
    RETURNING locked_until
  `).bind(clientKey, now, now - AUTH_WINDOW_SECONDS, now - AUTH_WINDOW_SECONDS, now - AUTH_WINDOW_SECONDS, MAX_AUTH_ATTEMPTS, now + AUTH_WINDOW_SECONDS)
    .first<{ locked_until: number }>()
  return Boolean(result && result.locked_until > now)
}
