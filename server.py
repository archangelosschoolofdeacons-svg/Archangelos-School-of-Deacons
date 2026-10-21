#!/usr/bin/env python3
"""Small same-origin backend for the Archangelos School PWA.

The server stores published resources in SQLite and uploaded media on disk.
Set an administrator password before starting it; no default credentials exist.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from email.parser import BytesParser
from email.policy import default as email_policy
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import uuid


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("ARCHANGELOS_DATA_DIR", APP_DIR.parent / "archangelos-data")).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
DATABASE_PATH = DATA_DIR / "content.sqlite3"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 2 * 1024 * 1024
SESSION_SECONDS = 12 * 60 * 60
PBKDF2_ROUNDS = 240_000
COOKIE_NAME = "archangelos_admin"
SESSION_SECURE = os.environ.get("ARCHANGELOS_SECURE_COOKIE", "0").lower() in {"1", "true", "yes"}
HOST = os.environ.get("ARCHANGELOS_HOST", "127.0.0.1")
PORT = int(os.environ.get("ARCHANGELOS_PORT", os.environ.get("PORT", "8000")))

ALLOWED_EXTENSIONS = {
    "audio": {".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus"},
    "video": {".mp4", ".webm", ".ogv", ".mov", ".m4v"},
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"},
    "pdf": {".pdf"},
}


def load_admins() -> dict[str, tuple[bytes, bytes]]:
    raw_users = os.environ.get("ARCHANGELOS_ADMIN_USERS", "").strip()
    if raw_users:
        try:
            configured = json.loads(raw_users)
        except json.JSONDecodeError as error:
            raise SystemExit("ARCHANGELOS_ADMIN_USERS must be a JSON object of username/password pairs.") from error
        if not isinstance(configured, dict):
            raise SystemExit("ARCHANGELOS_ADMIN_USERS must be a JSON object of username/password pairs.")
    else:
        username = os.environ.get("ARCHANGELOS_ADMIN_USERNAME", "admin").strip()
        password = os.environ.get("ARCHANGELOS_ADMIN_PASSWORD", "")
        configured = {username: password} if password else {}

    if not configured:
        raise SystemExit(
            "Set ARCHANGELOS_ADMIN_PASSWORD (minimum 12 characters) before starting the shared content server."
        )

    admins: dict[str, tuple[bytes, bytes]] = {}
    for username, password in configured.items():
        if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9_.@-]{1,80}", username):
            raise SystemExit("Admin usernames may contain letters, numbers, dot, underscore, @, and hyphen (up to 80 chars).")
        if not isinstance(password, str) or len(password) < 12:
            raise SystemExit(f"Admin password for {username!r} must contain at least 12 characters.")
        salt = secrets.token_bytes(16)
        admins[username] = (salt, hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS))
    return admins


ADMINS = load_admins()
DUMMY_SALT = secrets.token_bytes(16)
DUMMY_HASH = hashlib.pbkdf2_hmac("sha256", secrets.token_bytes(24), DUMMY_SALT, PBKDF2_ROUNDS)
SESSIONS: dict[str, dict[str, object]] = {}
LOGIN_FAILURES: dict[str, tuple[int, float]] = {}


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=15, factory=ClosingConnection)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def initialize_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with connect_db() as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS resources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                grade_id TEXT NOT NULL,
                subject_id TEXT NOT NULL,
                term_id TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('audio','video','pdf','image')),
                url TEXT NOT NULL DEFAULT '',
                file_name TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )"""
        )


def resource_dict(row: sqlite3.Row) -> dict[str, object]:
    file_name = row["file_name"]
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "gradeId": row["grade_id"],
        "subjectId": row["subject_id"],
        "termId": row["term_id"],
        "type": row["kind"],
        "url": row["url"],
        "fileUrl": f"./uploads/{file_name}" if file_name else "",
        "updatedAt": row["updated_at"],
    }


