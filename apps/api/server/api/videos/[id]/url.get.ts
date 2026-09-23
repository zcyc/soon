import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { defineEventHandler, createError, getQuery, getRouterParam } from 'h3'
import { getCurrentUser, getEnv, type VideoRow } from '../../../utils/cloudflare'
import { getR2Client } from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const id = getRouterParam(event, 'id')
  const row = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id || '').first<VideoRow>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video not found' })

  const user = await getCurrentUser(event, true)
  if (!row.is_public && user?.id !== row.user_id) {
    throw createError({ statusCode: 404, statusMessage: 'Video not found' })
  }
  const download = getQuery(event).download === '1'
  const url = await getSignedUrl(getR2Client(env), new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: row.file_id,
    ...(download ? { ResponseContentDisposition: 'attachment; filename="soon-recording"' } : {})
  }), { expiresIn: 3600 })
  return { url }
})
