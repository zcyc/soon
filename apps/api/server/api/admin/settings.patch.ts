import { createError, defineEventHandler } from 'h3'
import { getEnv, readObjectBody, requireAdmin } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readObjectBody(event)
  if (typeof body.allowRegistration !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'allowRegistration must be a boolean' })
  }
  await getEnv(event).DB.prepare("UPDATE system_settings SET value = ? WHERE key = 'allow_registration'")
    .bind(body.allowRegistration ? 'true' : 'false').run()
  return { allowRegistration: body.allowRegistration }
})
