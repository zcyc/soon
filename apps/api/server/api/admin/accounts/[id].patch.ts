import { createError, defineEventHandler, getRouterParam } from 'h3'
import { hashPassword } from '../../../utils/auth'
import { getEnv, readObjectBody, requireAdmin } from '../../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = getEnv(event)
  const id = getRouterParam(event, 'id')
  const body = await readObjectBody(event)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Account ID is required' })

  const requestedRole = body.role === undefined ? null : body.role === 'admin' || body.role === 'user' ? body.role : undefined
  const requestedActive = body.isActive === undefined ? null : typeof body.isActive === 'boolean' ? body.isActive : undefined
  const password = body.password === undefined ? null : typeof body.password === 'string' ? body.password : undefined
  if (requestedRole === undefined || requestedActive === undefined || password === undefined ||
      (password !== null && (password.length < 12 || password.length > 1024)) ||
      (requestedRole === null && requestedActive === null && password === null)) {
    throw createError({ statusCode: 400, statusMessage: 'Account update is invalid' })
  }

  const existing = await env.DB.prepare('SELECT role, is_active FROM users WHERE id = ?')
    .bind(id).first<{ role: 'admin' | 'user'; is_active: number }>()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  const role = requestedRole ?? existing.role
  const isActive = requestedActive ?? existing.is_active === 1
  if (id === admin.id && (role !== existing.role || !isActive)) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot change your own role or disable your own account' })
  }

  const passwordHash = password === null ? null : await hashPassword(password)
  const updated = await env.DB.prepare(`
    UPDATE users
    SET role = ?, is_active = ?, password_hash = COALESCE(?, password_hash),
      session_version = session_version + CASE WHEN ? IS NULL THEN 0 ELSE 1 END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (role <> 'admin' OR is_active <> 1 OR (? = 'admin' AND ? = 1)
        OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1) > 1)
    RETURNING id, account, role, is_active, created_at
  `).bind(role, isActive ? 1 : 0, passwordHash, passwordHash, id, role, isActive ? 1 : 0)
    .first<{ id: string; account: string; role: 'admin' | 'user'; is_active: number; created_at: string }>()
  if (!updated) throw createError({ statusCode: 409, statusMessage: 'The last active administrator cannot be demoted or disabled' })

  return {
    id: updated.id,
    account: updated.account,
    role: updated.role,
    isActive: updated.is_active === 1,
    createdAt: updated.created_at
  }
})
