import { defineEventHandler, setHeader } from 'h3'
import { getCurrentUser } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return await getCurrentUser(event)
})
