import { defineEventHandler, setHeader } from 'h3'
import { getEnv } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { DB } = getEnv(event)
  const setting = await DB.prepare("SELECT value FROM system_settings WHERE key = 'allow_registration'")
    .first<{ value: string }>()
  return {
    registrationAllowed: setting?.value === 'true'
  }
})
