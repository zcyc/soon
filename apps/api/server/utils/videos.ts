import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { WorkerEnv, VideoRow } from './cloudflare'
import { mapVideo } from './cloudflare'
import { getR2Client } from './r2'

export async function mapVideoForClient(env: WorkerEnv, row: VideoRow, client?: ReturnType<typeof getR2Client>) {
  const video = mapVideo(row)
  if (!row.thumbnail_file_id) return video

  video.thumbnailUrl = await getSignedUrl(client || getR2Client(env), new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: row.thumbnail_file_id
  }), { expiresIn: 3600 })
  return video
}

export async function mapVideosForClient(env: WorkerEnv, rows: VideoRow[]) {
  if (!rows.some(row => row.thumbnail_file_id)) return rows.map(mapVideo)
  const client = getR2Client(env)
  return await Promise.all(rows.map(row => mapVideoForClient(env, row, client)))
}
