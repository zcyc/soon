import { defineEventHandler, createError, getRouterParam, setHeader } from 'h3'
import { getCurrentUser, getEnv, readObjectBody, type VideoRow } from '../../../utils/cloudflare'
import { mapVideoForClient } from '../../../utils/videos'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const { DB } = env
  const id = getRouterParam(event, 'id') || ''
  const body = await readObjectBody(event)
  if (typeof body.isPublish !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Discovery setting is invalid' })
  }

  await DB.prepare('UPDATE videos SET is_publish = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .bind(body.isPublish ? 1 : 0, id, user.id)
    .run()
  const row = await DB.prepare('SELECT * FROM videos WHERE id = ? AND user_id = ?').bind(id, user.id).first<VideoRow>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { video: await mapVideoForClient(env, row) }
})
