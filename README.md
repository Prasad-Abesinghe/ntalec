# NTALEC — Company Website & Admin Portal

Responsive, SEO-ready company website (HTML5, Tailwind CSS, vanilla JavaScript) with a built-in admin portal.
The server is plain Node.js with **no npm dependencies** — it uses Node's built-in HTTP server, SQLite (`node:sqlite`)
and crypto modules.

## Structure

```
index.html              Website: header, scroll story (hero → services → case studies → about → careers), contact, footer
assets/css/styles.css   Website styles (buttons, cards, scenes, forms, application dialog, animations)
assets/js/main.js       Website behaviour: menu, scroll-driven videos, contact form, job application dialog
assets/img/logo.svg     Logo mark + favicon
assets/video/*.mp4      Hero video (scroll-driven) and one intro video per section
robots.txt, sitemap.xml SEO crawl files

server/server.js        Web server: public site (rendered from the database), admin API, uploads
server/db.js            SQLite schema + queries (database lives in data/)
server/schema.js        Content model: collections, fields, icons, settings, validation
server/render.js        Fills the <!--cms:…--> regions of index.html from the database
server/auth.js          Password hashing (scrypt), sessions, rate limiting
server/multipart.js     File-upload parsing + file-type detection
server/seed.js          Initial content (mirrors the original static page)
server/create-admin.js  CLI to create admin users
server/mailer.js        Built-in SMTP client (STARTTLS/TLS, AUTH PLAIN/LOGIN)
server/notify.js        Notification emails for new messages and applications

admin/                  Admin portal (single-page app): index.html, admin.js, admin.css
data/                   Created at runtime: ntalec.db, uploads/ (public images), cvs/ (private CVs) — not in git
```

## Run locally

Requires **Node.js 22.5 or newer** (tested on Node 24).

```
npm run create-admin      # first time only: prompts for email, name and password
npm start                 # http://localhost:3000   ·   admin: http://localhost:3000/admin/
```

`npm run dev` restarts the server automatically when server files change.
The first start creates `data/ntalec.db` and fills it with the site's current content.

The site still works as plain static files (open `index.html` or use any static host) — it then shows the
content written in `index.html` and the contact/application forms cannot submit.

## Admin portal (`/admin/`)

| Area | What admins can do |
|---|---|
| Email notifications | New messages / applications emailed to chosen addresses (see below) |
| Dashboard | New messages / applications, open jobs, recent activity |
| Messages | Contact-form inbox: search, filter (new / read / replied / archived), reply by email, archive, delete |
| Applications | Job applications with CV download, status pipeline (new → reviewing → shortlisted → interview → hired / rejected), internal notes |
| Services · Case Studies · Jobs | Add, edit, hide/show, reorder and delete; case studies can use an uploaded image; closing a job removes it from the site |
| About Us | Stats, values and timeline |
| Site settings | Contact email, phone, address, social links, SEO title/description, social-share text |
| Account | Change password (signs out other devices) |

Changes appear on the website on the next page load. Add more admins with `npm run create-admin`.

**How the website uses it:** `index.html` marks the editable parts with `<!--cms:name-->…<!--/cms:name-->`.
When the server sends the page it replaces those regions with database content (so search engines see it).
The contact form posts to `/api/contact`; job "Apply" / "Send us your CV" buttons open a form that posts to
`/api/apply` with the CV.

**Security:** passwords are hashed with scrypt; sessions use random tokens in `HttpOnly`, `SameSite=Strict`
cookies; admin changes also require an `X-Requested-With` header (CSRF protection); login, contact and
application endpoints are rate-limited; uploads are checked by file contents (CVs: PDF/DOC/DOCX ≤ 5 MB,
images: PNG/JPG/WebP ≤ 3 MB — no SVG); CVs are stored outside the public folder and only admins can download
them; all content is HTML-escaped when rendered; only whitelisted paths are served.

## Email notifications

The server can email you when a contact message or job application arrives (sent in the background — a mail
problem never affects the visitor, and everything is still saved in the admin portal).

**1. Give the server an outgoing mail account** with these environment variables, then restart:

| Variable | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` · `smtp.office365.com` · `smtp.zoho.com` · `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` (STARTTLS, default) or `465` (TLS) |
| `SMTP_USER` | the mailbox login, usually the full address |
| `SMTP_PASS` | its password — for Gmail / Google Workspace use an **app password** (Google Account → Security → App passwords; requires 2-step verification) |
| `SMTP_FROM` | `NTALEC Website <no-reply@ntalec.com>` (must be an address the account may send from) |
| `SITE_URL` | `https://www.ntalec.com` — used for the "Open inbox" links in emails |

The connection is always encrypted (STARTTLS or TLS) and the password is never stored in the database or shown
in the admin portal.

**2. In Admin → Site settings → Email notifications** choose who receives them (one or more addresses; empty =
the contact email), switch message / application emails on or off, save, and click **Send test email**. The
panel shows which server is used and the last delivery result or error.

