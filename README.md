# SOON

SOON is a browser screen recorder. The Nuxt 4 + Nuxt UI frontend is deployed to Vercel. A Nitro API Worker on Cloudflare uses D1 for video metadata and account credentials, and R2 for video files. The first visit creates the administrator account; public registration is disabled by default and can be managed from `/admin/accounts`.

## Local development

1. Install Node.js 20.19 or newer and run `npm install`.
2. Copy `.env.example` to `.env`; `NUXT_PUBLIC_API_BASE` defaults to the local API.
3. Create the D1 database and R2 bucket below. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and configure the session secret, one-time setup token, and R2 credentials.
4. Apply the local D1 schema with `npm run db:migrate:local`.
5. Run `npm run dev:api` and `npm run dev` in separate terminals. Nuxt listens on port 3000 and Nitro on port 8787.

Use random `AUTH_SESSION_SECRET` and `AUTH_SETUP_TOKEN` values of at least 32 bytes. The setup token is only for the first administrator and can be removed immediately after setup. Account passwords must be at least 12 characters; the API stores salted PBKDF2 hashes in D1, never plaintext passwords. Keep these values in `apps/api/.dev.vars` locally and as Cloudflare Worker secrets in deployment. Never put them in Nuxt `NUXT_PUBLIC_*` variables.

Screen capture requires HTTPS except on localhost.

## Cloudflare API setup

From `apps/api`, create the resources:

```sh
npx wrangler d1 create soon
npx wrangler r2 bucket create soon-videos
```

Put the D1 ID returned by Wrangler in `apps/api/wrangler.jsonc`. Set `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, and `CORS_ORIGINS` there. Replace the Vercel origin with the exact site origin, without a trailing slash.

Set the session and R2 credentials as Worker secrets, then apply the D1 migrations and R2 CORS policy:

```sh
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put AUTH_SETUP_TOKEN
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler d1 migrations apply soon --remote
npx wrangler r2 bucket cors set soon-videos --file r2-cors.json
npm run deploy
```

Remove the old fixed-login secrets from existing deployments (`npx wrangler secret delete AUTH_ACCOUNT` and `npx wrangler secret delete AUTH_PASSWORD`) after deploying this version. Generate a random `AUTH_SETUP_TOKEN`, set it as a Worker secret, and enter it at `/setup` with the first administrator account and password. Then delete `AUTH_SETUP_TOKEN`; setup is permanently closed after the first account is saved. Sign-in and registration are available at `/sign-in` and `/sign-up`; public registration starts disabled and administrators can change it from `/admin/accounts`.

The R2 key is used only by the Worker to sign temporary upload and playback URLs. The browser never receives it. Update the origins in `r2-cors.json` before applying it; multipart uploads read each R2 part's `ETag`, so keep `ETag` in `exposeHeaders`. The API also checks the frontend origin against `CORS_ORIGINS`.

## Vercel frontend

Create a Vercel project from the repository root and use `npm run build`. Set these environment variables for Preview and Production:

```env
NUXT_PUBLIC_API_BASE=https://YOUR_API_WORKER.workers.dev
NUXT_PUBLIC_RECORDING_MAX_DURATION_SECONDS=120
```

The frontend sends login credentials to the API Worker, which returns a signed 12-hour session token. The browser stores that bearer token locally. The API checks the account's active state and role in D1 on authenticated requests. Changing `AUTH_SESSION_SECRET` invalidates all existing sessions.

## Existing video data

Migration `0003_configured_account_auth.sql` adds login throttling; `0004_database_accounts.sql` adds D1 accounts and settings. Existing video owner IDs are left unchanged. Videos owned by the former fixed `configured-account` principal are not automatically reassigned to the first administrator, so they remain stored in D1/R2 but do not appear in a newly created account's library.

## Browser support

The app builds for ES2020 and Safari 15. Screen recording requires a secure context and browser support for `getDisplayMedia`; camera and microphone access use `getUserMedia`. The recorder checks these APIs and `MediaRecorder.isTypeSupported`, chooses a supported WebM or MP4 format, and reports when the selected browser cannot capture. Speech subtitles use browser speech recognition when available. Screen sharing, speech recognition, and system-audio availability vary by browser and operating system. Local video uploads support files up to 5 GB; files larger than 64 MiB upload to R2 in multipart chunks.
