# Archangelos School of Deacons

The Arabic, English, and German PWA, branding, navigation, and administration form are retained. Shared lesson content and published announcements use a same-origin Cloudflare Worker and D1 metadata; media files use a private R2 bucket. Administrators can create, edit, publish, draft, and delete announcements in Content Management, and attach JPEG, PNG, GIF, WebP, or AVIF images up to 8 MB. Images are served with published announcements; draft images remain private. This source bundle does not create Cloudflare resources or alter billing settings.

## Audit findings

- The input ZIP contains several dated project snapshots. The legacy Python server stores SQLite and uploads on a local directory; its included Render manifest selects a `starter` service with a 1 GB persistent disk. The archive does not establish which snapshot is currently deployed.
- The legacy upload handler accepts at most 100 MiB and reads the entire multipart request into memory. That implementation cannot accept a 500 MB video and the 1 GB disk cannot hold the current application's configured 8 GB library cap.
- Another snapshot's README describes Vercel/Supabase, while its API and Supabase source directories are absent. The current deliverable is the more recent Worker/D1/R2 source snapshot.
- Legacy administrator sessions and login throttling were process-local in Python. The current Worker stores hashed sessions and hashed IP throttle keys in D1.
- The bundled legacy SQLite database passes `PRAGMA integrity_check` and has **0 resource rows**; its uploads folder contains **0 files**. This says nothing about a separately deployed service, which was not accessible from this audit.
- At the time of the 15 October audit, the D1 ID and production secret were unavailable. The 18 October deployment and its current resource bindings are recorded below.

## Live deployment — 18 October 2026

