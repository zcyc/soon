import { defineEventHandler, setHeader } from 'h3'
import { getEnv, type VideoRow } from '../../utils/cloudflare'
import { mapVideosForClient } from '../../utils/videos'

export default defineEventHandler(async (event) => {
  const env = getEnv(event)
  const { DB } = env
  const { results } = await DB.prepare(
    'SELECT * FROM videos WHERE is_public = 1 AND is_publish = 1 ORDER BY created_at DESC LIMIT 50'
  ).all<VideoRow>()
  setHeader(event, 'Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  return { videos: await mapVideosForClient(env, results) }
})
