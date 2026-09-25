import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { assertAuthNotLocked, createAccessToken, getLoginClientKey, recordAuthAttempt, verifyPassword, type AuthUser } from '../../utils/auth'
import { getEnv, readObjectBody } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const account = typeof body.account === 'string' ? body.account.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const inputIsValid = account.length > 0 && account.length <= 128 && !/[\u0000-\u001f\u007f]/.test(account) && password.length <= 1024

  const now = Math.floor(Date.now() / 1000)
  const clientKey = await getLoginClientKey(env, `login:${getRequestHeader(event, 'cf-connecting-ip') || 'unknown'}`)
  await assertAuthNotLocked(env, clientKey, now)

  const row = inputIsValid
    ? await env.DB.prepare('SELECT id, account, password_hash, role, session_version FROM users WHERE account = ? AND is_active = 1')
      .bind(account).first<{ id: string; account: string; password_hash: string; role: AuthUser['role']; session_version: number }>()
    : null
  const passwordMatches = await verifyPassword(password.length <= 1024 ? password : '', row?.password_hash)
  if (!row || !passwordMatches) {
    if (await recordAuthAttempt(env, clientKey, now)) {
      throw createError({ statusCode: 429, statusMessage: 'Too many login attempts. Try again later.' })
    }
    throw createError({ statusCode: 401, statusMessage: 'Account or password is incorrect' })
  }

  await env.DB.prepare('DELETE FROM auth_login_attempts WHERE client_key = ?').bind(clientKey).run()
  const user: AuthUser = { id: row.id, name: row.account, role: row.role, sessionVersion: row.session_version }
  return { accessToken: await createAccessToken(env, user), user: { id: user.id, name: user.name, role: user.role } }
})