Message emails have **Reply-To set to the visitor**, so you can answer by simply replying. Application emails
link to the application; CVs stay in the admin portal (they are not attached to emails).

On Windows (PowerShell) for local testing:

```
$env:SMTP_HOST="smtp.gmail.com"; $env:SMTP_PORT="465"; $env:SMTP_USER="you@gmail.com"; $env:SMTP_PASS="your-app-password"; $env:SMTP_FROM="NTALEC Website <you@gmail.com>"; npm start
```

## Deploying

Any host that runs a long-lived Node.js process with a **persistent disk** works (a VPS, Render, Railway, Fly.io…).
The `data/` folder holds the database, uploaded images and CVs — it must survive restarts and redeploys.

| Variable | Purpose |
|---|---|
| `PORT` / `HOST` | Listen address (default `3000` / `0.0.0.0`) |
| `DATA_DIR` | Where the database, uploads and CVs are stored (default `./data`); point it at the persistent disk |
| `NODE_ENV=production` | Marks the session cookie `Secure` (requires HTTPS) |
| `TRUST_PROXY=1` | Behind a reverse proxy / platform load balancer: use `X-Forwarded-For` / `-Proto` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Optional: create the first admin on startup when none exists (useful on hosts without a shell) |

Serve the site over HTTPS (platforms do this for you; on a VPS put Nginx or Caddy in front).
**Back up `data/` regularly** — for example a nightly copy of the folder.

## Before going live — replace placeholders

| What | Where |
|---|---|
| Contact email, phone, address, social links, SEO text | Admin → **Site settings** |
| Case studies, jobs, About Us stats / values / timeline | Admin → the matching section (current entries are **sample content**) |
| Domain `https://www.ntalec.com` | canonical and Open Graph tags in `index.html`, `robots.txt`, `sitemap.xml`, `server/render.js` (JSON-LD) |
| Social share image | add `assets/img/og-image.png` (1200×630) |
| "Trusted by" client names, careers perks | `index.html` (sample content) |

## Production CSS (optional but recommended)

The Tailwind Play CDN is convenient but not intended for production. To compile a small, purged CSS file:

```
npm install -D tailwindcss@3
npx tailwindcss init
```

Copy the `theme.extend` block from the inline `tailwind.config` in `index.html` into `tailwind.config.js`, set
`content: ["./index.html", "./assets/js/**/*.js"]`, create `assets/css/tailwind.css` with the three `@tailwind`
directives, then build:

```
npx tailwindcss -i assets/css/tailwind.css -o assets/css/tailwind.min.css --minify
```

Replace the two CDN `<script>` tags in `<head>` with `<link rel="stylesheet" href="assets/css/tailwind.min.css">`.

## Scroll story

The home page is one continuous, scroll-driven story:

1. **Hero** (`#home`, 500vh): the camera flies into the building, four cards fade in (Services, Case Studies,
   About Us, Careers), then the other three fade out while the Services card moves to the centre and grows.
2. **Scenes** (`.scene` sections, in order): the screen fades to dark behind the section's card, the card enlarges
   and dissolves, the section's video plays in step with the scroll, and when it ends the content scrolls up over
   the video's last frame. The next section's card then grows in and the pattern repeats.

| Section | id | Video |
|---|---|---|
| Hero | `#home` | `Camera_moving_into_futuristic_bu*.mp4` |
| Services | `#services` | `Camera_moving_into_conference_room_*.mp4` |
| Case Studies | `#portfolio` | `Camera_entering_futuristic_lab_*.mp4` |
| About Us | `#about` | `Walking_through_corporate_office*.mp4` |
| Careers | `#careers` | `Door_opening_into_executive_lounge_*.mp4` |

Clicking a link to a section jumps to its enlarged card and scrolls through the video automatically, stopping at
the content; any wheel, touch or key input hands control back. Links such as `/#services` do the same on arrival.

**Tuning** (`assets/css/styles.css` / `assets/js/main.js`): `.js .scroll-hero { height }` sets the hero's scroll
length; `.js .scene-spacer { height }` and `VIDEO_END` set how much scrolling each scene's video takes; the phase
ranges are documented at the top of the hero and scene code.

**Why frames are cached:** every clip has a single keyframe, so seeking a `<video>` directly is choppy. `main.js`
downloads each clip, plays it once muted in a tiny off-screen element, caches every frame as a JPEG and paints the
frame for the current scroll position onto a canvas (two clips at a time on desktop, nearest section first). Frames
not yet captured fall back to the nearest one. Re-encoding the clips with a keyframe on every frame would allow a
simpler, lighter approach:

    ffmpeg -i input.mp4 -an -c:v libx264 -g 1 -crf 26 -preset slow -movflags +faststart output.mp4

Roles and the `careers@ntalec.com` inbox are placeholders.
