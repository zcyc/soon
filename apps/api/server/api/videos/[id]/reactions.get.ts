import { defineEventHandler, createError, getRouterParam, setHeader } from 'h3'
import { getCurrentUser, getEnv, type VideoRow } from '../../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { DB } = getEnv(event)
  const id = getRouterParam(event, 'id')
  const video = await DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id || '').first<VideoRow>()
  if (!video) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  const user = await getCurrentUser(event, true)
  if (!video.is_public && user?.id !== video.user_id) {
    throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  }
  const { results } = await DB.prepare(`
    SELECT emoji, COUNT(*) AS count, SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
    FROM reactions WHERE video_id = ? GROUP BY emoji
  `).bind(user?.id || '', id || '').all<{ emoji: string; count: number; mine: number }>()
  return { reactions: results.map(item => ({ ...item, mine: item.mine > 0 })) }
})
