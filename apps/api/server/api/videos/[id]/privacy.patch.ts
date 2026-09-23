import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getCurrentUser, getEnv, readObjectBody, type VideoRow } from '../../../utils/cloudflare'
import { mapVideoForClient } from '../../../utils/videos'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const { DB } = env
  const id = getRouterParam(event, 'id')
  const body = await readObjectBody(event)
  if (typeof body.isPublic !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Privacy setting is invalid' })
  }
  const current = await DB.prepare('SELECT user_id FROM videos WHERE id = ?').bind(id || '').first<{ user_id: string }>()
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  if (current.user_id !== user.id) throw createError({ statusCode: 403, statusMessage: 'You cannot edit this video' })

  await DB.prepare("UPDATE videos SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
    .bind(body.isPublic ? 1 : 0, id || '', user.id).run()
  const updated = await DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id || '').first<VideoRow>()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  return { video: await mapVideoForClient(env, updated) }
})
