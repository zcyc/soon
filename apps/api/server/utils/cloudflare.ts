import { createError, readBody, type H3Event } from 'h3'
import { verifyAccessToken } from './auth'

export interface VideoRow {
  id: string
  created_at: string
  updated_at: string
  title: string
  file_id: string
  quality: string
  user_id: string
  user_name: string
  duration: number
  views: number
  is_public: number
  is_publish: number
  thumbnail_url: string
  thumbnail_file_id: string | null
  subtitle_file_id: string | null
}

export type WorkerEnv = Cloudflare.Env

export function getEnv(event: H3Event): WorkerEnv {
  const env = (event.context as { cloudflare?: { env?: WorkerEnv } }).cloudflare?.env
  if (!env?.DB || !env.MEDIA) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudflare D1/R2 bindings are missing' })
  }
  return env
}

export async function readObjectBody(event: H3Event): Promise<Record<string, unknown>> {
  const body = await readBody<unknown>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be an object' })
  }
  return body as Record<string, unknown>
}

export interface CurrentUser {
  id: string
  name: string
}

export function getCurrentUser(event: H3Event): Promise<CurrentUser>
export function getCurrentUser(event: H3Event, optional: true): Promise<CurrentUser | null>
export async function getCurrentUser(event: H3Event, optional = false): Promise<CurrentUser | null> {
  const authorization = getRequestHeader(event, 'authorization')
  if (!authorization || !/^Bearer /i.test(authorization)) {
    if (optional) return null
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' })
  }

  const token = authorization.slice(7).trim()
  if (!token) {
    if (optional) return null
    throw createError({ statusCode: 401, statusMessage: 'Your session has expired' })
  }

  const user = await verifyAccessToken(getEnv(event), token)
  if (!user && !optional) throw createError({ statusCode: 401, statusMessage: 'Your session has expired' })
  return user
}

export function mapVideo(row: VideoRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    fileId: row.file_id,
    quality: row.quality,
    userId: row.user_id,
    userName: row.user_name,
    duration: row.duration,
    views: row.views,
    isPublic: Boolean(row.is_public),
    isPublish: Boolean(row.is_publish),
    thumbnailUrl: row.thumbnail_url,
    subtitleFileId: row.subtitle_file_id
  }
}
