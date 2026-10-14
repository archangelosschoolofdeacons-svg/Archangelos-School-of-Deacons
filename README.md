# Archangelos School of Deacons — Vercel + Supabase

This version keeps the existing bilingual PWA design and uses Vercel Functions for the API, Supabase Postgres for shared resource metadata, and Supabase Storage for uploaded media. Students on different devices see the same published materials.

## Deploy in this order

### 1) Create Supabase storage and database
1. Create a project at https://supabase.com/.
2. Open **SQL Editor → New query**.
3. Paste and run the complete `supabase/schema.sql` file from this repository.
4. In **Project Settings → API** (or **Connect**), copy the project URL and the **service_role** secret key. Keep the service-role key private; it belongs only in Vercel server environment variables.

The SQL creates the `resources` table and a public-read `school-materials` bucket. Anonymous users are not granted database writes. All write actions go through the Vercel API after administrator-session and CSRF checks.

### 2) Deploy this repository to Vercel
1. Upload the **contents of this folder** to the root of a GitHub repository. The root should contain `vercel.json`, `package.json`, `api/`, `public/`, and `supabase/`.
2. In https://vercel.com/dashboard choose **Add New → Project**, import that repository, and deploy with the **Other** framework preset. The static site is in `public/`; API functions are in `api/`.
3. In the Vercel project, open **Settings → Environment Variables** and add these variables for Production (and Preview if you need preview deployments):
   - `SUPABASE_URL` — Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase `service_role` key. Never put this key in `public/` or frontend code.
   - `ARCHANGELOS_ADMIN_USERNAME` — for example `admin`.
   - `ARCHANGELOS_ADMIN_PASSWORD` — a unique password of at least 12 characters.
   - `ARCHANGELOS_SESSION_SECRET` — a random secret of at least 32 characters. Generate one with `openssl rand -base64 48` or a password manager.
4. Redeploy after adding/changing environment variables.
5. Open the Vercel production URL, go to **إدارة المحتوى**, sign in with the configured admin credentials, upload a test file, then open the same Vercel URL on another device.

### 3) Notes
- Do not use the old GitHub Pages URL as the live app URL: GitHub Pages does not run the `/api/*` functions. Share the Vercel production URL with students.
- Uploaded media is sent directly from the browser to Supabase Storage using a short-lived signed upload URL, so large media files do not pass through the Vercel function request body limit.
- This bundle limits files to **50 MB** to match common Supabase project limits. Confirm the upload-size limit in your Supabase plan before increasing it.
- The Storage bucket is public-read so published media can be played by students. Do not upload private or sensitive files.
- The administrator password and session secret must remain server-side. Never commit `.env` or the service-role key.
- Existing content stored in a browser's IndexedDB or in an earlier local/Render SQLite database is not automatically migrated. Import or re-upload that content after deployment if needed.
- The old Python `server.py` is not used by this Vercel version. The Vercel API is implemented in `api/[...path].js`.

## Local preview
Open `public/index.html` to preview the interface only. Shared storage and admin APIs require a deployed Vercel project with the Supabase environment variables configured.
