import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../../utils/cloudflare'
import { getR2Client } from '../../../utils/r2'

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const fileName = typeof body.fileName === 'string' ? body.fileName : ''
  const size = body.size
  if (!contentType.startsWith('video/') || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 64 * 1024 * 1024 || size > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart upload size or type is invalid' })
  }

  const extension = fileName.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || 'video'
  const fileId = `${user.id}/${crypto.randomUUID()}.${extension}`
  const result = await getR2Client(env).send(new CreateMultipartUploadCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileId,
    ContentType: contentType
  }))
  if (!result.UploadId) throw createError({ statusCode: 502, statusMessage: 'Could not start the upload' })
  return { fileId, uploadId: result.UploadId }
})
