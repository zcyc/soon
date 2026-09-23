import { defineEventHandler, createError, getRouterParam } from 'h3'
import { getCurrentUser, getEnv } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const id = getRouterParam(event, 'id')
  const row = await env.DB.prepare('SELECT file_id, thumbnail_file_id, user_id FROM videos WHERE id = ?').bind(id || '').first<{
    file_id: string
    thumbnail_file_id: string | null
    user_id: string
  }>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  if (row.user_id !== user.id) throw createError({ statusCode: 403, statusMessage: 'You cannot delete this video' })

  try {
    await env.MEDIA.delete(row.file_id)
  } catch (error) {
    console.error('R2 video deletion failed; keeping the D1 record', { id, error })
    throw createError({ statusCode: 502, statusMessage: 'Video storage could not be deleted' })
  }
  if (row.thumbnail_file_id) {
    try {
      await env.MEDIA.delete(row.thumbnail_file_id)
    } catch (error) {
      console.error('R2 thumbnail deletion failed', { id, error })
    }
  }
  await env.DB.prepare('DELETE FROM videos WHERE id = ? AND user_id = ?').bind(id || '', user.id).run()
  return { success: true }
})
