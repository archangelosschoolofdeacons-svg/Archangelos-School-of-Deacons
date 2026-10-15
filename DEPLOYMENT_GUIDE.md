# Deployment Guide

## Current deployment status

The project is configured for one Cloudflare Worker to serve the PWA, API, and media. D1 stores records and sessions; a private R2 bucket stores uploads. The source has a zero placeholder in `wrangler.jsonc` for the D1 database ID. No live Cloudflare account, bucket, D1 database, or production secret was available during this audit, so deployment and live storage are still unverified.

R2 requires an account subscription checkout and a primary payment method. Standard storage and operation allowances are included monthly, but usage above those allowances is metered. The application cap covers only this project's tracked files and cannot cap other R2 use in the account. Review [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [R2 setup](https://developers.cloudflare.com/r2/get-started/) before enabling the bucket.

## Configuration

| Name | Where it is configured | Required value |
| --- | --- | --- |
| `DB` | D1 binding in `wrangler.jsonc` | Existing or newly created `archangelos-school-content` database; replace the zero placeholder with its actual ID. |
| `MEDIA` | R2 binding in `wrangler.jsonc` | Private bucket named `archangelos-school-materials`. |
| `ASSETS` | Static assets binding | `./public`; already configured. |
| `ARCHANGELOS_ADMIN_PASSWORD` | Worker secret | Unique password of at least 12 characters. This is required for administrator sign-in. |
| `ARCHANGELOS_ADMIN_USERNAME` | Worker variable in `wrangler.jsonc` | Defaults to `admin`; change it if desired. |
| `MAX_UPLOAD_BYTES` | Worker variable in `wrangler.jsonc` | Defaults to 5 GiB per file. |
| `MAX_STORAGE_BYTES` | Worker variable in `wrangler.jsonc` | Defaults to 8,000,000,000 tracked bytes. |

This implementation does not use Backblaze B2 credentials, R2 S3 keys, browser storage keys, a separate CORS origin, or a database password. The Worker bindings keep storage access server-side, and the bucket remains private.

## Local development

Run from the project root with Node.js 22 or newer:

```powershell
npm ci
if (-not (Test-Path .dev.vars)) { Copy-Item .dev.vars.example .dev.vars }
```

Set a local-only `ARCHANGELOS_ADMIN_PASSWORD` in `.dev.vars`; do not commit that file. Initialize local D1 and start the site:

```powershell
npm run db:migrate:local
npm run dev
```

Open the local URL printed by Wrangler and visit `#/admin`. Local D1/R2 state is under `.wrangler/`; it is separate from production. Run checks with:

```powershell
npm test
npm run check
python -m py_compile tools/backup_legacy.py tools/prepare_legacy_migration.py
```

## Cloudflare setup and deployment

1. In the Cloudflare dashboard, check whether the account already has the named bucket or database. Do not create duplicates or change an existing database until its data has been backed up and reviewed.
2. Decide whether to enable R2 billing. R2's free allowance does not cap account-wide costs. The application does not create resources automatically.
3. Create the private R2 bucket and D1 database if they do not already exist:

   ```powershell
   npx wrangler r2 bucket create archangelos-school-materials
   npx wrangler d1 create archangelos-school-content
   ```

4. Copy the actual D1 `database_id` returned by Wrangler into the `DB` entry in `wrangler.jsonc`, replacing `00000000-0000-0000-0000-000000000000`. Keep the database and bucket names aligned with the configured bindings.
5. Apply the schema to a new, empty D1 database. If using an existing database, export and verify a backup first; do not apply the initial schema to production data without reviewing the migration plan.

   ```powershell
   npx wrangler d1 migrations apply archangelos-school-content --remote
   ```

6. Set the administrator password as a Worker secret. Wrangler prompts for the value; it will not be included in source or the browser bundle.

   ```powershell
   npx wrangler secret put ARCHANGELOS_ADMIN_PASSWORD
   npx wrangler secret list
   ```

7. Deploy the Worker and static assets:

   ```powershell
   npm run deploy
   ```

The configured `workers_dev` endpoint serves the PWA and API on the same origin. No public `r2.dev` URL, bucket CORS rule, or R2 key is needed. Attach a custom domain only if you already own one and have reviewed any associated cost.

## Post-deployment verification

1. Open the Worker URL and confirm the home page, Arabic RTL layout, English switch, and static assets load.
2. Confirm public API reads work:

   ```powershell
   curl.exe -i https://<worker-host>/api/resources
   curl.exe -i https://<worker-host>/api/config
   ```

3. Sign in at `#/admin` with the configured username and password. Upload isolated audio, image, PDF, and short video fixtures. Confirm audio playback, image/PDF display, and video playback.
4. For an uploaded video, verify a byte-range request returns `206 Partial Content` and a download uses `Content-Disposition: attachment`:

   ```powershell
   curl.exe -i -H "Range: bytes=0-63" "https://<worker-host>/media/<test-resource-id>"
   curl.exe -I "https://<worker-host>/media/<test-resource-id>?download=1"
   ```

5. Only after those checks pass, test one isolated video larger than 500 MB. Confirm its final byte range and download, and verify the stored size against D1. The application is configured for multipart uploads, but this audit did not run a live large-file upload.
6. Remove only the isolated test records created for this check. Keep existing user content intact.

## Existing legacy data

The supplied archive's legacy SQLite database is valid but contains zero resource rows, and its uploads folder is empty. This does not prove a separate deployed service is empty. If that service has data, keep it running, download its database and complete uploads directory, then use `tools/backup_legacy.py` and `tools/prepare_legacy_migration.py` to produce a reviewable backup and migration pack. Import only into a new, empty R2 bucket and D1 database after verifying the backup and generated files. Do not overwrite the old database, uploads, or host during migration.
