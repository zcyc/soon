import { AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../utils/cloudflare'
import { getR2Client } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const fileId = typeof body.fileId === 'string' ? body.fileId : ''
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : ''
  if (!fileId.startsWith(`${user.id}/`)) {
    throw createError({ statusCode: 400, statusMessage: 'Upload key is invalid' })
  }
  if (uploadId) {
    await getR2Client(env).send(new AbortMultipartUploadCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: fileId,
      UploadId: uploadId
    }))
  } else {
    const referenced = await env.DB.prepare(
      'SELECT 1 FROM videos WHERE user_id = ? AND (file_id = ? OR thumbnail_file_id = ?) LIMIT 1'
    ).bind(user.id, fileId, fileId).first()
    if (referenced) throw createError({ statusCode: 409, statusMessage: 'Storage object is already attached to a video' })
    await getR2Client(env).send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: fileId }))
  }
  return { success: true }
})
