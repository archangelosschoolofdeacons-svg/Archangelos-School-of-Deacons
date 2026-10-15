# Archangelos School of Deacons

The existing Arabic/English PWA, branding, navigation, and administration form are retained. Shared content uses a same-origin Cloudflare Worker, D1 metadata, and a private R2 bucket. This source bundle does not create Cloudflare resources or alter billing settings.

## Audit findings

- The input ZIP contains several dated project snapshots. The legacy Python server stores SQLite and uploads on a local directory; its included Render manifest selects a `starter` service with a 1 GB persistent disk. The archive does not establish which snapshot is currently deployed.
- The legacy upload handler accepts at most 100 MiB and reads the entire multipart request into memory. That implementation cannot accept a 500 MB video and the 1 GB disk cannot hold the current application's configured 8 GB library cap.
- Another snapshot's README describes Vercel/Supabase, while its API and Supabase source directories are absent. The current deliverable is the more recent Worker/D1/R2 source snapshot.
- Legacy administrator sessions and login throttling were process-local in Python. The current Worker stores hashed sessions and hashed IP throttle keys in D1.
- The bundled legacy SQLite database passes `PRAGMA integrity_check` and has **0 resource rows**; its uploads folder contains **0 files**. This says nothing about a separately deployed service, which was not accessible from this audit.
- The Worker configuration still has a zero placeholder D1 database ID, and no production administrator secret or live Cloudflare resources were available to verify. Live storage connectivity therefore remains unverified.

## Storage design and free-tier limits

The application uses one Cloudflare Worker for the existing static site, same-origin API, and public media reads; D1 stores metadata, sessions, upload state, and byte counts; a private R2 bucket stores media. The Worker streams R2 objects and supports byte-range responses for video and audio. The browser sends 32 MiB file slices, so no full video is loaded into JavaScript memory and each request stays below Cloudflare's 100 MB Free account request-body limit. The PWA can cache the public materials list and up to 20 complete media files of 5 MiB or less in that browser's temporary cache; large and range-based media still needs a connection. This browser cache is not the permanent storage copy.

| Service | Current published allowance reviewed 15 Oct 2026 | Behavior beyond the allowance |
| --- | --- | --- |
| Workers Free | 100,000 requests/day; 10 ms CPU per invocation; 128 MB memory; 100 MB maximum request body. | The app sends 32 MiB chunks, below the body limit. Daily request limits still apply. |
| R2 Standard | 10 GB-month; 1 million Class A and 10 million Class B operations/month; **no egress charge**. | Storage and operations above the included amounts are metered. |
| D1 Free | 500 MB per database; 5 GB account total; 7-day Time Travel retention. | D1 limits apply to account usage and query volume. |

Cloudflare documents R2 multipart uploads up to 5 TiB and 10,000 parts. This app's configured per-file limit is **5 GiB**, with 32 MiB parts; the tracked library cap defaults to **8,000,000,000 bytes**. A 500 MiB video fits in 16 parts and a 600 MiB video in 19 parts. The current code and simulated integration tests cover the multipart flow, but no 500 MB or larger upload was executed against a live R2 bucket. The storage cap cannot see other usage in the Cloudflare account.

