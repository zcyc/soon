# SOON

SOON is a browser screen recorder. The interface is Nuxt 4 + Nuxt UI and is deployed to Vercel. A standalone Nitro API Worker runs on Cloudflare and uses D1 for video metadata and R2 for media files. Supabase Auth remains the identity provider; D1 and R2 do not provide sign-in or OAuth.

## Local development

1. Install Node.js 20.19 or newer, then run `npm install`.
2. Copy `.env.example` to `.env` and set the Nuxt public API URL and Supabase project values.
3. Create the Cloudflare D1 database and R2 bucket described below. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set its values.
4. Apply the local D1 schema with `npm run db:migrate:local`.
5. Run `npm run dev:api` and `npm run dev` in separate terminals. Nuxt listens on port 3000 and Nitro on port 8787.

Screen capture requires HTTPS except on localhost. OAuth providers must allow `http://localhost:3000/auth/callback` as a Supabase redirect URL.

## Cloudflare API setup

From `apps/api`, create the resources:

```sh
npx wrangler d1 create soon
npx wrangler r2 bucket create soon-videos
```

Put the D1 ID returned by Wrangler in `apps/api/wrangler.jsonc`. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, and `CORS_ORIGINS` there. Replace the Vercel origin with the exact site origin (no trailing slash).

Create an R2 S3 access key, then add the credentials as Worker secrets:

```sh
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler d1 migrations apply soon --remote
npx wrangler r2 bucket cors set soon-videos --file r2-cors.json
npm run deploy
```

The R2 key is used only by the Worker to sign temporary upload and playback URLs. The browser never receives the key. Update the origins in `r2-cors.json` before applying it; the multipart uploader reads each R2 part's `ETag`, so keep `ETag` in `exposeHeaders`. The API also checks the Vercel origin against `CORS_ORIGINS`.

## Vercel frontend

Create a Vercel project from the repository root. Use `npm run build` as the build command; Vercel detects Nuxt and selects its Nitro Vercel output. Set these environment variables for Preview and Production:

```env
NUXT_PUBLIC_API_BASE=https://YOUR_API_WORKER.workers.dev
NUXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NUXT_PUBLIC_RECORDING_MAX_DURATION_SECONDS=120
```

Add the Vercel deployment domain and any custom domain to Supabase's allowed redirect URLs as `/auth/callback`, `CORS_ORIGINS`, and the R2 CORS origins.

## Existing account and video data

Supabase Auth accounts stay in the existing Supabase project. The D1 schema and follow-up changes are in `apps/api/migrations/`; apply all migrations before deploying the API. Existing video rows and storage objects are not copied automatically: export the old `videos`, `reactions`, and `activity_logs` rows into the new schema, and copy each old media object into R2 before switching traffic if those recordings must remain available. Keep the old Supabase database and storage bucket until that one-time migration is verified.

## Browser support

The app builds for ES2020 and Safari 15. Screen recording requires a secure context and browser support for `getDisplayMedia`; camera and microphone access use `getUserMedia`. The recorder checks these APIs and `MediaRecorder.isTypeSupported`, chooses a supported WebM or MP4 format, and presents an explanation when the selected browser cannot capture. Speech subtitles use browser speech recognition when available and can be exported as SRT or VTT. Screen sharing, speech recognition, and system-audio availability vary by browser and operating system. Local video uploads support files up to 5 GB; files larger than 64 MiB upload to R2 in multipart chunks.
