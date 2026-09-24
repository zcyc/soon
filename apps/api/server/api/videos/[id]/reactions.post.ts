import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getCurrentUser, getEnv, readObjectBody, type VideoRow } from '../../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const { DB } = getEnv(event)
  const id = getRouterParam(event, 'id')
  const body = await readObjectBody(event)
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : ''
  if (!emoji || emoji.length > 16) throw createError({ statusCode: 400, statusMessage: 'Reaction is invalid' })

  const video = await DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id || '').first<VideoRow>()
  if (!video) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  if (!video.is_public && user.id !== video.user_id) {
    throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  }

  const existing = await DB.prepare('SELECT id FROM reactions WHERE video_id = ? AND user_id = ? AND emoji = ?')
    .bind(id || '', user.id, emoji).first<{ id: string }>()
  if (existing) {
    await DB.prepare('DELETE FROM reactions WHERE id = ?').bind(existing.id).run()
    return { active: false }
  }

  const userName = user.name.slice(0, 100)
  await DB.prepare('INSERT OR IGNORE INTO reactions (id, video_id, user_id, user_name, emoji) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id || '', user.id, userName, emoji).run()
  return { active: true }
})
