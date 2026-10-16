const COOKIE_NAME = '__Host-archangelos_admin';
const SESSION_SECONDS = 12 * 60 * 60;
const SESSION_TTL_SECONDS = SESSION_SECONDS;
const UPLOAD_TTL_SECONDS = 24 * 60 * 60;
const PART_BYTES = 32 * 1024 * 1024;
const MAX_R2_PARTS = 10_000;
const MAX_SINGLE_PART_REQUEST_BYTES = 100 * 1024 * 1024;
const R2_MULTIPART_LIFECYCLE_SECONDS = 7 * 24 * 60 * 60;
const FREE_R2_STORAGE_GUARD_BYTES = 9_000_000_000;
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_MAX_STORAGE_BYTES = 8_000_000_000;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

const FILE_RULES = {
  audio: {
    '.mp3': ['audio/mpeg', 'audio/mp3'],
    '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
    '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/mp4a-latm'],
    '.aac': ['audio/aac', 'audio/aacp', 'audio/x-aac'],
    '.flac': ['audio/flac', 'audio/x-flac'],
    '.ogg': ['audio/ogg', 'application/ogg'],
    '.oga': ['audio/ogg', 'application/ogg'],
    '.opus': ['audio/opus', 'audio/ogg'],
  },
  video: {
    '.mp4': ['video/mp4', 'application/mp4'],
    '.webm': ['video/webm'],
    '.ogv': ['video/ogg'],
    '.mov': ['video/quicktime'],
    '.m4v': ['video/mp4', 'video/x-m4v'],
    '.mkv': ['video/x-matroska'],
  },
  image: {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.avif': ['image/avif'],
  },
  pdf: { '.pdf': ['application/pdf'] },
};

const GRADE_IDS = new Set(['kg', 'g12', 'g34', 'g56', 'middle', 'high', 'choir']);
const SUBJECT_IDS = new Set(['hymns', 'coptic', 'liturgy']);
const TERM_IDS = new Set(['term-1', 'term-2', 'term-3']);

class ApiError extends Error {
  constructor(status, message, code = 'request_failed') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, message, code) {
  throw new ApiError(status, message, code);
}

function configuredPositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

function maxUploadBytes(env) {
  return configuredPositiveInteger(env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES, PART_BYTES * MAX_R2_PARTS);
}

function maxStorageBytes(env) {
  return configuredPositiveInteger(env.MAX_STORAGE_BYTES, DEFAULT_MAX_STORAGE_BYTES, FREE_R2_STORAGE_GUARD_BYTES);
}

function cleanText(value, maximum, field, required = false) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > maximum) {
    fail(400, `${field} is missing or too long.`, 'invalid_metadata');
  }
  return result;
}

export function normalizeResource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(400, 'Expected a material record.', 'invalid_metadata');
  }
  const id = cleanText(input.id, 100, 'Material id', true);
  const title = cleanText(input.title, 100, 'Title', true);
  const description = cleanText(input.description, 4000, 'Description');
  const gradeId = String(input.gradeId ?? '');
  const subjectId = String(input.subjectId ?? '');
  const termId = String(input.termId ?? '');
  const type = String(input.type ?? '');
  if (!ID_PATTERN.test(id)) fail(400, 'Invalid material id.', 'invalid_metadata');
  if (!GRADE_IDS.has(gradeId)) fail(400, 'Invalid school level.', 'invalid_metadata');
  if (!SUBJECT_IDS.has(subjectId) || !TERM_IDS.has(termId)) fail(400, 'Invalid subject or term.', 'invalid_metadata');
  if (!Object.hasOwn(FILE_RULES, type)) fail(400, 'Invalid material type.', 'invalid_metadata');

  const url = cleanText(input.url, 2048, 'URL');
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { fail(400, 'External links must use http or https.', 'invalid_url'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      fail(400, 'External links must use http or https.', 'invalid_url');
    }
    if (type === 'video' && !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(parsed.hostname.toLowerCase())) {
      fail(400, 'Use a YouTube link or upload a video file.', 'invalid_video_url');
    }
  }

  const thumbnailUrl = cleanText(input.thumbnailUrl, 2048, 'Thumbnail URL');
  if (thumbnailUrl) {
    let parsed;
    try { parsed = new URL(thumbnailUrl); } catch { fail(400, 'Thumbnail links must use https.', 'invalid_thumbnail_url'); }
    if (parsed.protocol !== 'https:' || !parsed.hostname) fail(400, 'Thumbnail links must use https.', 'invalid_thumbnail_url');
  }

  const status = String(input.status || 'published');
  if (!['draft', 'published'].includes(status)) fail(400, 'Invalid publication status.', 'invalid_metadata');
  const tags = cleanText(input.tags, 500, 'Tags');
  const displayOrder = input.displayOrder === undefined || input.displayOrder === '' ? 0 : Number(input.displayOrder);
  if (!Number.isSafeInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) {
    fail(400, 'Invalid display order.', 'invalid_metadata');
  }

  return { id, title, description, gradeId, subjectId, termId, type, url, thumbnailUrl, status, tags, displayOrder };
}