Public media is served from `/media/{resource-id}` through the Worker. The R2 bucket stays private; the site does not enable the rate-limited `r2.dev` development URL. R2 egress is free, but each dynamic media request invokes the Worker and reads R2, so Worker daily requests and R2 Class B operations still have quotas. Custom domains are optional; using a domain requires a domain you already own. Cloudflare requires an R2 subscription checkout and a primary payment method to purchase services. **Expected R2 cost is $0 only while all account usage remains within the included limits; usage above them is metered and can be charged automatically. There is no hard spending cap in this application. Do not enable R2 or add a payment method for this project without your approval.** The app limits tracked storage, but does not cap account-wide R2 operations or other projects' usage. Review [R2 setup](https://developers.cloudflare.com/r2/get-started/), [Cloudflare's payment method requirement](https://developers.cloudflare.com/billing/get-started/create-billing-profile/), and [billing/preauthorization terms](https://developers.cloudflare.com/billing/understand/billing-policy/) before deciding.

No inactivity pause is listed in the Cloudflare Free Worker/D1/R2 limits and pricing pages reviewed. R2 objects remain until deleted or covered by a lifecycle rule; incomplete multipart uploads expire after seven days. Free-tier allowances and provider terms can change, so recheck them before deployment.

Official references: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/), [Cloudflare billing requirements](https://developers.cloudflare.com/billing/get-started/create-billing-profile/), [billing and preauthorization](https://developers.cloudflare.com/billing/understand/billing-policy/), [R2 multipart upload limits](https://developers.cloudflare.com/r2/objects/upload-objects/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits and retention](https://developers.cloudflare.com/d1/platform/limits/), [Render Free services and ephemeral filesystems](https://render.com/docs/free), and [Render persistent disks](https://render.com/docs/disks).

## Local development

Use Node.js 22 or newer and Python 3.10 or newer. Local Wrangler state is stored under `.wrangler/` and is ignored by Git. It is not production storage. `npm test` includes an SQLite-backed D1 adapter and in-memory R2 simulator; it does not contact Cloudflare. The integration test skips automatically if the Node runtime does not provide `node:sqlite`.

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
# Edit .dev.vars and set a unique local administrator password (12+ characters).
npm run db:migrate:local
npm run dev
```

Open the local URL printed by Wrangler (normally `http://localhost:8787`) and visit `#/admin`. Local D1 and R2 emulation let you check the application without contacting Cloudflare or creating cloud resources. Reset local test data only by removing `.wrangler/state` after saving anything you need.

The bundled Workerd runtime currently supports compatibility dates through `2026-10-13`, so the project uses that date for local compatibility. In the audit sandbox, Wrangler's standalone `d1 execute --local` and `d1 migrations apply --local` commands still returned an opaque internal error. The application itself passed a Worker-backed Miniflare `SELECT 1`, schema migration, and upload/delete end-to-end test; this points to the standalone Wrangler D1 utility path in that environment, not an application SQL failure.

Run the local checks:

```powershell
npm test
npm run check
python -m py_compile tools/backup_legacy.py tools/prepare_legacy_migration.py
```

## Cloudflare setup and deployment

1. Review the current Cloudflare terms and pricing. Creating an R2 subscription requires a checkout and primary payment method; usage beyond the free allowance is metered and can be billed. Stop here unless you explicitly approve that billing exposure. This repository does not create resources automatically.
2. After approval, create an R2 bucket named `archangelos-school-materials` and a D1 database named `archangelos-school-content` in the Cloudflare dashboard or with Wrangler. Keep the R2 bucket private. Do not enable `r2.dev` public access.
3. Copy the D1 database ID into `wrangler.jsonc`, replacing the all-zero local placeholder. Keep the configured bucket and database names aligned with the resources you created.
4. Complete and verify the backup/rollback steps in the next section before running a remote schema migration. Apply the initial schema only to the new, empty D1 database, set the administrator password as a Worker secret, and deploy:

   ```powershell
   npx wrangler d1 migrations apply archangelos-school-content --remote
   npx wrangler secret put ARCHANGELOS_ADMIN_PASSWORD
   npm run deploy
   ```

   `ARCHANGELOS_ADMIN_USERNAME` is a non-secret Worker variable in `wrangler.jsonc` (default `admin`). `MAX_UPLOAD_BYTES` defaults to 5 GiB. `MAX_STORAGE_BYTES` defaults to 8,000,000,000 bytes. Do not raise these caps without checking the account's total R2 use and pricing. The session cookie is random, stored as a hash in D1, and does not need a signing secret. No R2 access key or database credential is sent to the browser.
5. First validate the deployment at its `workers.dev` address. It serves the PWA and media on one origin; no R2 CORS rule or public bucket is needed. Attach a custom domain only if you already own one and have confirmed any associated domain costs.

Wrangler resource-creation commands, if you choose to use them after reviewing billing:

```powershell
npx wrangler r2 bucket create archangelos-school-materials
npx wrangler d1 create archangelos-school-content
```

The second command returns the database ID to put in `wrangler.jsonc`. These commands were **not** run here.

## Existing-data backup, import, and rollback

The archive's database is empty, so there was no bundled content to migrate. No live Render or Cloudflare account was available, and no production data was imported. If an existing hosted Render service has newer content, keep it running and read-only until the new deployment passes review.

Before changing any existing remote D1 schema, export it and verify the backup hash. This command was not run because no Cloudflare database was configured:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
npx wrangler d1 export archangelos-school-content --remote --output .\backups\archangelos-school-content-before.sql
Get-FileHash .\backups\archangelos-school-content-before.sql -Algorithm SHA256
```

Apply the initial schema only to a new, empty D1 database. For rollback, keep the old database, bucket, host, SQLite backup, and uploads intact; pause writes and restore the export into a separate rollback D1 database before changing the Worker binding back. See [Cloudflare D1 export guidance](https://developers.cloudflare.com/d1/best-practices/import-export-data/) and [migration guidance](https://developers.cloudflare.com/d1/reference/migrations/).

Download its `content.sqlite3` and complete `uploads/` directory to a trusted local folder first. Generate a verified backup and a reviewable import pack:

```powershell
python tools/prepare_legacy_migration.py `
  --database 'D:\backup\content.sqlite3' `
  --uploads 'D:\backup\uploads' `
  --output 'D:\backup\archangelos-migration-pack' `
  --bucket archangelos-school-materials
```

The pack includes `verified-backup/` (SQLite backup, copied uploads, SHA-256 manifest), `upload-legacy-to-r2.ps1`, and `d1-import.sql`. Inspect the manifest and both generated import files. The tool only writes local files; it does not contact Cloudflare or change the source. It refuses missing or unsafe media references and refuses a pack whose media exceeds the app's default storage cap.

Only import to a **new, empty** R2 bucket and D1 database after applying this repository's schema. Run the generated R2 upload script first, then apply `d1-import.sql` with `npx wrangler d1 execute archangelos-school-content --remote --file='D:\backup\archangelos-migration-pack\d1-import.sql'`. The SQL uses conflict-safe inserts and does not delete source records. Verify record counts, file sizes, a representative sample of every media type, byte-range playback, and the resulting storage usage before routing visitors to the Worker.

Rollback plan: retain the original host and backup until acceptance is complete. Before routing traffic, rollback means returning visitors to the still-current old URL. After Cloudflare accepts new administrator changes, pause uploads/deletes before any rollback and export or reconcile those new records and files; the old SQLite copy will not receive Cloudflare writes automatically. Do not delete or overwrite the original database, uploads, or Render disk as part of cutover.

## Test status and remaining manual checks

Thirteen Node tests pass. The suite checks representative audio/video/image/PDF signatures and limits, authentication and cross-origin rejection, part retries, upload and cleanup behavior for all four media types, byte-range reads, an attachment download, concurrent replacement, expired sessions, and cleanup when a D1 commit fails. The SQLite-backed D1 adapter and in-memory R2 simulator used small fixtures; a 600 MiB MP4 passed size validation only and was not uploaded. `npm run check`, Python compilation, static asset reference checks, `npm ls --depth=0`, and Wrangler's deployment dry run passed. The standalone local D1 migration command could not complete in the restricted audit environment because Wrangler's fetch failed. Cloudflare provisioning, an actual R2 upload above 500 MB, browser playback/download behavior, and deployed persistence remain unverified.
