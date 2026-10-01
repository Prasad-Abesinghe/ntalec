// Minimal SMTP client (node:net + node:tls, no dependencies) for admin notification emails.
//
// Configure with environment variables:
//   SMTP_HOST   e.g. smtp.gmail.com, smtp.office365.com, smtp-relay.brevo.com
//   SMTP_PORT   465 = TLS from the start; 587 (default) / 25 = upgrade with STARTTLS
//   SMTP_USER   login (often the full email address)
//   SMTP_PASS   password or app password
//   SMTP_FROM   sender, e.g. "NTALEC Website <no-reply@ntalec.com>" (defaults to SMTP_USER)
// The connection is always encrypted, except to localhost (local mail relays / testing).
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

const env = (k) => (process.env[k] || '').trim();

export function mailConfig() {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT')) || 587;
  return {
    host,
    port,
    implicitTls: port === 465 || env('SMTP_SECURE') === '1',
    user: env('SMTP_USER'),
    pass: process.env.SMTP_PASS || '',
    from: env('SMTP_FROM') || env('SMTP_USER'),
    local: ['localhost', '127.0.0.1', '::1'].includes(host),
    rejectUnauthorized: env('SMTP_TLS_INSECURE') !== '1' // only for testing against self-signed servers
  };
}

export const mailConfigured = () => { const c = mailConfig(); return Boolean(c.host && c.from); };

