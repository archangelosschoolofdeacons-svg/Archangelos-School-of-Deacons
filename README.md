# Archangelos School of Deacons

This repository keeps the existing bilingual static site and connects its public library and administrator tools to the existing Cloudflare Worker, D1 database, and R2 bucket.

## Deployment

### GitHub Pages frontend

Publish the contents of this directory at the root of the existing GitHub Pages repository. Keep `index.html`, `app.js`, `localization.js`, `styles.css`, `sw.js`, the manifest files, and `assets/` together. No build step is required. The API base is already set to:

`https://archangelos-deacons-api-2026.archangelosschoolofdeacons.workers.dev`

### Cloudflare Worker

The deploy config is in `worker/wrangler.toml`. Before deployment, replace only `REPLACE_WITH_EXISTING_DATABASE_ID` with the ID of the existing `archangelos-content` database. Do not create a second D1 database or R2 bucket. Confirm the Worker bindings are `DB` -> `archangelos-content` and `MEDIA` -> `archangelos-media`.

From a terminal with Node.js 20 or newer:

```powershell
cd worker
npm install
npx wrangler whoami
npx wrangler deploy
```

`npm install` installs the project-local Wrangler CLI. If `npx wrangler whoami` reports that the account is not authenticated, run `npx wrangler login` and then retry. Find the existing D1 database ID in Cloudflare Dashboard; do not run `wrangler d1 create`.

The current `ADMIN_PASSWORD` secret on the existing Worker is retained when the same Worker is redeployed. Check it in Cloudflare Dashboard or with `npx wrangler secret list`; only run `npx wrangler secret put ADMIN_PASSWORD` if it is missing or needs rotation. Wrangler prompts for the value. Never put it in this repository, a command line argument, or frontend code. `ADMIN_USERNAME=admin` and the exact GitHub Pages origin are ordinary Worker variables in `wrangler.toml`.

The Worker serves the API and media from its existing `workers.dev` URL. GitHub Pages serves only the static frontend. Do not use the legacy `server.py`, Render, or Vercel configuration for this deployment.

## Database and manual actions

No resources are reset and no resource-table migration is included. The Worker reads the existing `resources` columns and writes `id`, `title`, `description`, `grade_id`, `subject_id`, `term_id`, `kind`, `url`, `file_name`, and `updated_at`. Existing external HTTP(S) links remain public; uploaded files use random `resources/<uuid>.<ext>` keys and the Worker media route.

Uploads use the existing `uploads` columns (`id`, `objectKey`, `uploadId`, `metadataJson`, `expectedSize`, `contentType`, `createdAt`, `owner`) and `upload_parts` columns (`uploadId`, `partNumber`, `etag`). No upload migration is required for those schemas.

The Worker inspects `admin_sessions` and supports token columns such as `tokenHash`, `token_hash`, `sessionTokenHash`, `session_token_hash`, `sessionHash`, `session_hash`, `sessionId`, `session_id`, or `token`; CSRF columns such as `csrfToken`, `csrf_token`, `csrf`, `csrfHash`, or `csrf_token_hash`; and expiry columns such as `expiresAt`, `expires_at`, `expiresAtMs`, `expires_at_ms`, `expires`, or `expiry`. It stores a SHA-256 digest of the bearer token, checks expiry server-side, and stores the CSRF token (or its digest for a CSRF-hash column). If the existing table has no compatible fields, inspect it first with `PRAGMA table_info(admin_sessions);` and add only missing columns. For example, if all three are missing:

```sql
ALTER TABLE admin_sessions ADD COLUMN tokenHash TEXT;
ALTER TABLE admin_sessions ADD COLUMN csrfToken TEXT;
ALTER TABLE admin_sessions ADD COLUMN expiresAt TEXT;
```

If the `admin_sessions` table itself is absent, create that table rather than a second session table:

```sql
CREATE TABLE admin_sessions (
  tokenHash TEXT PRIMARY KEY,
  csrfToken TEXT NOT NULL,
  username TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
```

Do not run the `ALTER TABLE` statements for columns that already exist. No other SQL migration is required by this implementation.

## Upload limits

Files are uploaded sequentially in parts. The usual part is 8 MiB; the Worker raises the part size for very large files, up to 64 MiB, to stay within R2's 10,000-part limit. The configured application cap is 625 GiB. This is a code limit, not a promise that the account can store or serve a file of that size. R2 documents a 5 MiB minimum part size (except the final part), a 5 GiB maximum part size, at most 10,000 parts, and a 5 TiB maximum multipart object. [Cloudflare R2 multipart upload documentation](https://developers.cloudflare.com/r2/objects/upload-objects/)

The Worker receives one part per request rather than a whole video. Cloudflare's documented maximum request body size varies by account plan (currently 100 MB for Free/Pro, 200 MB for Business, and up to 5 GB for Enterprise); account-specific limits, Worker request quotas, R2 storage and operation quotas, and bandwidth still apply. The configured 64 MiB maximum part is below those documented request-body limits, but confirm the account's current settings before publishing large files. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## Local checks

```powershell
cd worker
npm test
npm run check
node --check ../app.js
node --check ../localization.js
```

The frontend is plain static HTML and JavaScript. Public resources and media requests do not send administrator credentials. The bearer token and CSRF token are held in tab-scoped `sessionStorage`; every write is validated by the Worker. The password is never part of the frontend.
