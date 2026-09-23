import { defineEventHandler } from 'h3'
import { getEnv } from '../utils/cloudflare'

export default defineEventHandler((event) => {
  getEnv(event)
  return { status: 'ok' }
})
