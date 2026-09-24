import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody, type VideoRow } from '../utils/cloudflare'
import { mapVideoForClient } from '../utils/videos'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const fileId = typeof body.fileId === 'string' ? body.fileId : ''
  const duration = body.duration
  const quality = typeof body.quality === 'string' ? body.quality : '1080p'
  const thumbnailFileId = typeof body.thumbnailFileId === 'string' ? body.thumbnailFileId : ''

  if (
    !title || title.length > 160 || !fileId || !fileId.startsWith(`${user.id}/`) ||
    typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 ||
    !['720p', '1080p', 'original'].includes(quality)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Video details are invalid' })
  }
  const video = await env.MEDIA.head(fileId)
  if (!video || video.size <= 0 || video.size > 5 * 1024 * 1024 * 1024 || !video.httpMetadata?.contentType?.startsWith('video/')) {
    throw createError({ statusCode: 400, statusMessage: 'Uploaded video was not found' })
  }
  if (thumbnailFileId) {
    if (!thumbnailFileId.startsWith(`${user.id}/`)) {
      throw createError({ statusCode: 400, statusMessage: 'Thumbnail key is invalid' })
    }
    const thumbnail = await env.MEDIA.head(thumbnailFileId)
    if (!thumbnail || thumbnail.size <= 0 || thumbnail.size > 2 * 1024 * 1024 || thumbnail.httpMetadata?.contentType !== 'image/jpeg') {
      throw createError({ statusCode: 400, statusMessage: 'Uploaded thumbnail is invalid' })
    }
  }

  const id = crypto.randomUUID()
  const userName = user.name.slice(0, 100)
  await env.DB.prepare(`
    INSERT INTO videos (id, title, file_id, quality, user_id, user_name, duration, is_public, is_publish, thumbnail_file_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    title,
    fileId,
    quality,
    user.id,
    userName,
    duration,
    body.isPublic === true ? 1 : 0,
    body.isPublish === true ? 1 : 0,
    thumbnailFileId || null
  ).run()

  const row = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<VideoRow>()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Video record was not saved' })
  return { video: await mapVideoForClient(env, row) }
})
