# Storage Diagnostic Report

**Audit date:** 15 October 2026  
**Project:** Archangelos School of Deacons  
**Source:** User-provided `Archangelos School of Deacons.zip`

## Findings

The ZIP is a history bundle containing several project snapshots. I used the latest complete Cloudflare Worker/D1/R2 source tree in the bundle as the deliverable. I separately inspected the bundled legacy Python server and its Render manifest; the original ZIP remains unchanged.

The confirmed legacy upload failure is architectural: `server.py` accepts at most 100 MiB and reads the entire multipart request into memory. It cannot accept a video larger than 500 MB. Its Render manifest selects a `starter` service and a 1 GB persistent disk, which also cannot support this application's current 8 GB library cap. A separate Vercel/Supabase README in another snapshot refers to API and Supabase source directories that are absent from that snapshot.

The latest Worker project is configured for private R2 storage and chunked uploads. Its deployment is not complete: `wrangler.jsonc` still contains an all-zero D1 database ID, no production administrator password was available, and no live Cloudflare resources or account could be checked. I therefore cannot identify the cause of a separate live service failure or claim a successful live storage test.

The bundled legacy SQLite database passed `PRAGMA integrity_check` and contains zero resources. Its upload directory contains zero files. This does not establish whether a separately hosted service has additional data.

| Severity | Finding | Root cause or evidence | Action and status |
| --- | --- | --- | --- |
| Critical deployment blocker | Live storage cannot be verified | The configured D1 ID is a zero placeholder; the admin secret and live Cloudflare resources were unavailable. | Documented the exact setup steps. No IDs, credentials, buckets, or production settings were invented. **BLOCKED** |
| High | Legacy videos fail above 100 MiB | Python parses the complete multipart body in memory and enforces a 100 MiB cap. The legacy Render manifest also provides only a 1 GB disk. | The delivered Worker design uploads 32 MiB parts to R2 and has a 5 GiB per-file limit. Simulated tests pass; live upload is unverified. |
| High | Archived deployment instructions conflict | A Vercel/Supabase snapshot lacks its referenced API/Supabase implementation; the selected project uses Cloudflare Worker bindings. | Kept the Worker/D1/R2 architecture and added a matching deployment guide. |
| Medium | Concurrent replacements could both commit | The old code checked the resource version before an unconditional batch; simultaneous completions could leave orphaned objects and incorrect quota totals. | Added a conditional D1 upsert in the same batch and unique resource versions. A concurrent replacement test confirms one winner and cleanup of the loser. |
| Medium | Failed multipart aborts could lose cleanup tracking | The old release path discarded the D1 session and reservation even if R2 abort failed. | Failed aborts now retain the upload session and reserved bytes; later authenticated upload requests retry expired cleanup. A failure/retry test passes. |
| Medium | Stale media cleanup could be lost | Failed old-object cleanup had no durable retry path. | Upload start now retries deletion of unreferenced `media_objects` and corrects the tracked byte count. Simulator test passes. |
| Medium | Media links did not request an attachment | Stored-media responses always used `Content-Disposition: inline`. | Added `?download=1`, safe generated filenames, and a download action for stored media. Simulated video response test passes. |
| Medium | Weak administrator secrets were accepted | The Worker previously accepted any non-empty password although the template required 12 characters. | Login now requires a password of at least 12 characters and a valid configured username. Test passes. |

## Files inspected

Inspected the selected project's package manifest and lockfile, Wrangler configuration, safe environment templates, migration, Worker, HTML, CSS, frontend JavaScript, localization, service worker, headers, manifests, tests, README files, and migration/backup tools. Also inspected the legacy `server.py`, Render configuration, bundled SQLite database metadata, and archived project tree. Static references in the HTML, manifests, service worker shell, and CSS were checked.

## Files changed

- `src/worker.js`: atomic replacement check, unique resource versions, weak-secret rejection, retryable abort cleanup, orphan-media cleanup, lifecycle timing, and attachment responses.
- `public/app.js`: stored-media download links.
- `tests/worker.integration.test.js`: SQLite-backed D1 and in-memory R2 simulation covering upload/read/retry/cleanup/failure paths.
- `tools/backup_legacy.py`: refuses a backup destination inside the source uploads directory.
- `README.md` and `README_AR.md`: corrected audit/test claims and large-file verification status.
- `DEPLOYMENT_GUIDE.md` and `FINAL_CHECKLIST.md`: deployment and verification deliverables.

No production database, bucket, credential, or uploaded user file was changed. The temporary local test password and generated dependencies are excluded from the deliverable.

## Storage architecture and security

