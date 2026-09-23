import { defineEventHandler, getRouterParam } from 'h3'
import { getCurrentUser, getEnv } from '../../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event, true)
  const { DB } = getEnv(event)
  const id = getRouterParam(event, 'id')
  await DB.prepare(`
    UPDATE videos SET views = views + 1
    WHERE id = ? AND is_public = 1 AND (? IS NULL OR user_id != ?)
  `).bind(id || '', user?.id || null, user?.id || null).run()
  return { success: true }
})
