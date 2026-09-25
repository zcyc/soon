import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { assertAuthNotLocked, createAccessToken, getLoginClientKey, hashPassword, recordAuthAttempt, verifySetupToken, type AuthUser } from '../../utils/auth'
import { getEnv, readObjectBody } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const account = typeof body.account === 'string' ? body.account.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const setupToken = typeof body.setupToken === 'string' ? body.setupToken : ''
  if (!account || account.length > 128 || /[\u0000-\u001f\u007f]/.test(account) || password.length < 12 || password.length > 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Account or password is invalid' })
  }
  if (await env.DB.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>()) {
    throw createError({ statusCode: 409, statusMessage: 'Initial administrator has already been created' })
  }
  const now = Math.floor(Date.now() / 1000)
  const clientKey = await getLoginClientKey(env, `setup:${getRequestHeader(event, 'cf-connecting-ip') || 'unknown'}`)
  await assertAuthNotLocked(env, clientKey, now)
  if (await recordAuthAttempt(env, clientKey, now)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many setup attempts. Try again later.' })
  }
  if (!await verifySetupToken(env, setupToken)) {
    throw createError({ statusCode: 401, statusMessage: 'Setup token is incorrect' })
  }

  const passwordHash = await hashPassword(password)
  const user = await env.DB.prepare(`
    INSERT INTO users (id, account, password_hash, role)
    SELECT ?, ?, ?, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users)
    ON CONFLICT(account) DO NOTHING
    RETURNING id, account AS name, role, session_version AS sessionVersion
  `).bind(crypto.randomUUID(), account, passwordHash).first<AuthUser>()
  if (!user) throw createError({ statusCode: 409, statusMessage: 'Initial administrator has already been created' })

  return {
    accessToken: await createAccessToken(env, user),
    user: { id: user.id, name: user.name, role: user.role }
  }
})
