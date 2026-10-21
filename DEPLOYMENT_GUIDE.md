# Deployment Guide

## Current deployment status

Published on 18 October 2026 at [archangelos-school-of-deacons.archangelosschoolofdeacons.workers.dev](https://archangelos-school-of-deacons.archangelosschoolofdeacons.workers.dev/), Worker version `aa399226-4969-4f0b-ad8c-9b4c6a48040b`. The Worker uses the existing D1 database `archangelos-content` and R2 bucket `archangelos-media`. No Cloudflare resources were created and no billing settings were changed.

The D1 database already contained lesson data. Before applying migrations `0003`–`0006`, a SQL export was saved to `.wrangler/production-pre-migration-2026-10-18.sql` and restored into an in-memory SQLite database for verification. `PRAGMA integrity_check` returned `ok`; the export retained 7 resources and 7 media records (39,976,832 tracked bytes). All four pending additive migrations applied successfully. The administrator password is configured as a Worker secret and is not stored in this repository.

Cloudflare confirmed the deployment. Direct HTTP checks from the deployment environment timed out, so the homepage and public API responses still need a browser check from a network that can reach the `workers.dev` address.

R2 requires an account subscription checkout and a primary payment method. Standard storage and operation allowances are included monthly, but usage above those allowances is metered. The application cap covers only this project's tracked files and cannot cap other R2 use in the account. Review [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [R2 setup](https://developers.cloudflare.com/r2/get-started/) before enabling the bucket.

## Configuration

| Name | Where it is configured | Required value |
| --- | --- | --- |
| `DB` | D1 binding in `wrangler.jsonc` | Existing production database `archangelos-content`. |
| `MEDIA` | R2 binding in `wrangler.jsonc` | Existing bucket `archangelos-media`, accessed through the Worker binding. |
| `ASSETS` | Static assets binding | `./public`; already configured. |
| `ARCHANGELOS_ADMIN_PASSWORD` | Worker secret | Unique password of at least 12 characters. This is required for administrator sign-in. |
| `VAPID_PUBLIC_KEY` | Worker secret | Uncompressed P-256 public key encoded as base64url; required for Web Push. |
| `VAPID_PRIVATE_KEY` | Worker secret | Matching PKCS#8 DER private key, base64-encoded; keep this secret private. |
| `VAPID_SUBJECT` | Worker secret | Contact URI for the push service, such as `mailto:admin@example.org`. |
| `ARCHANGELOS_ADMIN_USERNAME` | Worker variable in `wrangler.jsonc` | Defaults to `admin`; change it if desired. |
| `MAX_UPLOAD_BYTES` | Worker variable in `wrangler.jsonc` | Defaults to 5 GiB per file. |
| `MAX_STORAGE_BYTES` | Worker variable in `wrangler.jsonc` | Defaults to 8,000,000,000 tracked bytes. |

This implementation does not use Backblaze B2 credentials, R2 S3 keys, browser storage keys, a separate CORS origin, or a database password. The Worker bindings keep storage access server-side, and the bucket remains private.

### Enabling Web Push

Generate a VAPID P-256 key pair in the formats listed above, then set each value as a Worker secret and deploy:

```powershell
node --input-type=module -e "const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']); console.log('VAPID_PUBLIC_KEY='+Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey)).toString('base64url')); console.log('VAPID_PRIVATE_KEY='+Buffer.from(await crypto.subtle.exportKey('pkcs8',k.privateKey)).toString('base64'));"
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npm run deploy
```

Keep the private key output secret and enter each key at its matching Wrangler prompt. Set `VAPID_SUBJECT` to a contact URI such as `mailto:admin@example.org`. The application sends notifications for new Worker deployments and for the first publication of a material or announcement, including drafts later published. Editing already-published content does not produce another release notification. Visitors must enable notifications on each browser/device. Web Push works only on supported browser/device combinations; on iPhone and iPad with iOS/iPadOS 16.4 or later the site must be installed as a web app. HTTPS, notification permission, a network connection, and the configured VAPID secrets are required.

The in-app notification center uses additive migrations `0007_public_notifications.sql` and `0008_admin_notifications.sql`. Migration 0008 adds administrative broadcast history and delivery counts without deleting existing data. The authenticated `GET`/`POST /api/admin/notifications` endpoints send only to all opted-in devices; the project has no student accounts or recipient groups, so personal or grade-targeted messages are unavailable. Admin sends require the existing administrator session and same-origin/CSRF checks. Public feed reads use `GET /api/notifications?limit=20`, return at most 50 public events per page with a cursor, and retain the 500 newest entries. Browser read/dismiss state is local to that device. Neither endpoint is for private student records.

The browser settings include a local in-app sound preference and demo. Custom Web Audio sound plays only while the site is open and subject to browser autoplay rules. A closed app can use only the notification sound selected by the operating system, where supported. Browsers do not expose Focus/Do Not Disturb or battery-saver state reliably, and the operating system can silence or delay background delivery. The interface reports browser feature detection; it does not certify operating-system compatibility. No physical-device compatibility matrix has been tested for this release.

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

## Redeploying and changing the production schema

For a code-only release, run:

```powershell
npm run deploy
```

To change the administrator password, use Wrangler's secret prompt and redeploy:

```powershell
npx wrangler secret put ARCHANGELOS_ADMIN_PASSWORD
npm run deploy
```

Before any future production schema migration, export the current database and verify the backup. Apply only pending migrations; do not reapply the initial schema to this populated database:

```powershell
npx wrangler d1 export archangelos-content --remote --output .wrangler/production-before-migration.sql
npx wrangler d1 migrations list archangelos-content --remote
npx wrangler d1 migrations apply archangelos-content --remote
```

Migrations `0007_public_notifications.sql` and `0008_admin_notifications.sql` add notification tables and indexes without dropping existing tables or records. The notification feature changes in the current workspace are not yet deployed, and migration 0008 has not been applied to production. Test locally first with `npm.cmd run db:migrate:local`; production migration and deployment are separate actions and require explicit operator approval. Back up and verify production D1 before applying pending migrations. Deploy code only after the corresponding production migration succeeds.

For a fresh Cloudflare account, first review current terms and pricing. Check for existing resources before creating anything; R2 usage above included allowances is metered. Create a D1 database and R2 bucket, then update their names and the actual D1 ID in `wrangler.jsonc`. Back up any existing database before migrating. A new Worker must be deployed once before `wrangler secret put` can attach its administrator secret; redeploy after setting the secret.

The configured `workers_dev` endpoint serves the PWA and API on the same origin. No public `r2.dev` URL, bucket CORS rule, or R2 key is needed. Attach a custom domain only if you already own one and have confirmed any associated cost.

## Post-deployment verification

1. Open the Worker URL and confirm the home page, Arabic RTL layout, English switch, and static assets load.
2. Confirm public API reads work:

   ```powershell
   curl.exe -i https://<worker-host>/api/resources
   curl.exe -i https://<worker-host>/api/config
   curl.exe -i "https://<worker-host>/api/notifications?limit=20"
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

The supplied archive's legacy SQLite database is valid but contains zero resource rows, and its uploads folder is empty. The live D1 database used by this deployment contains 7 resources and was backed up before migration. If a separate deployed service has data, keep it running, download its database and complete uploads directory, then use `tools/backup_legacy.py` and `tools/prepare_legacy_migration.py` to produce a reviewable backup and migration pack. Import only into new, empty R2 and D1 resources after verifying the backup and generated files. Do not overwrite the old database, uploads, or host during migration.
