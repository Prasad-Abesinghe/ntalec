// NTALEC web server: public site (server-rendered from the CMS), admin portal and JSON API.
// Zero dependencies — Node.js 22.5+ built-ins only. Start with `npm start` (or `node server/server.js`).
import http from 'node:http';
import { createReadStream, readFileSync, statSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  db, UPLOAD_DIR, CV_DIR, listItems, getItem, createItem, updateItem, deleteItem, reorderItems, getSettings, saveSettings
} from './db.js';
import {
  authenticate, createSession, destroySession, destroyUserSessions, userFromToken, tokenFromRequest, sessionCookie,
  clearSessionCookie, changePassword, rateLimited, createUser, userCount, purgeExpiredSessions, PASSWORD_MIN
} from './auth.js';
import { COLLECTIONS, SETTINGS, ICONS, MESSAGE_STATUSES, APPLICATION_STATUSES, validate, EMAIL_RE } from './schema.js';
import { parseMultipart, sniff } from './multipart.js';
import { renderPage } from './render.js';
import { mailConfig, mailConfigured } from './mailer.js';
import { notifyNewMessage, notifyNewApplication, sendTestEmail, mailStatus, recipients } from './notify.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PROD = process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff2': 'font/woff2'
};

// ---------- first admin from environment ----------
if (userCount() === 0) {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    createUser(process.env.ADMIN_EMAIL, process.env.ADMIN_NAME || 'Admin', process.env.ADMIN_PASSWORD);
    console.log(`Created admin user ${process.env.ADMIN_EMAIL}`);
  } else {
    console.warn('No admin users yet. Create one with:  npm run create-admin');
  }
}
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 3600_000).unref();

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const clientIp = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
const isSecure = (req) => PROD || req.socket.encrypted || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
// Public base URL for links in emails: SITE_URL if set, otherwise derived from the request
const siteUrl = (req) => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = String(req.headers.host || `localhost:${PORT}`).replace(/[^\w.:-]/g, '');
  return `${isSecure(req) ? 'https' : 'http'}://${host}`;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers });
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) { reject(new HttpError(413, 'Upload is too large.')); req.resume(); return; }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Upload is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 100_000) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Expected JSON.');
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