- **Browser to backend:** The browser talks to the same-origin Worker. There is no browser-to-R2 key or direct privileged upload credential.
- **Upload:** An authenticated administrator starts a multipart upload, then sends 32 MiB chunks to the Worker. The Worker streams each chunk to the private R2 binding, validates extension/MIME/signature/size, and records sessions and metadata in D1.
- **Large-file sizing:** The app defaults to 5 GiB per file, 32 MiB per part, 8,000,000,000 tracked bytes, and a 9,000,000,000-byte temporary replacement guard. Cloudflare's Free account request-body limit is 100 MB, so each configured part remains below it. R2 multipart requires parts of at least 5 MiB except the last and supports up to 10,000 parts; see [R2 multipart limits](https://developers.cloudflare.com/r2/objects/upload-objects/) and [Workers request limits](https://developers.cloudflare.com/workers/platform/limits/).
- **Reads:** The R2 bucket remains private. Public educational media is fetched through `/media/{resource-id}`; the Worker supports `HEAD`, byte ranges, playback, and explicit attachment downloads. Existing public content policy is preserved.
- **Authentication:** Admin writes require a Worker-side password, same-origin checks, a D1-backed session, and CSRF token. Session tokens and IP throttle identifiers are stored as hashes. The password is not exposed to the browser.
- **CORS:** The frontend and API share one origin. Cross-origin admin writes are rejected; no R2 CORS rule or public bucket is needed.
- **Backblaze B2:** Not used by the selected project. No `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_ID`, or `B2_BUCKET_NAME` variable is required. The project uses Worker bindings `DB`, `MEDIA`, and `ASSETS`.
- **Billing:** R2 Standard currently includes 10 GB-month, 1 million Class A, and 10 million Class B operations per month, with no egress charge. Overages are metered; a primary payment method is required to purchase an R2 subscription. The app cannot cap usage by other projects in the account. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [R2 setup](https://developers.cloudflare.com/r2/get-started/).

## Configuration status

| Configuration | Status |
| --- | --- |
| `ARCHANGELOS_ADMIN_PASSWORD` Worker secret | Missing from the available runtime configuration; required before sign-in can work. Set with `npx wrangler secret put ARCHANGELOS_ADMIN_PASSWORD`. |
| `ARCHANGELOS_ADMIN_USERNAME` Worker variable | Optional; defaults to `admin`. |
| `MAX_UPLOAD_BYTES` | Optional; configured default is `5368709120`. |
| `MAX_STORAGE_BYTES` | Optional; configured default is `8000000000`. |
| D1 database ID | Placeholder in `wrangler.jsonc`; replace with the real ID returned by the account's D1 setup. |
| R2 bucket | Name configured as `archangelos-school-materials`; live bucket existence was not checked. |
| B2 variables | Not used or required. |
| Secrets in delivered source/archive | No real credentials included. `.env.example` and `.dev.vars.example` are templates only. |

## Commands and actual results

| Command/check | Result |
| --- | --- |
| `npm test` | **PASS** — 13 tests, 0 failures. Integration cases use Node's SQLite module and an in-memory R2 simulator, not live Cloudflare. |
| `npm run check` | **PASS** — Worker, app, localization, and service-worker syntax. |
| `python -m py_compile tools/backup_legacy.py tools/prepare_legacy_migration.py` | **PASS**. |
| `npm ls --depth=0` | **PASS** — locked Wrangler 4.149.0 dependency tree. The modules came from the supplied project snapshot; a clean network install was not run. |
| Static asset reference check | **PASS** — 38 HTML/manifest/service-worker/CSS references checked, 0 missing or unsafe. |
| `npm run deploy -- --dry-run --outdir <scratch-directory>` | **PASS** — Wrangler bundled the Worker and read 23 static assets (42.58 KiB total Worker upload, 10.55 KiB gzip); no deployment occurred. |
| `npm run db:migrate:local` | **BLOCKED** — Wrangler reported `fetch failed` in the restricted audit environment. No successful Wrangler D1 migration is claimed. The SQL migration did execute in the SQLite-backed integration test. |
| Wrangler local dev server | **BLOCKED** — local loopback socket access was denied by the environment. |
| Synthetic legacy backup checks | **PASS** — unsafe nested output destination rejected; an empty test database backup produced a manifest. |
| Legacy database in supplied ZIP | **PASS** — SQLite integrity `ok`, 0 resources, 0 uploaded files. |

The simulated integration suite uploads small audio, PNG, PDF, and MP4 fixtures; verifies media responses, byte-range reads, attachment download, an idempotent part retry, concurrent replacement, expiry, abort retry, and D1 failure cleanup. The 600 MiB MP4 case validates the configured size only. No 500 MB+ file was uploaded. Browser playback/download, mobile behavior, live R2 persistence, live public delivery, billing, and production migrations were not tested.

## Remaining setup steps

1. Inspect the actual Cloudflare account and decide whether to accept R2 billing requirements.
2. Reuse or create the named private R2 bucket and D1 database; replace the zero D1 ID.
3. Back up any separately hosted database/uploads and apply the initial migration only to a new, empty D1 database.
4. Set `ARCHANGELOS_ADMIN_PASSWORD` as a Worker secret and deploy with `npm run deploy`.
5. Verify small audio/image/PDF/video workflows, byte-range playback, and a test download. Only then run an isolated live test above 500 MB.

Full commands and rollback guidance are in `DEPLOYMENT_GUIDE.md`.
