import { S3Client } from '@aws-sdk/client-s3'
import type { WorkerEnv } from './cloudflare'

export function getR2Client(env: WorkerEnv) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY
    }
  })
}
