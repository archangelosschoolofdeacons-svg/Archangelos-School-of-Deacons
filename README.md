# Archangelos School of Deacons

This bilingual installable PWA now includes a small shared content server. The server stores materials in SQLite and uploaded media on disk. Students can read published materials without an account; administrators must sign in to add, edit, or delete them.

## Run locally

Requires Python 3.10 or later. From this folder, set an administrator password of at least 12 characters and start the server:

```powershell
$env:ARCHANGELOS_ADMIN_USERNAME = "admin"
$env:ARCHANGELOS_ADMIN_PASSWORD = "replace-with-a-long-unique-password"
python server.py
```

Open [http://localhost:8000](http://localhost:8000). Go to **Content management** and sign in. The server has no default password. Multiple accounts can be configured with `ARCHANGELOS_ADMIN_USERS` as a JSON object of username/password pairs.

The default database and uploads are stored in the sibling folder `outputs/archangelos-data`. Set `ARCHANGELOS_DATA_DIR` to move them, and back up that folder regularly.

## Share across devices

`localhost` is only reachable from the computer running the server. To sync students’ devices, host this Python server at one shared school address and serve it over HTTPS. If it must listen on a LAN or hosting network interface, set `ARCHANGELOS_HOST=0.0.0.0`. When HTTPS is terminated by a reverse proxy, set `ARCHANGELOS_SECURE_COOKIE=1`. Do not expose the server directly to the public internet over plain HTTP.

The app refreshes shared materials while open and shows newly published items; optional browser notifications require the visitor’s permission. Notifications while the app is closed require a Web Push provider and VAPID credentials, which are not configured in this project.

## Storage and access

- `server.py` serves the PWA, handles administrator sessions, and provides the content API.
- `content.sqlite3` stores material metadata; uploaded media files are stored beside it.
- Material reads are public; create, update, and delete actions require an administrator session and CSRF token.
- Theme and language preferences remain local to each browser. Opening `index.html` directly or using `python -m http.server` bypasses the shared API and is only suitable for local preview.
