import { defineEventHandler, getRequestHeader, setHeader, setResponseStatus } from 'h3'
import { getEnv } from '../utils/cloudflare'

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin')
  const origins = getEnv(event).CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)

  if (origin && origins.includes(origin)) {
    setHeader(event, 'Access-Control-Allow-Origin', origin)
    setHeader(event, 'Vary', 'Origin')
    setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    setHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type')
    setHeader(event, 'Access-Control-Max-Age', 86400)
  }

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