def parse_fields(handler: BaseHTTPRequestHandler) -> tuple[dict[str, str], tuple[str, bytes, str] | None]:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0 or length > MAX_REQUEST_BYTES:
        raise ValueError("Upload is empty or larger than the 100 MB limit.")
    content_type = handler.headers.get("Content-Type", "")
    if not content_type.lower().startswith("multipart/form-data;"):
        raise ValueError("Expected a multipart form upload.")
    body = handler.rfile.read(length)
    mime_message = BytesParser(policy=email_policy).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii", "strict") + body
    )
    if not mime_message.is_multipart():
        raise ValueError("Malformed upload form.")
    fields: dict[str, str] = {}
    uploaded_file = None
    for part in mime_message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        payload = part.get_payload(decode=True) or b""
        filename = part.get_filename()
        if filename is not None and name == "file" and payload:
            if len(payload) > MAX_UPLOAD_BYTES:
                raise ValueError("Uploaded file exceeds the 100 MB limit.")
            uploaded_file = (Path(filename.replace("\\", "/")).name, payload, part.get_content_type())
        elif filename is None:
            fields[name] = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    return fields, uploaded_file


class AppHandler(BaseHTTPRequestHandler):
    server_version = "ArchangelosContentServer/1.0"

    def log_message(self, format: str, *args: object) -> None:
        print("%s - %s" % (self.address_string(), format % args))

    def send_bytes(self, status: int, payload: bytes, content_type: str, extra_headers: dict[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, value: object, extra_headers: dict[str, str] | None = None) -> None:
        headers = {"Cache-Control": "no-store"}
        if extra_headers:
            headers.update(extra_headers)
        self.send_bytes(status, json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", headers)

    def send_media_file(self, path: Path, mime_type: str) -> None:
        size = path.stat().st_size
        range_header = self.headers.get("Range", "")
        start, end, status = 0, size - 1, HTTPStatus.OK
        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            if not match or size == 0:
                self.send_bytes(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, b"", "text/plain; charset=utf-8", {"Content-Range": f"bytes */{size}"})
                return
            first, last = match.groups()
            if first:
                start = int(first)
                end = int(last) if last else size - 1
            else:
                suffix_length = int(last or "0")
                start = max(0, size - suffix_length)
            if start >= size or end < start:
                self.send_bytes(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, b"", "text/plain; charset=utf-8", {"Content-Range": f"bytes */{size}"})
                return
            end = min(end, size - 1)
            status = HTTPStatus.PARTIAL_CONTENT

        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with path.open("rb") as media:
            media.seek(start)
            remaining = length
            while remaining:
                chunk = media.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 64 * 1024:
            raise ValueError("Invalid request size.")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object.")
        return value

    def request_path(self) -> str:
        return unquote(urlsplit(self.path).path)

    def session(self) -> tuple[str, dict[str, object]] | tuple[None, None]:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None, None
        morsel = cookie.get(COOKIE_NAME)
        if not morsel:
            return None, None
        token = morsel.value
        session = SESSIONS.get(token)
        if not session:
            return None, None
        if float(session["expires"]) < time.time():
            SESSIONS.pop(token, None)
            return None, None
        return token, session

    def same_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urlsplit(origin)
        expected_host = self.headers.get("Host", "").lower()
        return parsed.netloc.lower() == expected_host and parsed.scheme in {"http", "https"}

    def require_admin(self) -> tuple[str, dict[str, object]] | None:
        if not self.same_origin():
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Cross-origin request rejected."})
            return None
        token, session = self.session()
        csrf = self.headers.get("X-CSRF-Token", "")
        if not token or not session or not secrets.compare_digest(csrf, str(session["csrf"])):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in as an administrator to continue."})
            return None
        return token, session

    def do_GET(self) -> None:
        path = self.request_path()
        if path == "/api/session":
            _, session = self.session()
            if session:
                self.send_json(HTTPStatus.OK, {"authenticated": True, "username": session["username"], "csrfToken": session["csrf"]})
            else:
                self.send_json(HTTPStatus.OK, {"authenticated": False})
            return
        if path == "/api/resources":
            with connect_db() as connection:
                rows = connection.execute("SELECT * FROM resources ORDER BY updated_at DESC").fetchall()
            self.send_json(HTTPStatus.OK, [resource_dict(row) for row in rows])
            return
        if path.startswith("/uploads/"):
            name = path.removeprefix("/uploads/")
            if not re.fullmatch(r"[0-9a-f]{32}\.[a-z0-9]{1,8}", name):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            file_path = UPLOAD_DIR / name
            if not file_path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_media_file(file_path, mime_type)
            return

        relative = "index.html" if path == "/" else path.lstrip("/")
        requested = (APP_DIR / relative).resolve()
        try:
            requested.relative_to(APP_DIR)
        except ValueError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if requested.suffix.lower() in {".py", ".sqlite", ".sqlite3", ".db", ".wal", ".sh"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not requested.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = requested.read_bytes()
        mime_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        if requested.suffix.lower() in {".html", ".js", ".json", ".css"}:
            mime_type += "; charset=utf-8"
        self.send_bytes(HTTPStatus.OK, data, mime_type, {"Cache-Control": "no-cache"})

    def do_POST(self) -> None:
        path = self.request_path()
        if path == "/api/login":
            if not self.same_origin():
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "Cross-origin request rejected."})
                return
            address = self.client_address[0]
            failures, retry_at = LOGIN_FAILURES.get(address, (0, 0.0))
            if retry_at > time.time():
                self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Too many sign-in attempts. Try again in one minute."})
                return
            try:
                data = self.read_json()
            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
                return
            username = str(data.get("username", ""))
            password = str(data.get("password", ""))
            credentials = ADMINS.get(username)
            salt, expected = credentials if credentials else (DUMMY_SALT, DUMMY_HASH)
            candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
            if not credentials or not secrets.compare_digest(candidate, expected):
                failures += 1
                LOGIN_FAILURES[address] = (failures, time.time() + 60 if failures >= 8 else 0.0)
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Invalid administrator username or password."})
                return
            LOGIN_FAILURES.pop(address, None)
            token = secrets.token_urlsafe(32)
            csrf = secrets.token_urlsafe(32)
            SESSIONS[token] = {"username": username, "csrf": csrf, "expires": time.time() + SESSION_SECONDS}
            cookie = f"{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_SECONDS}"
            if SESSION_SECURE:
                cookie += "; Secure"
            self.send_json(HTTPStatus.OK, {"authenticated": True, "username": username, "csrfToken": csrf}, {"Set-Cookie": cookie})
            return

        if path == "/api/logout":
            current = self.require_admin()
            if not current:
                return
            token, _ = current
            SESSIONS.pop(token, None)
            cookie = f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
            if SESSION_SECURE:
                cookie += "; Secure"
            self.send_json(HTTPStatus.OK, {"authenticated": False}, {"Set-Cookie": cookie})
            return

        if path == "/api/resources":
            if not self.require_admin():
                return
            self.save_resource(None)
            return
        if path.startswith("/api/resources/"):
            if not self.require_admin():
                return
            resource_id = path.removeprefix("/api/resources/")
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", resource_id):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid material id."})
                return
            self.save_resource(resource_id)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def save_resource(self, resource_id: str | None) -> None:
        new_file_path: Path | None = None
        database_saved = False
        try:
            fields, uploaded = parse_fields(self)
            title = fields.get("title", "").strip()
            description = fields.get("description", "").strip()
            grade_id = fields.get("gradeId", "")
            subject_id = fields.get("subjectId", "")
            term_id = fields.get("termId", "")
            kind = fields.get("type", "")
            url = fields.get("url", "").strip()
            if not title or len(title) > 100 or len(description) > 4000:
                raise ValueError("Title or description is missing or too long.")
            if grade_id not in {"kg", "g12", "g34", "g56", "middle", "high", "choir"}:
                raise ValueError("Invalid school level.")
            if subject_id not in {"hymns", "coptic", "liturgy"} or term_id not in {"term-1", "term-2", "term-3"}:
                raise ValueError("Invalid subject or term.")
            if kind not in ALLOWED_EXTENSIONS:
                raise ValueError("Invalid material type.")
            if url:
                parsed = urlsplit(url)
                if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                    raise ValueError("External links must use http or https.")
            if uploaded and url:
                raise ValueError("Upload a file or enter a link, not both.")

            existing = None
            if resource_id:
                with connect_db() as connection:
                    existing = connection.execute("SELECT * FROM resources WHERE id=?", (resource_id,)).fetchone()
                if not existing:
                    self.send_json(HTTPStatus.NOT_FOUND, {"error": "Material not found."})
                    return
            elif not uploaded and not url:
                raise ValueError("Select a file or enter a link.")

            file_name = existing["file_name"] if existing else ""
            if uploaded:
                original_name, payload, uploaded_type = uploaded
                extension = Path(original_name).suffix.lower()
                if extension not in ALLOWED_EXTENSIONS[kind]:
                    raise ValueError("The uploaded file extension does not match the selected material type.")
                expected_prefix = {"audio": "audio/", "video": "video/", "image": "image/", "pdf": "application/pdf"}[kind]
                if uploaded_type and not (uploaded_type.startswith(expected_prefix) if expected_prefix.endswith("/") else uploaded_type == expected_prefix):
                    raise ValueError("The uploaded file type does not match the selected material type.")
                file_name = f"{uuid.uuid4().hex}{extension}"
                new_file_path = UPLOAD_DIR / file_name
                new_file_path.write_bytes(payload)
            elif url:
                file_name = ""
            elif not file_name:
                raise ValueError("Select a file or enter a link.")

            current_id = resource_id or str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            with connect_db() as connection:
                connection.execute(
                    """INSERT INTO resources(id,title,description,grade_id,subject_id,term_id,kind,url,file_name,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
                       grade_id=excluded.grade_id,subject_id=excluded.subject_id,term_id=excluded.term_id,
                       kind=excluded.kind,url=excluded.url,file_name=excluded.file_name,updated_at=excluded.updated_at""",
                    (current_id, title, description, grade_id, subject_id, term_id, kind, url, file_name, timestamp),
                )
                saved = connection.execute("SELECT * FROM resources WHERE id=?", (current_id,)).fetchone()
            database_saved = True
            if existing and existing["file_name"] and existing["file_name"] != file_name:
                try:
                    (UPLOAD_DIR / existing["file_name"]).unlink(missing_ok=True)
                except OSError as error:
                    print(f"Could not remove replaced media file: {error}")
            self.send_json(HTTPStatus.OK if resource_id else HTTPStatus.CREATED, resource_dict(saved))
        except (ValueError, UnicodeError) as error:
            if new_file_path and not database_saved:
                try:
                    new_file_path.unlink(missing_ok=True)
                except OSError:
                    pass
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            if new_file_path and not database_saved:
                try:
                    new_file_path.unlink(missing_ok=True)
                except OSError:
                    pass
            print(f"Resource save failed: {error}")
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Could not save material."})

    def do_DELETE(self) -> None:
        path = self.request_path()
        if not path.startswith("/api/resources/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not self.require_admin():
            return
        resource_id = path.removeprefix("/api/resources/")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", resource_id):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid material id."})
            return
        with connect_db() as connection:
            existing = connection.execute("SELECT file_name FROM resources WHERE id=?", (resource_id,)).fetchone()
            if not existing:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "Material not found."})
                return
            connection.execute("DELETE FROM resources WHERE id=?", (resource_id,))
        if existing["file_name"]:
            try:
                (UPLOAD_DIR / existing["file_name"]).unlink(missing_ok=True)
            except OSError as error:
                print(f"Could not remove deleted media file: {error}")
        self.send_json(HTTPStatus.OK, {"deleted": True})

    def do_PUT(self) -> None:
        path = self.request_path()
        if not path.startswith("/api/resources/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not self.require_admin():
            return
        resource_id = path.removeprefix("/api/resources/")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", resource_id):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid material id."})
            return
        self.save_resource(resource_id)


def main() -> None:
    initialize_db()
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    server.daemon_threads = True
    print(f"Archangelos shared content server running at http://{HOST}:{PORT}")
    print(f"Admin accounts configured: {', '.join(ADMINS)}")
    print(f"Database and uploaded files: {DATA_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
