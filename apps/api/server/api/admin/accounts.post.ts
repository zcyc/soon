import { createError, defineEventHandler } from 'h3'
import { hashPassword } from '../../utils/auth'
import { getEnv, readObjectBody, requireAdmin } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const account = typeof body.account === 'string' ? body.account.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role === 'admin' ? 'admin' : body.role === 'user' || body.role === undefined ? 'user' : null
  if (!account || account.length > 128 || /[\u0000-\u001f\u007f]/.test(account) || password.length < 12 || password.length > 1024 || !role) {
    throw createError({ statusCode: 400, statusMessage: 'Account, role or password is invalid' })
  }

  const passwordHash = await hashPassword(password)
  const created = await env.DB.prepare(`
    INSERT INTO users (id, account, password_hash, role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account) DO NOTHING
    RETURNING id, account, role, is_active, created_at
  `).bind(crypto.randomUUID(), account, passwordHash, role)
    .first<{ id: string; account: string; role: 'admin' | 'user'; is_active: number; created_at: string }>()
  if (!created) throw createError({ statusCode: 409, statusMessage: 'Account already exists' })

  return {
    id: created.id,
    account: created.account,
    role: created.role,
    isActive: created.is_active === 1,
    createdAt: created.created_at
  }
})
