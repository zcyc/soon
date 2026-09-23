import { UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { defineEventHandler, createError } from 'h3'
import { getCurrentUser, getEnv, readObjectBody } from '../../../utils/cloudflare'
import { getR2Client } from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const body = await readObjectBody(event)
  const fileId = typeof body.fileId === 'string' ? body.fileId : ''
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : ''
  const partNumber = body.partNumber
  if (!fileId.startsWith(`${user.id}/`) || !uploadId || typeof partNumber !== 'number' || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    throw createError({ statusCode: 400, statusMessage: 'Upload part is invalid' })
  }

  const url = await getSignedUrl(getR2Client(env), new UploadPartCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileId,
    UploadId: uploadId,
    PartNumber: partNumber
  }), { expiresIn: 900 })
  return { url }
})
