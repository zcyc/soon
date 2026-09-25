import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { assertAuthNotLocked, createAccessToken, getLoginClientKey, hashPassword, recordAuthAttempt, type AuthUser } from '../../utils/auth'
import { getEnv, readObjectBody } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const account = typeof body.account === 'string' ? body.account.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!account || account.length > 128 || /[\u0000-\u001f\u007f]/.test(account) || password.length < 12 || password.length > 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Account or password is invalid' })
  }
  const availability = await env.DB.prepare(`
    SELECT COUNT(*) AS user_count,
      (SELECT value FROM system_settings WHERE key = 'allow_registration') AS allow_registration
    FROM users
  `).first<{ user_count: number; allow_registration: string | null }>()
  if (!availability || availability.user_count === 0) throw createError({ statusCode: 409, statusMessage: 'Initial administrator setup is required' })
  if (availability.allow_registration !== 'true') throw createError({ statusCode: 403, statusMessage: 'Registration is disabled' })
  const now = Math.floor(Date.now() / 1000)
  const clientKey = await getLoginClientKey(env, `register:${getRequestHeader(event, 'cf-connecting-ip') || 'unknown'}`)
  await assertAuthNotLocked(env, clientKey, now)
  if (await recordAuthAttempt(env, clientKey, now)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many registration attempts. Try again later.' })
  }

  const passwordHash = await hashPassword(password)
  const user = await env.DB.prepare(`
    INSERT INTO users (id, account, password_hash, role)
    SELECT ?, ?, ?, 'user'
    WHERE EXISTS (SELECT 1 FROM users)
      AND EXISTS (SELECT 1 FROM system_settings WHERE key = 'allow_registration' AND value = 'true')
    ON CONFLICT(account) DO NOTHING
    RETURNING id, account AS name, role, session_version AS sessionVersion
  `).bind(crypto.randomUUID(), account, passwordHash).first<AuthUser>()
  if (!user) {
    const status = await env.DB.prepare(`
      SELECT COUNT(*) AS user_count,
        (SELECT value FROM system_settings WHERE key = 'allow_registration') AS allow_registration
      FROM users
    `).first<{ user_count: number; allow_registration: string | null }>()
    if (!status || status.user_count === 0) throw createError({ statusCode: 409, statusMessage: 'Initial administrator setup is required' })
    if (status.allow_registration !== 'true') throw createError({ statusCode: 403, statusMessage: 'Registration is disabled' })
    throw createError({ statusCode: 409, statusMessage: 'Account already exists' })
  }

  return {
    accessToken: await createAccessToken(env, user),
    user: { id: user.id, name: user.name, role: user.role }
  }
})