export function validateUploadInput(input, configuredMax = DEFAULT_MAX_UPLOAD_BYTES) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(400, 'Expected upload metadata.', 'invalid_upload');
  }
  const resource = normalizeResource(input.resource);
  if (resource.url) fail(400, 'Upload a file or enter a link, not both.', 'invalid_upload');

  const fileName = String(input.fileName ?? '').replaceAll('\\', '/').split('/').pop() || '';
  if (!fileName || fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(fileName)) {
    fail(400, 'Invalid file name.', 'invalid_file_name');
  }
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const allowedMimeTypes = FILE_RULES[resource.type][extension];
  if (!allowedMimeTypes) fail(400, 'The file extension does not match the selected material type.', 'invalid_file_type');

  const size = Number(input.size);
  if (!Number.isSafeInteger(size) || size <= 0) fail(400, 'The selected file is empty or has an invalid size.', 'invalid_file_size');
  if (size > configuredMax) fail(413, 'The selected file is larger than the configured upload limit.', 'file_too_large');
  const declaredType = String(input.contentType ?? '').split(';')[0].trim().toLowerCase();
  if (declaredType && declaredType !== 'application/octet-stream' && !allowedMimeTypes.includes(declaredType)) {
    fail(400, 'The uploaded file type does not match the selected material type.', 'invalid_mime_type');
  }

  return {
    resource,
    fileName,
    extension,
    size,
    contentType: allowedMimeTypes[0],
  };
}

export function validateMediaPrefix(contentType, bytes) {
  const prefix = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const asciiAt = (offset, length) => String.fromCharCode(...prefix.subarray(offset, offset + length));
  const startsWith = (...values) => values.every((value, index) => prefix[index] === value);
  switch (contentType) {
    case 'image/jpeg': return startsWith(0xff, 0xd8, 0xff);
    case 'image/png': return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(asciiAt(0, 6));
    case 'image/webp': return asciiAt(0, 4) === 'RIFF' && asciiAt(8, 4) === 'WEBP';
    case 'image/avif': return asciiAt(4, 4) === 'ftyp' && ['avif', 'avis', 'mif1', 'msf1'].includes(asciiAt(8, 4));
    case 'application/pdf': return asciiAt(0, 5) === '%PDF-';
    case 'audio/mpeg':
      return asciiAt(0, 3) === 'ID3' || (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0 && (prefix[1] & 0x06) !== 0);
    case 'audio/wav': return ['RIFF', 'RF64'].includes(asciiAt(0, 4)) && asciiAt(8, 4) === 'WAVE';
    case 'audio/mp4':
    case 'video/mp4':
    case 'video/quicktime': return asciiAt(4, 4) === 'ftyp';
    case 'audio/aac': return prefix[0] === 0xff && (prefix[1] & 0xf6) === 0xf0;
    case 'audio/flac': return asciiAt(0, 4) === 'fLaC';
    case 'audio/ogg':
    case 'audio/opus':
    case 'video/ogg': return asciiAt(0, 4) === 'OggS';
    case 'video/webm':
    case 'video/x-matroska': return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    default: return false;
  }
}

export function resolveByteRange(header, size) {
  if (!header) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return { unsatisfiable: true };
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (!match[1] && !match[2])) return { unsatisfiable: true };

  let offset;
  let length;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { unsatisfiable: true };
    length = Math.min(suffix, size);
    offset = size - length;
  } else {
    offset = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedEnd) || offset >= size || requestedEnd < offset) {
      return { unsatisfiable: true };
    }
    length = Math.min(requestedEnd, size - 1) - offset + 1;
  }
  return { offset, length };
}

function jsonResponse(value, status = 200, headers = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

async function readJson(request, limit = 64 * 1024) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > limit || !request.body) fail(413, 'The request is empty or too large.', 'request_too_large');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    let chunk;
    try { chunk = await reader.read(); } catch { fail(400, 'Malformed JSON request.', 'invalid_json'); }
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      fail(413, 'The request is empty or too large.', 'request_too_large');
    }
    chunks.push(chunk.value);
  }
  if (!length) fail(400, 'The request is empty.', 'invalid_json');
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, 'Malformed JSON request.', 'invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Expected a JSON object.', 'invalid_json');
  return value;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin === 'null') return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function cookieValue(request) {
  const cookies = request.headers.get('Cookie') || '';
  for (const pair of cookies.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === COOKIE_NAME) return pair.slice(separator + 1).trim();
  }
  return '';
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue));
  const right = new TextEncoder().encode(String(rightValue));
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

async function lookupSession(request, env) {
  const token = cookieValue(request);
  if (!SESSION_TOKEN_PATTERN.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'SELECT username, csrf_token, expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?'
  ).bind(tokenHash, now).first();
  return row || null;
}

