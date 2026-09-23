import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../../utils/cloudflare'
import { getR2Client } from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const fileId = typeof body.fileId === 'string' ? body.fileId : ''
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : ''
  const parts = body.parts
  if (!fileId.startsWith(`${user.id}/`) || !uploadId || !Array.isArray(parts) || parts.length < 2 || parts.length > 10000) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart upload details are invalid' })
  }

  const completedParts = parts.map((part: unknown, index) => {
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      throw createError({ statusCode: 400, statusMessage: 'Multipart upload part is invalid' })
    }
    const item = part as Record<string, unknown>
    if (item.partNumber !== index + 1 || typeof item.etag !== 'string' || item.etag.length === 0 || item.etag.length > 128) {
      throw createError({ statusCode: 400, statusMessage: 'Multipart upload part is invalid' })
    }
    return { PartNumber: item.partNumber, ETag: item.etag }
  })

  await getR2Client(env).send(new CompleteMultipartUploadCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileId,
    UploadId: uploadId,
    MultipartUpload: { Parts: completedParts }
  }))
  return { success: true }
})