The Worker is published at [archangelos-school-of-deacons.archangelosschoolofdeacons.workers.dev](https://archangelos-school-of-deacons.archangelosschoolofdeacons.workers.dev/), version `aa399226-4969-4f0b-ad8c-9b4c6a48040b`. It uses the existing D1 database `archangelos-content` and R2 bucket `archangelos-media`. Before applying four additive migrations, the production D1 export was saved under `.wrangler/production-pre-migration-2026-10-18.sql` and verified with SQLite integrity and row-count checks. The administrator password is configured as a Cloudflare Worker secret; it is not stored in this repository. Cloudflare confirmed the deployment, but public HTTP checks timed out from the deployment environment, so browser/API responses still need to be confirmed from a reachable network. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for maintenance and rollback steps.

## Storage design and free-tier limits

The application uses one Cloudflare Worker for the existing static site, same-origin API, and public media reads; D1 stores metadata, sessions, upload state, and byte counts; a private R2 bucket stores media. The Worker streams R2 objects and supports byte-range responses for video and audio. The browser sends 32 MiB file slices, so no full video is loaded into JavaScript memory and each request stays below Cloudflare's 100 MB Free account request-body limit. The PWA caches public materials and announcement lists and can retain up to 20 complete, previously opened media files of 8 MiB or less in that browser's temporary cache. Larger media, unvisited files, and saving changes still require a connection. This browser cache is not the permanent storage copy.

The notification center stores a public feed in D1 for new learning materials, announcements, Worker deployments, and administrator notices. It is deduplicated, cursor-paginated, and retains the 500 newest entries. The PWA caches the public feed for offline viewing; read/dismiss state is local to each browser. Visitors can opt in to Web Push separately on each device. Administrators can send notices to all opted-in devices from `#/admin`; the existing admin session and same-origin checks protect these sends, and D1 records delivery status and counts. This project has no student account/enrollment model or recipient groups, so notices cannot be targeted to a class or used for private grades/reminders. Publication events are sent once, and editing already-published content does not send another release notice. Notification settings include a local in-app sound, sound choice, volume, and demo. Custom audio works only while the app is open; background sound and delivery depend on browser and operating-system behavior. Web Push requires configured VAPID keys, HTTPS, browser permission, and a supporting browser/device. On iPhone and iPad with iOS/iPadOS 16.4 or later, the site must be added to the Home Screen. The app detects browser features but does not certify OS compatibility; no physical-device matrix has been tested. Devices must be online to receive notifications.

| Service | Current published allowance reviewed 15 Oct 2026 | Behavior beyond the allowance |
| --- | --- | --- |
| Workers Free | 100,000 requests/day; 10 ms CPU per invocation; 128 MB memory; 100 MB maximum request body. | The app sends 32 MiB chunks, below the body limit. Daily request limits still apply. |
| R2 Standard | 10 GB-month; 1 million Class A and 10 million Class B operations/month; **no egress charge**. | Storage and operations above the included amounts are metered. |
| D1 Free | 500 MB per database; 5 GB account total; 7-day Time Travel retention. | D1 limits apply to account usage and query volume. |

Cloudflare documents R2 multipart uploads up to 5 TiB and 10,000 parts. This app's configured per-file limit is **5 GiB**, with 32 MiB parts; the tracked library cap defaults to **8,000,000,000 bytes**. A 500 MiB video fits in 16 parts and a 600 MiB video in 19 parts. The current code and simulated integration tests cover the multipart flow, but no 500 MB or larger upload was executed against a live R2 bucket. The storage cap cannot see other usage in the Cloudflare account.

Public media is served from `/media/{resource-id}` through the Worker. The R2 bucket is accessed through its Worker binding; the site does not enable the `r2.dev` development URL. R2 egress is free, but each dynamic media request invokes the Worker and reads R2, so Worker daily requests and R2 Class B operations still have quotas. Custom domains are optional; using a domain requires a domain you already own. Cloudflare requires an R2 subscription checkout and a primary payment method to purchase services. **Expected R2 cost is $0 only while all account usage remains within the included limits; usage above them is metered and can be charged automatically. There is no hard spending cap in this application.** This publication reused the bucket already present in the account and did not change billing settings. The app limits tracked storage, but does not cap account-wide R2 operations or other projects' usage. Review [R2 setup](https://developers.cloudflare.com/r2/get-started/), [Cloudflare's payment method requirement](https://developers.cloudflare.com/billing/get-started/create-billing-profile/), and [billing/preauthorization terms](https://developers.cloudflare.com/billing/understand/billing-policy/) before changing resources or billing.

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

The live Worker uses D1 `archangelos-content` and R2 `archangelos-media`. For a code release, run `npm run deploy`. Before future D1 schema changes, export the populated database, verify the backup, and apply only pending migrations. Do not create duplicate resources or apply this project's schema to another existing database without reviewing its data.

To change the administrator password, run `npx wrangler secret put ARCHANGELOS_ADMIN_PASSWORD`, then redeploy. Push notifications remain disabled until compatible `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` Worker secrets are set. `ARCHANGELOS_ADMIN_USERNAME` defaults to `admin`; `MAX_UPLOAD_BYTES` defaults to 5 GiB and `MAX_STORAGE_BYTES` to 8,000,000,000 bytes. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for push setup, backup, migration, verification, and rollback commands. This repository does not create Cloudflare resources or change billing settings.

## Existing-data backup, import, and rollback

The archive's legacy database is empty, so there was no bundled content to migrate. The live production D1 database contains 7 resources and was backed up before deployment migrations. If a separate hosted Render service has newer content, keep it running and read-only until that data is reviewed.

Before changing any existing remote D1 schema, export it and verify the backup hash. The pre-migration export for this deployment is `.wrangler/production-pre-migration-2026-10-18.sql`; for future changes, export to a new file:

```powershell
npx wrangler d1 export archangelos-content --remote --output .\wrangler\production-before-migration.sql
Get-FileHash .\wrangler\production-before-migration.sql -Algorithm SHA256
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

Only import to **new, empty** R2 and D1 resources reserved for that migration. Do not import into the populated production resources above. Run the generated R2 upload script first, then apply `d1-import.sql` to the new database with `npx wrangler d1 execute <new-database-name> --remote --file='D:\backup\archangelos-migration-pack\d1-import.sql'`. The SQL uses conflict-safe inserts and does not delete source records. Verify record counts, file sizes, a representative sample of every media type, byte-range playback, and the resulting storage usage before routing visitors to the Worker.

Rollback plan: retain the original host and backup until acceptance is complete. Before routing traffic, rollback means returning visitors to the still-current old URL. After Cloudflare accepts new administrator changes, pause uploads/deletes before any rollback and export or reconcile those new records and files; the old SQLite copy will not receive Cloudflare writes automatically. Do not delete or overwrite the original database, uploads, or Render disk as part of cutover.

## Test status and remaining manual checks

The Node test suite covers representative audio/video/image/PDF signatures and limits, authentication and cross-origin rejection, part retries, upload and cleanup behavior, byte-range reads, announcement image upload/replacement/removal, private draft images, publication access, notification subscription validation, encrypted deployment and content notifications, duplicate suppression, and localization. The SQLite-backed D1 adapter and in-memory R2 simulator use small fixtures; a 600 MiB MP4 passed size validation only and was not uploaded. `npm run check` validates JavaScript syntax. The Worker publication and D1 migrations completed on 18 October 2026. Public API/browser behavior, real push-service interoperability, an actual R2 upload above 500 MB, media playback/download, and deployed persistence remain unverified; the direct HTTP check timed out from this environment.
