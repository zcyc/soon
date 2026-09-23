import { defineEventHandler, setHeader } from 'h3'
import { getCurrentUser, getEnv, type VideoRow } from '../utils/cloudflare'
import { mapVideosForClient } from '../utils/videos'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const env = getEnv(event)
  const { DB } = env
  const { results } = await DB.prepare(
    'SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all<VideoRow>()
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { videos: await mapVideosForClient(env, results) }
})
