import { defineEventHandler, setHeader } from 'h3'
import { getEnv } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { DB } = getEnv(event)
  const result = await DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) AS user_count,
      (SELECT value FROM system_settings WHERE key = 'allow_registration') AS allow_registration
  `).first<{ user_count: number; allow_registration: string | null }>()
  const setupRequired = !result || result.user_count === 0
  return {
    setupRequired,
    registrationAllowed: !setupRequired && result.allow_registration === 'true'
  }
})
