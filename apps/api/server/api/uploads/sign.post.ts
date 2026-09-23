import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../utils/cloudflare'
import { getR2Client } from '../../utils/r2'

const MAX_VIDEO_SIZE = 64 * 1024 * 1024
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const size = body.size
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'File size is invalid' })
  }
  if (contentType === 'image/jpeg' ? size > MAX_THUMBNAIL_SIZE : !contentType.startsWith('video/') || size > MAX_VIDEO_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'File type or size is not supported for direct upload' })
  }

  const fileName = typeof body.fileName === 'string' ? body.fileName : ''
  const extension = contentType === 'image/jpeg' ? 'jpg' : fileName.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || 'video'
  const fileId = `${user.id}/${crypto.randomUUID()}.${extension}`
  const uploadUrl = await getSignedUrl(getR2Client(env), new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileId,
    ContentType: contentType
  }), { expiresIn: 900 })
  return { fileId, uploadUrl }
})