async function requireAdmin(request, env) {
  if (!sameOrigin(request)) fail(403, 'Cross-origin request rejected.', 'cross_origin');
  const session = await lookupSession(request, env);
  const csrf = request.headers.get('X-CSRF-Token') || '';
  if (!session || !csrf || !constantTimeEqual(csrf, session.csrf_token)) {
    fail(401, 'Sign in as an administrator to continue.', 'unauthorized');
  }
  return session;
}

function cookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function resourceRows(env, includeDrafts = false) {
  const result = await env.DB.prepare(includeDrafts
    ? 'SELECT * FROM resources ORDER BY display_order ASC, updated_at DESC'
    : "SELECT * FROM resources WHERE status = 'published' ORDER BY display_order ASC, updated_at DESC").all();
  return (result.results || []).map(resourceFromRow);
}

function resourceFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    gradeId: row.grade_id,
    subjectId: row.subject_id,
    termId: row.term_id,
    type: row.kind,
    url: row.url || '',
    fileUrl: row.file_key ? `/media/${encodeURIComponent(row.id)}?v=${encodeURIComponent(row.updated_at)}` : '',
    contentType: row.content_type || '',
    sizeBytes: Number(row.size_bytes || 0),
    fileName: row.file_name || '',
    thumbnailUrl: row.thumbnail_url || '',
    status: row.status || 'published',
    tags: row.tags || '',
    displayOrder: Number(row.display_order || 0),
    createdAt: row.created_at || row.updated_at,
    createdBy: row.created_by || '',
    publishedAt: row.published_at || '',
    updatedAt: row.updated_at,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function resourceVersion() {
  return `${nowIso()}-${crypto.randomUUID()}`;
}

async function cleanupExpiredUploads(env) {
  const now = Math.floor(Date.now() / 1000);
  const { results = [] } = await env.DB.prepare(
    'SELECT id, object_key, r2_upload_id, reserved_bytes FROM upload_sessions WHERE expires_at <= ? LIMIT 25'
  ).bind(now).all();
  for (const upload of results) {
    try {
      const completed = await env.MEDIA.head(upload.object_key);
      if (completed) await env.MEDIA.delete(upload.object_key);
      else {
        try { await env.MEDIA.resumeMultipartUpload(upload.object_key, upload.r2_upload_id).abort(); } catch {
          const r2LifecycleExpired = now >= Number(upload.expires_at) + R2_MULTIPART_LIFECYCLE_SECONDS - UPLOAD_TTL_SECONDS;
          if (!r2LifecycleExpired) throw new Error('multipart_cleanup_deferred');
        }
      }
    } catch {
      console.warn('Expired upload cleanup deferred; quota reservation retained.', upload.id);
      continue;
    }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM upload_sessions WHERE id = ?').bind(upload.id),
      env.DB.prepare('UPDATE storage_usage SET reserved_bytes = MAX(0, reserved_bytes - ?) WHERE id = 1').bind(upload.reserved_bytes),
    ]);
  }
}

async function checkLoginThrottle(env, ipHash) {
  const row = await env.DB.prepare('SELECT failures, window_started, blocked_until FROM login_attempts WHERE ip_hash = ?')
    .bind(ipHash).first();
  const now = Math.floor(Date.now() / 1000);
  if (row?.blocked_until > now) fail(429, 'Too many sign-in attempts. Try again in one minute.', 'login_throttled');
  return row && now - row.window_started < 900 ? Number(row.failures) : 0;
}

async function recordLoginFailure(env, ipHash, failures) {
  const now = Math.floor(Date.now() / 1000);
  const blockedUntil = failures >= 8 ? now + 60 : 0;
  await env.DB.prepare(`
    INSERT INTO login_attempts(ip_hash, failures, window_started, blocked_until)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET failures=excluded.failures,
      window_started=excluded.window_started, blocked_until=excluded.blocked_until
  `).bind(ipHash, failures, now, blockedUntil).run();
}

