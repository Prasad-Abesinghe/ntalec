# NTALEC — Company Website

Static, responsive, SEO-ready site built with HTML5, Tailwind CSS and vanilla JavaScript.

## Structure

```
index.html              Header, scroll story (hero → services → case studies → about → careers), contact, footer
assets/css/styles.css   Custom styles (buttons, cards, scenes, form states, animations)
assets/js/main.js       Mobile menu, sticky header, scroll reveal, scroll-driven videos, form validation/submit
assets/img/logo.svg     Logo mark + favicon
assets/video/*.mp4      Hero video (scroll-driven) and one intro video per scene
robots.txt, sitemap.xml SEO crawl files
```

## Run locally

Open `index.html` directly, or serve the folder:

```
npx serve .        # or: python -m http.server 8000
```

## Before going live — replace placeholders

| What | Where |
|---|---|
| Email `hello@ntalec.com`, phone `+1 (555) 123-4567`, address `123 Innovation Drive, Tech City` | `index.html` (contact section, footer, JSON-LD) |
| Social URLs (LinkedIn / X / GitHub / Facebook) | `index.html` contact section + JSON-LD `sameAs` |
| Domain `https://www.ntalec.com` | canonical, Open Graph tags, JSON-LD, `robots.txt`, `sitemap.xml` |
| Social share image | add `assets/img/og-image.png` (1200×630) |
| Case studies, client names and job openings | **Sample content** — swap in real projects and roles |
| About Us: stats (150+ projects, 98% retention…), journey timeline years and milestones | **Sample content** — replace with your real figures and history |

## Contact form (Formspree)

1. Sign up at https://formspree.io and create a new form. Set the notification email to the inbox that should receive enquiries.
2. Copy the form ID from the endpoint shown (`https://formspree.io/f/<ID>`).
3. In `index.html`, replace `YOUR_FORM_ID` in the `action` of `<form id="contact-form">`.
4. Send a test message from the live site. Formspree asks you to confirm the first submission by email.
5. Recommended: in the Formspree form settings, restrict submissions to your domain.

How it works:
- With JavaScript, `main.js` validates fields, POSTs JSON to Formspree and shows an inline success/error message.
- Without JavaScript, the form posts normally and Formspree shows its own thank-you page.
- The `email` field becomes the reply-to, so you can answer enquiries directly from your inbox.
- `_subject` makes notification emails read "NTALEC website enquiry: <subject>".
- `_gotcha` is Formspree's honeypot field for filtering spam bots.
- Until the ID is set, the form opens the visitor's email client pre-filled, addressed to `data-mailto`.

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