// ---------- static files ----------
function serveFile(req, res, file, { cache = 'public, max-age=3600', extraHeaders = {} } = {}) {
  let stat;
  try { stat = statSync(file); } catch { return send(res, 404, 'Not found'); }
  if (!stat.isFile()) return send(res, 404, 'Not found');
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  const base = { 'Content-Type': type, 'Cache-Control': cache, ETag: etag, 'Accept-Ranges': 'bytes', ...extraHeaders };
  if (req.headers['if-none-match'] === etag) return send(res, 304, null, base);

  // Byte ranges (video seeking)
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stat.size - 1;
    end = Math.min(end, stat.size - 1);
    if (Number.isNaN(start) || start < 0 || start > end) {
      return send(res, 416, null, { 'Content-Range': `bytes */${stat.size}` });
    }
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...base, 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// Resolve a URL path inside a base directory, refusing anything that escapes it
function safeJoin(base, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const full = path.resolve(base, '.' + path.posix.normalize('/' + decoded));
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

let templateCache = { mtime: 0, html: '' };
function renderIndex(req, res) {
  const file = path.join(ROOT, 'index.html');
  const { mtimeMs } = statSync(file);
  if (mtimeMs !== templateCache.mtime) templateCache = { mtime: mtimeMs, html: readFileSync(file, 'utf8') };
  const html = renderPage(templateCache.html);
  send(res, 200, req.method === 'HEAD' ? null : html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
}

// ---------- public API ----------
async function handleContact(req, res) {
  if (rateLimited(`contact:${clientIp(req)}`, 5, 10 * 60_000)) throw new HttpError(429, 'Too many messages. Please try again later.');
  const body = await readJson(req, 20_000);
  if (body._gotcha) return json(res, 200, { ok: true }); // honeypot: pretend success
  const { data, errors } = validate([
    { name: 'name', type: 'text', required: true, max: 80 },
    { name: 'email', type: 'email', required: true, max: 120 },
    { name: 'subject', type: 'text', required: true, max: 120 },
    { name: 'message', type: 'textarea', required: true, max: 3000 }
  ], body);
  if (data.name && data.name.length < 2) errors.name = 'Please enter your full name.';
  if (data.message && data.message.length < 20) errors.message = 'Please tell us a bit more.';
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { fields: errors });
  db.prepare('INSERT INTO messages (name, email, subject, message, ip) VALUES (?, ?, ?, ?, ?)')
    .run(data.name, data.email, data.subject, data.message, clientIp(req));
  json(res, 201, { ok: true });
  notifyNewMessage(data, siteUrl(req));
}

const CV_MAX = 5 * 1024 * 1024;
async function handleApply(req, res) {
  if (rateLimited(`apply:${clientIp(req)}`, 5, 60 * 60_000)) throw new HttpError(429, 'Too many applications. Please try again later.');
  if (!/^multipart\/form-data/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Expected a form upload.');
  const { fields, files } = parseMultipart(await readBody(req, CV_MAX + 200_000), req.headers['content-type']);
  if (fields._gotcha) return json(res, 200, { ok: true });

  const { data, errors } = validate([
    { name: 'name', type: 'text', required: true, max: 80 },
    { name: 'email', type: 'email', required: true, max: 120 },
    { name: 'phone', type: 'text', max: 40 },
    { name: 'linkedin', type: 'url', max: 200 },
    { name: 'cover_letter', type: 'textarea', max: 4000 }
  ], fields);

  const jobId = Number(fields.job_id) || null;
  const job = jobId ? getItem('jobs', jobId) : null;
  if (jobId && (!job || !job.published)) errors.job_id = 'This position is no longer open.';

  const cv = files.cv;
  let kind = null;
  if (!cv) errors.cv = 'Please attach your CV.';
  else {
    kind = sniff(cv.data);
    const ext = path.extname(cv.filename).toLowerCase();
    const ok = (kind === 'pdf' && ext === '.pdf') || (kind === 'doc' && ext === '.doc') || (kind === 'zip' && ext === '.docx');
    if (!ok) errors.cv = 'CV must be a PDF, DOC or DOCX file.';
    if (cv.data.length > CV_MAX) errors.cv = 'CV must be 5 MB or smaller.';
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { fields: errors });

  const ext = { pdf: '.pdf', doc: '.doc', zip: '.docx' }[kind];
  const stored = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  writeFileSync(path.join(CV_DIR, stored), cv.data);
  const cvName = path.basename(cv.filename).replace(/[^\w.\- ()]/g, '_').slice(0, 120) || `cv${ext}`;
  db.prepare(`INSERT INTO applications (job_id, job_title, name, email, phone, linkedin, cover_letter, cv_file, cv_name, ip)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(job ? job.id : null, job ? job.title : 'General application', data.name, data.email, data.phone, data.linkedin,
      data.cover_letter, stored, cvName, clientIp(req));
  json(res, 201, { ok: true });
  notifyNewApplication({ ...data, job_title: job ? job.title : 'General application' }, siteUrl(req));
}

function publicContent() {
  const content = {};
  for (const c of Object.keys(COLLECTIONS)) content[c] = listItems(c, { publishedOnly: true });
  const s = getSettings();
  content.settings = Object.fromEntries(SETTINGS.map((f) => [f.name, s[f.name] || '']));
  return content;
}

// ---------- admin API ----------
function requireUser(req) {
  const user = userFromToken(tokenFromRequest(req));
  if (!user) throw new HttpError(401, 'Please sign in.');
  // CSRF defence: SameSite=Strict cookie + a custom header that cross-site forms cannot send
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-requested-with'] !== 'ntalec-admin') {
    throw new HttpError(403, 'Missing request header.');
  }
  return user;
}

async function handleAdmin(req, res, parts, url) {
  const [resource, id, action] = parts;
  const method = req.method;

  // --- auth endpoints (no session required) ---
  if (resource === 'login' && method === 'POST') {
    if (rateLimited(`login:${clientIp(req)}`, 10, 15 * 60_000)) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
    const { email, password } = await readJson(req);
    const user = authenticate(email, password);
    if (!user) throw new HttpError(401, 'Incorrect email or password.');
    const token = createSession(user.id);
    return json(res, 200, { user: { id: user.id, email: user.email, name: user.name } }, { 'Set-Cookie': sessionCookie(token, isSecure(req)) });
  }
  if (resource === 'logout' && method === 'POST') {
    destroySession(tokenFromRequest(req));
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(isSecure(req)) });
  }

  const user = requireUser(req);

  if (resource === 'me' && method === 'GET') return json(res, 200, { user });

  if (resource === 'password' && method === 'POST') {
    const { current, next } = await readJson(req);
    const err = changePassword(user.id, current, next);
    if (err) throw new HttpError(422, err);
    destroyUserSessions(user.id, tokenFromRequest(req)); // sign out other devices
    return json(res, 200, { ok: true });
  }

  if (resource === 'schema' && method === 'GET') {
    return json(res, 200, { collections: COLLECTIONS, settings: SETTINGS, icons: ICONS, messageStatuses: MESSAGE_STATUSES, applicationStatuses: APPLICATION_STATUSES, passwordMin: PASSWORD_MIN });
  }

  if (resource === 'dashboard' && method === 'GET') {
    const count = (sql, ...a) => db.prepare(sql).get(...a).n;
    return json(res, 200, {
      counts: {
        newMessages: count(`SELECT COUNT(*) n FROM messages WHERE status = 'new'`),
        messages: count('SELECT COUNT(*) n FROM messages'),
        newApplications: count(`SELECT COUNT(*) n FROM applications WHERE status = 'new'`),
        applications: count('SELECT COUNT(*) n FROM applications'),
        openJobs: count(`SELECT COUNT(*) n FROM items WHERE collection = 'jobs' AND published = 1`),
        services: count(`SELECT COUNT(*) n FROM items WHERE collection = 'services' AND published = 1`),
        caseStudies: count(`SELECT COUNT(*) n FROM items WHERE collection = 'case_studies' AND published = 1`)
      },
      recentMessages: db.prepare('SELECT id, name, email, subject, status, created_at FROM messages ORDER BY id DESC LIMIT 5').all(),
      recentApplications: db.prepare('SELECT id, name, email, job_title, status, created_at FROM applications ORDER BY id DESC LIMIT 5').all()
    });
  }

  // --- content collections ---
  if (resource === 'items') {
    const collection = id;
    const def = COLLECTIONS[collection];
    if (!def) throw new HttpError(404, 'Unknown collection.');
    const itemId = Number(action) || null;

    if (method === 'GET' && !action) return json(res, 200, { items: listItems(collection) });
    if (method === 'POST' && action === 'reorder') {
      const { ids } = await readJson(req);
      if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new HttpError(400, 'ids must be a list of numbers.');
      reorderItems(collection, ids);
      return json(res, 200, { items: listItems(collection) });
    }
    if (method === 'POST' && !action) {
      const body = await readJson(req);
      const { data, errors } = validate(def.fields, body);
      if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { fields: errors });
      return json(res, 201, { item: createItem(collection, data, body.published !== false) });
    }
    if (itemId && method === 'PUT') {
      if (!getItem(collection, itemId)) throw new HttpError(404, 'Not found.');
      const body = await readJson(req);
      const { data, errors } = validate(def.fields, body);
      if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { fields: errors });
      return json(res, 200, { item: updateItem(collection, itemId, data, body.published !== false) });
    }
    if (itemId && method === 'DELETE') {
      if (!deleteItem(collection, itemId)) throw new HttpError(404, 'Not found.');
      return json(res, 200, { ok: true });
    }
  }

  // --- settings ---
  if (resource === 'settings') {
    if (method === 'GET') {
      const s = getSettings();
      return json(res, 200, { settings: Object.fromEntries(SETTINGS.map((f) => [f.name, s[f.name] || ''])) });
    }
    if (method === 'PUT') {
      const { data, errors } = validate(SETTINGS, await readJson(req));
      if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', { fields: errors });
      saveSettings(data);
      return json(res, 200, { settings: data });
    }
  }

  // --- messages ---
  if (resource === 'messages') {
    const mid = Number(id) || null;
    if (method === 'GET' && !mid) {
      const status = url.searchParams.get('status');
      const q = `%${url.searchParams.get('q') || ''}%`;
      const rows = MESSAGE_STATUSES.includes(status)
        ? db.prepare('SELECT * FROM messages WHERE status = ? AND (name LIKE ? OR email LIKE ? OR subject LIKE ?) ORDER BY id DESC').all(status, q, q, q)
        : db.prepare(`SELECT * FROM messages WHERE status != 'archived' AND (name LIKE ? OR email LIKE ? OR subject LIKE ?) ORDER BY id DESC`).all(q, q, q);
      return json(res, 200, { messages: rows });
    }
    if (mid && method === 'PATCH') {
      const { status } = await readJson(req);
      if (!MESSAGE_STATUSES.includes(status)) throw new HttpError(422, 'Invalid status.');
      const { changes } = db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, mid);
      if (!changes) throw new HttpError(404, 'Not found.');
      return json(res, 200, { message: db.prepare('SELECT * FROM messages WHERE id = ?').get(mid) });
    }
    if (mid && method === 'DELETE') {
      if (!db.prepare('DELETE FROM messages WHERE id = ?').run(mid).changes) throw new HttpError(404, 'Not found.');
      return json(res, 200, { ok: true });
    }
  }

  // --- applications ---
  if (resource === 'applications') {
    const aid = Number(id) || null;
    if (method === 'GET' && !aid) {
      const status = url.searchParams.get('status');
      const jobId = Number(url.searchParams.get('job')) || null;
      const where = [];
      const args = [];
      if (APPLICATION_STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
      if (jobId) { where.push('job_id = ?'); args.push(jobId); }
      const rows = db.prepare(`SELECT * FROM applications ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`).all(...args);
      return json(res, 200, { applications: rows.map(({ cv_file, ip, ...r }) => ({ ...r, has_cv: !!cv_file })) });
    }
    if (aid && method === 'GET' && action === 'cv') {
      const row = db.prepare('SELECT cv_file, cv_name FROM applications WHERE id = ?').get(aid);
      if (!row || !row.cv_file) throw new HttpError(404, 'No CV on file.');
      const file = path.join(CV_DIR, path.basename(row.cv_file));
      if (!existsSync(file)) throw new HttpError(404, 'CV file is missing.');
      return serveFile(req, res, file, {
        cache: 'private, no-store',
        extraHeaders: { 'Content-Disposition': `attachment; filename="${row.cv_name.replace(/"/g, '')}"` }
      });
    }
    if (aid && method === 'PATCH') {
      const body = await readJson(req);
      const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(aid);
      if (!row) throw new HttpError(404, 'Not found.');
      const status = body.status ?? row.status;
      const notes = String(body.notes ?? row.notes).slice(0, 4000);
      if (!APPLICATION_STATUSES.includes(status)) throw new HttpError(422, 'Invalid status.');
      db.prepare('UPDATE applications SET status = ?, notes = ? WHERE id = ?').run(status, notes, aid);
      const { cv_file, ip, ...updated } = db.prepare('SELECT * FROM applications WHERE id = ?').get(aid);
      return json(res, 200, { application: { ...updated, has_cv: !!cv_file } });
    }
    if (aid && method === 'DELETE') {
      const row = db.prepare('SELECT cv_file FROM applications WHERE id = ?').get(aid);
      if (!row) throw new HttpError(404, 'Not found.');
      db.prepare('DELETE FROM applications WHERE id = ?').run(aid);
      if (row.cv_file) { try { unlinkSync(path.join(CV_DIR, path.basename(row.cv_file))); } catch {} }
      return json(res, 200, { ok: true });
    }
  }

  // --- email notifications: status + test ---
  if (resource === 'mail' && id === 'status' && method === 'GET') {
    const c = mailConfig();
    return json(res, 200, {
      configured: mailConfigured(),
      host: c.host, port: c.port, from: c.from, user: c.user ? c.user.replace(/^(.{2}).*(@.*)?$/, '$1…$2') : '',
      recipients: recipients(),
      ...mailStatus
    });
  }
  if (resource === 'mail' && id === 'test' && method === 'POST') {
    if (rateLimited(`mailtest:${user.id}`, 5, 10 * 60_000)) throw new HttpError(429, 'Too many test emails. Try again in a few minutes.');
    const to = recipients();
    if (!mailConfigured()) throw new HttpError(422, 'Email is not configured on the server yet (see README → Email notifications).');
    if (!to.length) throw new HttpError(422, 'Add a notification address first.');
    try {
      await sendTestEmail(to, siteUrl(req));
    } catch (err) {
      mailStatus.lastErrorAt = new Date().toISOString();
      mailStatus.lastError = err.message;
      throw new HttpError(502, `Sending failed: ${err.message}`);
    }
    return json(res, 200, { ok: true, to });
  }

  // --- image upload (case study images) ---
  if (resource === 'upload' && method === 'POST') {
    if (!/^multipart\/form-data/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Expected a form upload.');
    const { files } = parseMultipart(await readBody(req, 3 * 1024 * 1024 + 100_000), req.headers['content-type']);
    const file = files.file;
    const kind = file && sniff(file.data);
    if (!file || !['png', 'jpg', 'webp'].includes(kind)) throw new HttpError(422, 'Image must be PNG, JPG or WebP.');
    if (file.data.length > 3 * 1024 * 1024) throw new HttpError(422, 'Image must be 3 MB or smaller.');
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${kind}`;
    writeFileSync(path.join(UPLOAD_DIR, name), file.data);
    return json(res, 201, { url: `/uploads/${name}` });
  }

  throw new HttpError(404, 'Not found.');
}

// ---------- router ----------
const STATIC_FILES = new Set(['/robots.txt', '/sitemap.xml']);

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    const parts = p.slice(5).split('/').filter(Boolean);
    if (parts[0] === 'contact' && req.method === 'POST') return handleContact(req, res);
    if (parts[0] === 'apply' && req.method === 'POST') return handleApply(req, res);
    if (parts[0] === 'content' && req.method === 'GET') return json(res, 200, publicContent());
    if (parts[0] === 'admin') return handleAdmin(req, res, parts.slice(1), url);
    throw new HttpError(404, 'Not found.');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });

  if (p === '/' || p === '/index.html') return renderIndex(req, res);
  if (p === '/admin') return send(res, 301, null, { Location: '/admin/' });
  if (p === '/admin/' || p.startsWith('/admin/')) {
    const file = p === '/admin/' ? path.join(ROOT, 'admin', 'index.html') : safeJoin(path.join(ROOT, 'admin'), p.slice(7));
    const adminHeaders = { 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow' };
    return file ? serveFile(req, res, file, { cache: 'no-cache', extraHeaders: adminHeaders }) : send(res, 404, 'Not found');
  }
  if (p.startsWith('/assets/')) {
    const file = safeJoin(path.join(ROOT, 'assets'), p.slice(8));
    return file ? serveFile(req, res, file) : send(res, 404, 'Not found');
  }
  if (p.startsWith('/uploads/')) {
    const file = safeJoin(UPLOAD_DIR, p.slice(9));
    return file ? serveFile(req, res, file, { cache: 'public, max-age=86400' }) : send(res, 404, 'Not found');
  }
  if (STATIC_FILES.has(p)) return serveFile(req, res, path.join(ROOT, p.slice(1)));
  return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (err instanceof HttpError) return json(res, err.status, { error: err.message, ...(err.extra || {}) });
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Please try again.' });
    else res.destroy();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`NTALEC running at http://localhost:${PORT}  (admin: http://localhost:${PORT}/admin/)`);
});
