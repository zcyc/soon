import { defineEventHandler, setHeader } from 'h3'
import { getEnv, requireAdmin } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { DB } = getEnv(event)
  const [accounts, setting] = await Promise.all([
    DB.prepare('SELECT id, account, role, is_active, created_at FROM users ORDER BY created_at ASC, account ASC')
      .all<{ id: string; account: string; role: 'admin' | 'user'; is_active: number; created_at: string }>(),
    DB.prepare("SELECT value FROM system_settings WHERE key = 'allow_registration'").first<{ value: string }>()
  ])
  return {
    accounts: accounts.results.map(account => ({
      id: account.id,
      account: account.account,
      role: account.role,
      isActive: account.is_active === 1,
      createdAt: account.created_at
    })),
    allowRegistration: setting?.value === 'true'
  }
})
