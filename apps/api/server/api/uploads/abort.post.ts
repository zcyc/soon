import { AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../utils/cloudflare'
import { getR2Client } from '../../utils/r2'

function isMissingMultipartUpload(cause: unknown) {
  if (!cause || typeof cause !== 'object') return false
  const error = cause as { name?: string; $metadata?: { httpStatusCode?: number } }
  return error.name === 'NoSuchUpload' || error.$metadata?.httpStatusCode === 404
}

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const fileId = typeof body.fileId === 'string' ? body.fileId : ''
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : ''
  if (!fileId.startsWith(`${user.id}/`)) {
    throw createError({ statusCode: 400, statusMessage: 'Upload key is invalid' })
  }
  const referenced = await env.DB.prepare(
    'SELECT 1 FROM videos WHERE user_id = ? AND (file_id = ? OR thumbnail_file_id = ?) LIMIT 1'
  ).bind(user.id, fileId, fileId).first()
  if (referenced) throw createError({ statusCode: 409, statusMessage: 'Storage object is already attached to a video' })

  const client = getR2Client(env)
  if (uploadId) {
    try {
      await client.send(new AbortMultipartUploadCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileId,
        UploadId: uploadId
      }))
    } catch (cause) {
      // A lost CompleteMultipartUpload response leaves a finished object and a missing upload ID.
      if (!isMissingMultipartUpload(cause)) throw cause
    }
  }

  await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: fileId }))
  return { success: true }
})