async function login(request, env) {
  if (!sameOrigin(request)) fail(403, 'Cross-origin request rejected.', 'cross_origin');
  const input = await readJson(request);
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  if (username.length > 80 || password.length > 1024) fail(400, 'Invalid administrator credentials.', 'invalid_credentials');
  const expectedUsername = String(env.ARCHANGELOS_ADMIN_USERNAME || 'admin');
  const expectedPassword = String(env.ARCHANGELOS_ADMIN_PASSWORD || '');
  if (!/^[A-Za-z0-9_.@-]{1,80}$/.test(expectedUsername) || expectedPassword.length < 12) {
    fail(503, 'Administrator credentials are not configured securely.', 'configuration_required');
  }
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256Hex(`archangelos-login:${address}`);
  const previousFailures = await checkLoginThrottle(env, ipHash);
  const valid = constantTimeEqual(username, expectedUsername) && constantTimeEqual(password, expectedPassword);
  if (!valid) {
    await recordLoginFailure(env, ipHash, previousFailures + 1);
    fail(401, 'Invalid administrator username or password.', 'invalid_credentials');
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(ipHash).run();
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await env.DB.prepare('INSERT INTO admin_sessions(token_hash, username, csrf_token, expires_at) VALUES(?, ?, ?, ?)')
    .bind(await sha256Hex(token), expectedUsername, csrfToken, expiresAt).run();
  return jsonResponse({ authenticated: true, username: expectedUsername, csrfToken }, 200, {
    'Set-Cookie': cookieHeader(token, SESSION_SECONDS),
  });
}

async function logout(request, env) {
  await requireAdmin(request, env);
  const token = cookieValue(request);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return jsonResponse({ authenticated: false }, 200, { 'Set-Cookie': cookieHeader('', 0) });
}

async function getStorageUsage(env) {
  return env.DB.prepare('SELECT stored_bytes, reserved_bytes FROM storage_usage WHERE id = 1').first();
}

async function startUpload(request, env) {
  const session = await requireAdmin(request, env);
  await cleanupExpiredUploads(env);
  await cleanupOrphanedMedia(env);
  const input = await readJson(request);
  const upload = validateUploadInput(input, maxUploadBytes(env));
  const now = Math.floor(Date.now() / 1000);
  const existing = await env.DB.prepare('SELECT file_key, updated_at FROM resources WHERE id = ?').bind(upload.resource.id).first();
  if (existing && input.isNew === true) fail(409, 'A material with this id already exists.', 'duplicate_id');
  if (!existing && input.isNew === false) fail(404, 'Material not found.', 'material_not_found');

  let oldBytes = 0;
  if (existing?.file_key) {
    const references = await env.DB.prepare('SELECT COUNT(*) AS count FROM resources WHERE file_key = ?').bind(existing.file_key).first();
    const oldObject = await env.DB.prepare('SELECT size_bytes FROM media_objects WHERE object_key = ?').bind(existing.file_key).first();
    if (Number(references?.count || 0) === 1) oldBytes = Number(oldObject?.size_bytes || 0);
  }

  const usage = await getStorageUsage(env);
  if (!usage) fail(503, 'Storage quota tracking is not initialized.', 'storage_unavailable');
  const stored = Number(usage.stored_bytes || 0);
  const reserved = Number(usage.reserved_bytes || 0);
  const logicalTotal = stored - oldBytes + reserved + upload.size;
  const temporaryTotal = stored + reserved + upload.size;
  if (logicalTotal > maxStorageBytes(env) || temporaryTotal > FREE_R2_STORAGE_GUARD_BYTES) {
    fail(507, 'The free storage safety limit has been reached. Delete old materials or review the account quota.', 'storage_quota');
  }

  const quotaReservation = await env.DB.prepare(`
    UPDATE storage_usage SET reserved_bytes = reserved_bytes + ?
    WHERE id = 1 AND stored_bytes + reserved_bytes + ? <= ?
      AND stored_bytes + reserved_bytes + ? <= ?
  `).bind(upload.size, upload.size, FREE_R2_STORAGE_GUARD_BYTES, upload.size, maxStorageBytes(env) + oldBytes).run();
  if (Number(quotaReservation.meta?.changes || 0) !== 1) {
    fail(507, 'The free storage safety limit has been reached. Delete old materials or review the account quota.', 'storage_quota');
  }

  const uploadId = crypto.randomUUID().replaceAll('-', '');
  const objectKey = `school/${upload.resource.id}/${crypto.randomUUID().replaceAll('-', '')}${upload.extension}`;
  let multipart;
  try {
    multipart = await env.MEDIA.createMultipartUpload(objectKey, {
      httpMetadata: {
        contentType: upload.contentType,
        contentDisposition: 'inline',
        cacheControl: 'public, max-age=300',
      },
    });
    const metadata = JSON.stringify(upload.resource);
    await env.DB.prepare(`
      INSERT INTO upload_sessions(
        id, r2_upload_id, object_key, resource_id, username, expected_bytes,
        part_bytes, content_type, kind, metadata_json, old_updated_at,
        reserved_bytes, parts_json, expires_at, file_name
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).bind(
      uploadId, multipart.uploadId, objectKey, upload.resource.id, session.username,
      upload.size, PART_BYTES, upload.contentType, upload.resource.type, metadata,
      existing?.updated_at || '', upload.size, now + UPLOAD_TTL_SECONDS, upload.fileName,
    ).run();
  } catch (error) {
    if (multipart) {
      try { await multipart.abort(); } catch { /* The R2 multipart lifecycle expires abandoned uploads. */ }
    }
    await env.DB.prepare('UPDATE storage_usage SET reserved_bytes = MAX(0, reserved_bytes - ?) WHERE id = 1').bind(upload.size).run();
    throw error;
  }

  return jsonResponse({ uploadId, partBytes: PART_BYTES, sizeBytes: upload.size, parts: [] }, 201);
}

async function loadUpload(uploadId, session, env) {
  const row = await env.DB.prepare('SELECT * FROM upload_sessions WHERE id = ? AND username = ?')
    .bind(uploadId, session.username).first();
  if (!row) fail(404, 'Upload session not found. Start the upload again.', 'upload_not_found');
  if (Number(row.expires_at) <= Math.floor(Date.now() / 1000)) {
    await cleanupExpiredUploads(env);
    fail(410, 'This upload session expired. Start the upload again.', 'upload_expired');
  }
  return row;
}

async function uploadPart(request, uploadId, partNumber, env) {
  const session = await requireAdmin(request, env);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_R2_PARTS) {
    fail(400, 'Invalid upload part number.', 'invalid_part');
  }
  const row = await loadUpload(uploadId, session, env);
  const partCount = Math.ceil(Number(row.expected_bytes) / Number(row.part_bytes));
  if (partNumber > partCount) fail(400, 'Invalid upload part number.', 'invalid_part');
  const expectedBytes = Math.min(Number(row.part_bytes), Number(row.expected_bytes) - (partNumber - 1) * Number(row.part_bytes));
  const contentLength = request.headers.get('Content-Length');
  const requestLength = contentLength ? Number(contentLength) : 0;
  if ((requestLength && requestLength !== expectedBytes) || requestLength > MAX_SINGLE_PART_REQUEST_BYTES || !request.body) {
    fail(413, 'The upload part size is invalid. Retry the upload.', 'invalid_part_size');
  }

  let receivedBytes = 0;
  const filePrefix = new Uint8Array(16);
  let prefixLength = 0;
  const countedBody = request.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      receivedBytes += chunk.byteLength;
      if (receivedBytes > expectedBytes) throw new Error('part_size_mismatch');
      if (partNumber === 1 && prefixLength < filePrefix.length) {
        const prefixChunk = chunk.subarray(0, filePrefix.length - prefixLength);
        filePrefix.set(prefixChunk, prefixLength);
        prefixLength += prefixChunk.byteLength;
      }
      controller.enqueue(chunk);
    },
  }));
  const fixedLength = new FixedLengthStream(expectedBytes);
  const bodyPump = countedBody.pipeTo(fixedLength.writable);
  const multipart = env.MEDIA.resumeMultipartUpload(row.object_key, row.r2_upload_id);
  let uploadedPart;
  try {
    [uploadedPart] = await Promise.all([
      multipart.uploadPart(partNumber, fixedLength.readable),
      bodyPump,
    ]);
  } catch {
    if (receivedBytes !== expectedBytes) {
      fail(receivedBytes > expectedBytes ? 413 : 400,
        'The upload part size did not match the selected file.', 'invalid_part_size');
    }
    fail(502, 'The storage provider rejected this upload part. Retry it.', 'storage_part_failed');
  }
  if (receivedBytes !== expectedBytes) fail(400, 'The upload part size did not match the selected file.', 'invalid_part_size');
  if (partNumber === 1 && !validateMediaPrefix(row.content_type, filePrefix.subarray(0, prefixLength))) {
    await releaseUpload(row, env);
    fail(400, 'The file contents do not match the selected media type.', 'invalid_file_content');
  }

  const savedParts = JSON.parse(row.parts_json || '[]').filter((part) => part.partNumber !== partNumber);
  savedParts.push({ partNumber, etag: uploadedPart.etag });
  savedParts.sort((left, right) => left.partNumber - right.partNumber);
  await env.DB.prepare('UPDATE upload_sessions SET parts_json = ? WHERE id = ?')
    .bind(JSON.stringify(savedParts), uploadId).run();
  return jsonResponse({ partNumber, etag: uploadedPart.etag });
}

async function releaseUpload(row, env, deleteObject = false) {
  if (deleteObject) {
    try { await env.MEDIA.delete(row.object_key); } catch {
      console.error('Could not remove an uncommitted media object; quota reservation retained.', row.object_key);
      return false;
    }
  } else {
    try { await env.MEDIA.resumeMultipartUpload(row.object_key, row.r2_upload_id).abort(); } catch {
      console.warn('Incomplete upload cleanup deferred; quota reservation retained.', row.id);
      return false;
    }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM upload_sessions WHERE id = ?').bind(row.id),
    env.DB.prepare('UPDATE storage_usage SET reserved_bytes = MAX(0, reserved_bytes - ?) WHERE id = 1').bind(row.reserved_bytes),
  ]);
  return true;
}

async function removeObjectIfUnreferenced(objectKey, env) {
  if (!objectKey) return;
  const references = await env.DB.prepare('SELECT COUNT(*) AS count FROM resources WHERE file_key = ?').bind(objectKey).first();
  if (Number(references?.count || 0) !== 0) return;
  const object = await env.DB.prepare('SELECT size_bytes FROM media_objects WHERE object_key = ?').bind(objectKey).first();
  if (!object) return;
  await env.MEDIA.delete(objectKey);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM media_objects WHERE object_key = ?').bind(objectKey),
    env.DB.prepare('UPDATE storage_usage SET stored_bytes = MAX(0, stored_bytes - ?) WHERE id = 1').bind(Number(object.size_bytes || 0)),
  ]);
}

async function cleanupOrphanedMedia(env) {
  const { results = [] } = await env.DB.prepare(`
    SELECT media_objects.object_key, media_objects.size_bytes
    FROM media_objects
    WHERE NOT EXISTS (
      SELECT 1 FROM resources WHERE resources.file_key = media_objects.object_key
    )
    ORDER BY media_objects.created_at
    LIMIT 25
  `).all();
  for (const object of results) {
    try {
      await env.MEDIA.delete(object.object_key);
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE storage_usage SET stored_bytes = MAX(0, stored_bytes - ?)
          WHERE id = 1
            AND EXISTS (SELECT 1 FROM media_objects WHERE object_key = ?)
            AND NOT EXISTS (SELECT 1 FROM resources WHERE file_key = ?)
        `).bind(Number(object.size_bytes || 0), object.object_key, object.object_key),
        env.DB.prepare(`
          DELETE FROM media_objects
          WHERE object_key = ?
            AND NOT EXISTS (SELECT 1 FROM resources WHERE file_key = ?)
        `).bind(object.object_key, object.object_key),
      ]);
    } catch (error) {
      console.warn('Orphaned media cleanup deferred.', error?.message || 'storage_error');
    }
  }
}