// Remove CR/LF so user-supplied text can never inject extra headers
const headerSafe = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const encodeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);
const addressOnly = (s) => (/<([^>]+)>/.exec(s)?.[1] || s).trim();
// Strip characters that could break out of an address
const cleanAddress = (a) => headerSafe(a).replace(/[<>(),;:\s"\\]/g, '');
// Display names are quoted (or RFC 2047-encoded) with anything that could alter the header removed
const displayName = (n) => {
  const c = headerSafe(n).replace(/["\\<>]/g, '').trim();
  return /^[\x20-\x7e]*$/.test(c) ? `"${c}"` : encodeWord(c);
};
// Accepts { name, address } (preferred, used for visitor-supplied data) or a configured "Name <addr>" string
const formatAddress = (a) => {
  if (a && typeof a === 'object') return a.name ? `${displayName(a.name)} <${cleanAddress(a.address)}>` : `<${cleanAddress(a.address)}>`;
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(a);
  return m && m[1] ? `${displayName(m[1])} <${cleanAddress(m[2])}>` : cleanAddress(addressOnly(a));
};
const base64Lines = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');

function buildMessage({ from, to, replyTo, subject, text, html }) {
  const boundary = `ntalec-${randomBytes(12).toString('hex')}`;
  const domain = addressOnly(from).split('@')[1] || os.hostname();
  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${to.map((t) => cleanAddress(addressOnly(t))).join(', ')}`,
    replyTo ? `Reply-To: ${formatAddress(replyTo)}` : null,
    `Subject: ${encodeWord(headerSafe(subject))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${Date.now()}.${randomBytes(8).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ].filter(Boolean);
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', base64Lines(body)].join('\r\n');
  return [...headers, '', part('text/plain', text), part('text/html', html || `<pre>${text}</pre>`), `--${boundary}--`, ''].join('\r\n');
}

// Line-oriented SMTP conversation over a (possibly upgraded) socket
class SmtpSession {
  constructor(socket) { this.attach(socket); }

  attach(socket) {
    this.socket = socket;
    this.buffer = '';
    this.lines = [];
    this.waiter = null;
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      this.buffer += chunk;
      let i;
      while ((i = this.buffer.indexOf('\n')) !== -1) {
        this.lines.push(this.buffer.slice(0, i).replace(/\r$/, ''));
        this.buffer = this.buffer.slice(i + 1);
      }
      this.flush();
    });
    socket.on('error', (err) => this.fail(err));
    socket.on('close', () => this.fail(new Error('SMTP connection closed unexpectedly')));
  }

  fail(err) { if (this.waiter) { const w = this.waiter; this.waiter = null; w.reject(err); } }

  flush() {
    if (!this.waiter) return;
    // A reply ends with a line "250 text" (space after the code); "250-text" continues
    const end = this.lines.findIndex((l) => /^\d{3}(?: |$)/.test(l));
    if (end === -1) return;
    const reply = this.lines.splice(0, end + 1);
    const w = this.waiter;
    this.waiter = null;
    w.resolve({ code: Number(reply[end].slice(0, 3)), lines: reply.map((l) => l.slice(4)) });
  }

  read(expected, what) {
    return new Promise((resolve, reject) => {
      this.waiter = {
        resolve: (r) => (expected.includes(r.code) ? resolve(r) : reject(new Error(`SMTP ${what} failed: ${r.code} ${r.lines.join(' ')}`))),
        reject
      };
      this.flush();
    });
  }

  async cmd(line, expected, what = line.split(' ')[0]) {
    this.socket.write(`${line}\r\n`);
    return this.read(expected, what);
  }
}

const connect = (cfg) => new Promise((resolve, reject) => {
  const opts = { host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized };
  const socket = cfg.implicitTls ? tls.connect(opts) : net.connect(opts);
  socket.setTimeout(20_000, () => socket.destroy(new Error('SMTP connection timed out')));
  socket.once(cfg.implicitTls ? 'secureConnect' : 'connect', () => resolve(socket));
  socket.once('error', reject);
});

// replyTo: { name, address } object (or a trusted "Name <addr>" string)
export async function sendMail({ to, subject, text, html, replyTo }) {
  const cfg = mailConfig();
  if (!cfg.host || !cfg.from) throw new Error('Email is not configured (set SMTP_HOST and SMTP_FROM or SMTP_USER).');
  const recipients = (Array.isArray(to) ? to : String(to).split(',')).map((t) => cleanAddress(addressOnly(t))).filter(Boolean);
  if (!recipients.length) throw new Error('No recipients.');

  let socket = await connect(cfg);
  const s = new SmtpSession(socket);
  const hostname = os.hostname().replace(/[^\w.-]/g, '') || 'localhost';
  try {
    await s.read([220], 'greeting');
    let ehlo = await s.cmd(`EHLO ${hostname}`, [250]);
    const secure = cfg.implicitTls;
    if (!secure) {
      if (ehlo.lines.some((l) => /^STARTTLS\b/i.test(l))) {
        await s.cmd('STARTTLS', [220]);
        socket.removeAllListeners('data');
        socket.removeAllListeners('error');
        socket.removeAllListeners('close');
        socket = await new Promise((resolve, reject) => {
          const t = tls.connect({ socket, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized }, () => resolve(t));
          t.once('error', reject);
        });
        s.attach(socket);
        ehlo = await s.cmd(`EHLO ${hostname}`, [250]);
      } else if (!cfg.local) {
        throw new Error('The SMTP server does not offer encryption (STARTTLS). Use port 465 or a server that supports TLS.');
      }
    }
    if (cfg.user) {
      const auth = ehlo.lines.find((l) => /^AUTH\b/i.test(l)) || '';
      if (/\bPLAIN\b/i.test(auth) || !/\bLOGIN\b/i.test(auth)) {
        await s.cmd(`AUTH PLAIN ${Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString('base64')}`, [235], 'AUTH');
      } else {
        await s.cmd('AUTH LOGIN', [334], 'AUTH');
        await s.cmd(Buffer.from(cfg.user).toString('base64'), [334], 'AUTH');
        await s.cmd(Buffer.from(cfg.pass).toString('base64'), [235], 'AUTH');
      }
    }
    await s.cmd(`MAIL FROM:<${addressOnly(cfg.from)}>`, [250], 'MAIL FROM');
    for (const r of recipients) await s.cmd(`RCPT TO:<${r}>`, [250, 251], 'RCPT TO');
    await s.cmd('DATA', [354]);
    const body = buildMessage({ from: cfg.from, to: recipients, replyTo, subject, text, html })
      .replace(/^\./gm, '..'); // dot-stuffing
    await s.cmd(`${body}\r\n.`, [250], 'message delivery');
    await s.cmd('QUIT', [221]).catch(() => {});
  } finally {
    socket.destroy();
  }
}
