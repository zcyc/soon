import { defineEventHandler, createError, getRouterParam, setHeader } from 'h3'
import { getCurrentUser, getEnv, type VideoRow } from '../../utils/cloudflare'
import { mapVideoForClient } from '../../utils/videos'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const { DB } = env
  const id = getRouterParam(event, 'id')
  const row = await DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id || '').first<VideoRow>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video not found' })

  const user = await getCurrentUser(event, true)
  if (!row.is_public && user?.id !== row.user_id) {
    throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  }
  setHeader(event, 'Cache-Control', user?.id === row.user_id ? 'private, no-store' : 'public, max-age=30')
  return { video: await mapVideoForClient(env, row) }
})
