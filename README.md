# SOON

SOON is a browser screen recorder. The Nuxt 4 + Nuxt UI frontend is deployed to Vercel. A Nitro API Worker on Cloudflare uses D1 for video metadata and R2 for video files. Authentication uses one account and password configured as Cloudflare Worker secrets; there is no public registration or OAuth provider.

## Local development

1. Install Node.js 20.19 or newer and run `npm install`.
2. Copy `.env.example` to `.env`; `NUXT_PUBLIC_API_BASE` defaults to the local API.
3. Create the D1 database and R2 bucket below. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and configure the account, password, session secret, and R2 credentials.
4. Apply the local D1 schema with `npm run db:migrate:local`.
5. Run `npm run dev:api` and `npm run dev` in separate terminals. Nuxt listens on port 3000 and Nitro on port 8787.

Use a password of at least 12 characters and a random session secret of at least 32 bytes. Keep both in `apps/api/.dev.vars` locally and Cloudflare Worker secrets in deployment. Never put them in Nuxt `NUXT_PUBLIC_*` variables.

Screen capture requires HTTPS except on localhost.

## Cloudflare API setup

From `apps/api`, create the resources:

```sh
npx wrangler d1 create soon
npx wrangler r2 bucket create soon-videos
```

Put the D1 ID returned by Wrangler in `apps/api/wrangler.jsonc`. Set `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, and `CORS_ORIGINS` there. Replace the Vercel origin with the exact site origin, without a trailing slash.

Set credentials as Worker secrets, then apply the D1 migrations and R2 CORS policy:

```sh
npx wrangler secret put AUTH_ACCOUNT
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler d1 migrations apply soon --remote
npx wrangler r2 bucket cors set soon-videos --file r2-cors.json
npm run deploy
```

The R2 key is used only by the Worker to sign temporary upload and playback URLs. The browser never receives it. Update the origins in `r2-cors.json` before applying it; multipart uploads read each R2 part's `ETag`, so keep `ETag` in `exposeHeaders`. The API also checks the frontend origin against `CORS_ORIGINS`.

## Vercel frontend

Create a Vercel project from the repository root and use `npm run build`. Set these environment variables for Preview and Production:

```env
NUXT_PUBLIC_API_BASE=https://YOUR_API_WORKER.workers.dev
NUXT_PUBLIC_RECORDING_MAX_DURATION_SECONDS=120
```

The frontend sends login credentials to the API Worker, which returns a signed 12-hour session token. The browser stores that bearer token locally; changing `AUTH_SESSION_SECRET` invalidates all existing sessions.

## Existing video data

Migration `0003_configured_account_auth.sql` adds login throttling and leaves all existing owner IDs unchanged. The configured login is one principal; the D1 schema retains per-user ownership fields for future accounts. Existing private videos owned by earlier account IDs stay in D1/R2, but are not listed under this new principal until an explicit ownership mapping is made.

## Browser support

The app builds for ES2020 and Safari 15. Screen recording requires a secure context and browser support for `getDisplayMedia`; camera and microphone access use `getUserMedia`. The recorder checks these APIs and `MediaRecorder.isTypeSupported`, chooses a supported WebM or MP4 format, and reports when the selected browser cannot capture. Speech subtitles use browser speech recognition when available. Screen sharing, speech recognition, and system-audio availability vary by browser and operating system. Local video uploads support files up to 5 GB; files larger than 64 MiB upload to R2 in multipart chunks.
