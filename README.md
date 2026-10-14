# Archangelos School of Deacons

Bilingual installable PWA with a shared Python content server. Published audio, images, PDFs, and videos are stored on the server, so visitors on different devices see the same published materials.

## Deploy so uploads work from any device

**The app must run on a shared server. GitHub Pages alone cannot run `server.py`, save uploaded files, or provide the `/api/*` endpoints.** This project includes `render.yaml` for deployment on Render with a persistent disk.

1. Push the contents of this project folder to a GitHub repository (keep `render.yaml` and `server.py` in the repository root).
2. In Render, choose **New → Blueprint**, connect that repository, and apply the blueprint.
3. When prompted for `ARCHANGELOS_ADMIN_PASSWORD`, set a unique password of at least 12 characters. Keep it private.
4. Wait for deployment to finish. Open the **Render service URL** and test the admin login and uploads.
5. Share that Render URL with students and administrators. All devices must use the same hosted URL to see the same published resources.

The included Render configuration uses a persistent disk mounted at `/var/data`. A persistent disk requires a paid Render web-service plan; do not switch to an ephemeral/free instance if uploaded materials must survive redeploys or restarts. Back up `/var/data` regularly.

## Local development

Requires Python 3.10 or later. From this folder:

```powershell
$env:ARCHANGELOS_ADMIN_USERNAME = "admin"
$env:ARCHANGELOS_ADMIN_PASSWORD = "replace-with-a-long-unique-password"
python server.py
```

Open http://localhost:8000. `localhost` is only available on the computer running the server.

## Storage and access

- `server.py` serves the website and the `/api/*` endpoints from the same HTTPS origin.
- `content.sqlite3` stores metadata; uploaded media is stored in the `uploads` folder under `ARCHANGELOS_DATA_DIR`.
- Material reads are public; create, update, and delete require administrator login and a CSRF token.
- Supported uploads: audio, video, images, and PDFs; maximum upload size is 100 MB per file.
- Theme and language preferences remain local to each browser.
- GitHub Pages may still host source code, but the live app must be opened from the shared Python server URL for cross-device uploads to work.