async function completeUpload(request, uploadId, env) {
  const session = await requireAdmin(request, env);
  const row = await loadUpload(uploadId, session, env);
  const input = await readJson(request, 2 * 1024 * 1024);
  const parts = input.parts;
  const expectedCount = Math.ceil(Number(row.expected_bytes) / Number(row.part_bytes));
  const storedParts = JSON.parse(row.parts_json || '[]');
  if (!Array.isArray(parts) || parts.length !== expectedCount || storedParts.length !== expectedCount) {
    fail(400, 'The upload is incomplete. Retry any missing parts.', 'upload_incomplete');
  }
  const verifiedParts = [];
  for (let index = 0; index < expectedCount; index += 1) {
    const part = parts[index];
    const storedPart = storedParts[index];
    if (!part || Number(part.partNumber) !== index + 1 || Number(storedPart.partNumber) !== index + 1 ||
        !/^[A-Za-z0-9+/_=-]{8,256}$/.test(String(part.etag || '')) || !constantTimeEqual(part.etag, storedPart.etag)) {
      fail(400, 'The upload part list is invalid. Retry the upload.', 'invalid_parts');
    }
    verifiedParts.push({ partNumber: index + 1, etag: storedPart.etag });
  }

  const multipart = env.MEDIA.resumeMultipartUpload(row.object_key, row.r2_upload_id);
  let object;
  try {
    object = await multipart.complete(verifiedParts);
  } catch {
    fail(502, 'The storage provider could not finish the upload. Retry the missing parts.', 'storage_complete_failed');
  }
  if (Number(object.size) !== Number(row.expected_bytes)) {
    await releaseUpload(row, env, true);
    fail(400, 'The completed file size did not match the selected file.', 'completed_size_mismatch');
  }

  const resource = JSON.parse(row.metadata_json);
  const current = await env.DB.prepare('SELECT file_key, updated_at, status, published_at, created_at, created_by FROM resources WHERE id = ?').bind(row.resource_id).first();
  const expectedUpdatedAt = row.old_updated_at || '';
  if ((current?.updated_at || '') !== expectedUpdatedAt) {
    await releaseUpload(row, env, true);
    fail(409, 'This material changed while the file was uploading. Reopen it and try again.', 'material_changed');
  }

  const updatedAt = resourceVersion();
  const createdAt = nowIso();
  const publishedAt = resource.status === 'published'
    ? (current?.status === 'published' && current.published_at ? current.published_at : createdAt)
    : (current?.published_at || '');
  let completionResults;
  try {
    completionResults = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO resources(
          id, title, description, grade_id, subject_id, term_id, kind, url, file_key,
          size_bytes, content_type, updated_at, status, tags, display_order, file_name,
          created_at, created_by, published_at, thumbnail_url
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM upload_sessions WHERE id = ? AND username = ? AND object_key = ?
        )
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
          grade_id=excluded.grade_id, subject_id=excluded.subject_id, term_id=excluded.term_id,
          kind=excluded.kind, url='', file_key=excluded.file_key, size_bytes=excluded.size_bytes,
          content_type=excluded.content_type, updated_at=excluded.updated_at, status=excluded.status,
          tags=excluded.tags, display_order=excluded.display_order, file_name=excluded.file_name,
          published_at=excluded.published_at, thumbnail_url=excluded.thumbnail_url
        WHERE resources.updated_at = ?
          AND EXISTS (
            SELECT 1 FROM upload_sessions WHERE id = ? AND username = ? AND object_key = ?
          )
      `).bind(resource.id, resource.title, resource.description, resource.gradeId, resource.subjectId, resource.termId,
        resource.type, row.object_key, row.expected_bytes, row.content_type, updatedAt, resource.status,
        resource.tags, resource.displayOrder, row.file_name, current?.created_at || createdAt,
        current?.created_by || row.username, publishedAt, resource.thumbnailUrl,
        row.id, row.username, row.object_key, expectedUpdatedAt, row.id, row.username, row.object_key),
      env.DB.prepare(`
        INSERT INTO media_objects(object_key, size_bytes, content_type, created_at)
        SELECT ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM resources WHERE id = ? AND file_key = ? AND updated_at = ?
        )
      `).bind(row.object_key, row.expected_bytes, row.content_type, createdAt, resource.id, row.object_key, updatedAt),
      env.DB.prepare(`
        UPDATE storage_usage SET stored_bytes = stored_bytes + ?, reserved_bytes = MAX(0, reserved_bytes - ?)
        WHERE id = 1
          AND EXISTS (SELECT 1 FROM media_objects WHERE object_key = ?)
          AND EXISTS (SELECT 1 FROM resources WHERE id = ? AND file_key = ? AND updated_at = ?)
      `).bind(row.expected_bytes, row.reserved_bytes, row.object_key, resource.id, row.object_key, updatedAt),
      env.DB.prepare(`
        DELETE FROM upload_sessions
        WHERE id = ? AND username = ? AND object_key = ?
          AND EXISTS (SELECT 1 FROM media_objects WHERE object_key = ?)
      `).bind(row.id, row.username, row.object_key, row.object_key),
    ]);
  } catch (error) {
    await releaseUpload(row, env, true);
    throw error;
  }
  if (Number(completionResults?.[0]?.meta?.changes || 0) !== 1) {
    await releaseUpload(row, env, true);
    fail(409, 'This material changed while the file was uploading. Reopen it and try again.', 'material_changed');
  }

  if (current?.file_key && current.file_key !== row.object_key) {
    try { await removeObjectIfUnreferenced(current.file_key, env); } catch (error) { console.warn('Old media cleanup deferred.', error?.message || 'storage_error'); }
  }
  const saved = await env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(resource.id).first();
  return jsonResponse(resourceFromRow(saved), 201);
}

async function cancelUpload(request, uploadId, env) {
  const session = await requireAdmin(request, env);
  const row = await loadUpload(uploadId, session, env);
  if (!await releaseUpload(row, env)) {
    fail(503, 'Upload cleanup is pending. The reserved quota will be retained until cleanup succeeds.', 'upload_cleanup_pending');
  }
  return jsonResponse({ cancelled: true });
}

async function saveResource(request, env, resourceId = '') {
  const session = await requireAdmin(request, env);
  const input = await readJson(request);
  const resource = normalizeResource({ ...input, id: resourceId || input.id });
  const existing = await env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(resource.id).first();
  if (resourceId && !existing) fail(404, 'Material not found.', 'material_not_found');
  if (!resourceId && existing) fail(409, 'A material with this id already exists.', 'duplicate_id');
  if (resource.url && existing?.file_key) {
    // The metadata update is committed before storage cleanup so a cleanup failure never loses the saved record.
  } else if (!resource.url && !existing?.file_key) {
    fail(400, 'Select a file or enter a link.', 'media_required');
  } else if (!resource.url && existing?.file_key && existing.kind !== resource.type) {
    fail(400, 'Upload a replacement file before changing its material type.', 'replacement_required');
  }

  const updatedAt = resourceVersion();
  const now = nowIso();
  const publishedAt = resource.status === 'published'
    ? (existing?.status === 'published' && existing.published_at ? existing.published_at : now)
    : (existing?.published_at || '');
  const fileKey = resource.url ? '' : (existing?.file_key || '');
  await env.DB.prepare(`
    INSERT INTO resources(
      id, title, description, grade_id, subject_id, term_id, kind, url, file_key,
      size_bytes, content_type, updated_at, status, tags, display_order, file_name,
      created_at, created_by, published_at, thumbnail_url
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
      grade_id=excluded.grade_id, subject_id=excluded.subject_id, term_id=excluded.term_id,
      kind=excluded.kind, url=excluded.url, file_key=excluded.file_key, size_bytes=excluded.size_bytes,
      content_type=excluded.content_type, updated_at=excluded.updated_at, status=excluded.status,
      tags=excluded.tags, display_order=excluded.display_order, file_name=excluded.file_name,
      published_at=excluded.published_at, thumbnail_url=excluded.thumbnail_url
  `).bind(resource.id, resource.title, resource.description, resource.gradeId, resource.subjectId, resource.termId,
    resource.type, resource.url, fileKey, resource.url ? 0 : Number(existing?.size_bytes || 0),
    resource.url ? '' : (existing?.content_type || ''), updatedAt, resource.status, resource.tags,
    resource.displayOrder, resource.url ? '' : (existing?.file_name || ''), existing?.created_at || now,
    existing?.created_by || session.username, publishedAt, resource.thumbnailUrl).run();

  if (resource.url && existing?.file_key) {
    try { await removeObjectIfUnreferenced(existing.file_key, env); } catch (error) { console.warn('Old media cleanup deferred.', error?.message || 'storage_error'); }
  }
  const saved = await env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(resource.id).first();
  return jsonResponse(resourceFromRow(saved), resourceId ? 200 : 201);
}

async function deleteResource(request, env, resourceId) {
  await requireAdmin(request, env);
  if (!ID_PATTERN.test(resourceId)) fail(400, 'Invalid material id.', 'invalid_metadata');
  const existing = await env.DB.prepare('SELECT file_key FROM resources WHERE id = ?').bind(resourceId).first();
  if (!existing) fail(404, 'Material not found.', 'material_not_found');
  await env.DB.prepare('DELETE FROM resources WHERE id = ?').bind(resourceId).run();
  let storageCleanupPending = false;
  if (existing.file_key) {
    try { await removeObjectIfUnreferenced(existing.file_key, env); } catch (error) {
      storageCleanupPending = true;
      console.warn('Deleted media cleanup deferred.', error?.message || 'storage_error');
    }
  }
  return jsonResponse({ deleted: true, storageCleanupPending });
}

async function mediaResponse(request, env, resourceId) {
  if (!ID_PATTERN.test(resourceId) || !['GET', 'HEAD'].includes(request.method)) {
    return new Response('Not found', { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });
  }
  const row = await env.DB.prepare('SELECT file_key, size_bytes, content_type, status FROM resources WHERE id = ?')
    .bind(resourceId).first();
  if (!row?.file_key) return new Response('Not found', { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });
  if (row.status === 'draft' && !await lookupSession(request, env)) {
    return new Response('Not found', { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });
  }
  const size = Number(row.size_bytes || 0);
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=300',
    'Content-Type': row.content_type || 'application/octet-stream',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  if (new URL(request.url).searchParams.get('download') === '1') {
    const extension = /\.[a-z0-9]{1,8}$/i.exec(String(row.file_key))?.[0]?.toLowerCase() || '';
    headers.set('Content-Disposition', `attachment; filename="${resourceId}${extension}"`);
  }
  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(size));
    return new Response(null, { status: 200, headers });
  }

  const requestedRange = resolveByteRange(request.headers.get('Range'), size);
  if (requestedRange?.unsatisfiable) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const object = await env.MEDIA.get(row.file_key, requestedRange ? { range: requestedRange } : undefined);
  if (!object || !('body' in object)) return new Response('Not found', { status: 404, headers });
  headers.set('ETag', object.httpEtag);
  if (requestedRange) {
    const first = Number(object.range?.offset ?? requestedRange.offset);
    const length = Number(object.range?.length ?? requestedRange.length);
    headers.set('Content-Length', String(length));
    headers.set('Content-Range', `bytes ${first}-${first + length - 1}/${size}`);
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(size));
  return new Response(object.body, { status: 200, headers });
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/config' && request.method === 'GET') {
    const usage = await getStorageUsage(env);
    return jsonResponse({
      maxUploadBytes: maxUploadBytes(env),
      partBytes: PART_BYTES,
      maxStorageBytes: maxStorageBytes(env),
      storedBytes: Number(usage?.stored_bytes || 0),
    });
  }
  if (pathname === '/api/session' && request.method === 'GET') {
    const session = await lookupSession(request, env);
    return jsonResponse(session
      ? { authenticated: true, username: session.username, csrfToken: session.csrf_token }
      : { authenticated: false });
  }
  if (pathname === '/api/resources' && request.method === 'GET') {
    return jsonResponse(await resourceRows(env, Boolean(await lookupSession(request, env))));
  }
  if (pathname === '/api/login' && request.method === 'POST') return login(request, env);
  if (pathname === '/api/logout' && request.method === 'POST') return logout(request, env);
  if (pathname === '/api/uploads/start' && request.method === 'POST') return startUpload(request, env);

  const partMatch = /^\/api\/uploads\/([a-f0-9]{32})\/parts\/(\d+)$/.exec(pathname);
  if (partMatch && request.method === 'PUT') return uploadPart(request, partMatch[1], Number(partMatch[2]), env);
  const completeMatch = /^\/api\/uploads\/([a-f0-9]{32})\/complete$/.exec(pathname);
  if (completeMatch && request.method === 'POST') return completeUpload(request, completeMatch[1], env);
  const cancelMatch = /^\/api\/uploads\/([a-f0-9]{32})$/.exec(pathname);
  if (cancelMatch && request.method === 'DELETE') return cancelUpload(request, cancelMatch[1], env);

  if (pathname === '/api/resources' && request.method === 'POST') return saveResource(request, env);
  const resourceMatch = /^\/api\/resources\/([^/]+)$/.exec(pathname);
  if (resourceMatch && request.method === 'PUT') return saveResource(request, env, decodeURIComponent(resourceMatch[1]));
  if (resourceMatch && request.method === 'DELETE') return deleteResource(request, env, decodeURIComponent(resourceMatch[1]));
  return jsonResponse({ error: 'Not found.', code: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith('/api/')) return await handleApi(request, env);
      if (pathname.startsWith('/media/')) return await mediaResponse(request, env, decodeURIComponent(pathname.slice('/media/'.length)));
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse({ error: error.message, code: error.code }, error.status);
      console.error('Request failed.', error?.message || 'unknown_error');
      return jsonResponse({ error: 'The service could not complete the request. Check storage configuration and quota.', code: 'service_error' }, 503);
    }
  },
};
