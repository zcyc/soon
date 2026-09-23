import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  srcDir: 'server',
  preset: 'cloudflare-module',
  compatibilityDate: '2026-09-23'
})
