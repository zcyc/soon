import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { CONFIGURED_ACCOUNT_ID, createAccessToken, getLoginClientKey, validateConfiguredCredentials } from '../../utils/auth'
import { getEnv, readObjectBody } from '../../utils/cloudflare'

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 15 * 60

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const account = typeof body.account === 'string' ? body.account.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const inputIsValid = account.length <= 128 && password.length <= 1024

  const now = Math.floor(Date.now() / 1000)
  const clientKey = await getLoginClientKey(env, getRequestHeader(event, 'cf-connecting-ip') || 'unknown')
  await env.DB.prepare('DELETE FROM auth_login_attempts WHERE window_started_at < ? AND locked_until <= ?')
    .bind(now - 24 * 60 * 60, now).run()
  const attempt = await env.DB.prepare('SELECT locked_until FROM auth_login_attempts WHERE client_key = ?')
    .bind(clientKey).first<{ locked_until: number }>()
  if (attempt && attempt.locked_until > now) {
    throw createError({ statusCode: 429, statusMessage: 'Too many login attempts. Try again later.' })
  }

  if (!inputIsValid || !await validateConfiguredCredentials(env, account, password)) {
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
    `).bind(clientKey, now, now - WINDOW_SECONDS, now - WINDOW_SECONDS, now - WINDOW_SECONDS, MAX_ATTEMPTS, now + WINDOW_SECONDS)
      .first<{ locked_until: number }>()
    if (result && result.locked_until > now) {
      throw createError({ statusCode: 429, statusMessage: 'Too many login attempts. Try again later.' })
    }
    throw createError({ statusCode: 401, statusMessage: 'Account or password is incorrect' })
  }

  await env.DB.prepare('DELETE FROM auth_login_attempts WHERE client_key = ?').bind(clientKey).run()
  return {
    accessToken: await createAccessToken(env),
    user: { id: CONFIGURED_ACCOUNT_ID, name: env.AUTH_ACCOUNT.trim() }
  }
})
