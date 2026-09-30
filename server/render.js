// Server-side rendering of the CMS-managed regions of index.html.
// Regions are marked in the template with <!--cms:name--> … <!--/cms:name-->; the static
// content between the markers is the fallback when the site is hosted without this server.
import { ICONS } from './schema.js';
import { listItems, getSettings } from './db.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (name) => `<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">${ICONS[name] || ICONS.star}</svg>`;
const tagList = (tags, cls = 'tag-list') => (tags && tags.length ? `<ul class="${cls}">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');

const THEMES = {
  cyan: { gradient: 'from-cyan-500/30 via-sky-600/20 to-indigo-700/30', text: 'text-brand-400', accent: '#22d3ee', accent2: '#818cf8' },
  emerald: { gradient: 'from-emerald-500/25 via-teal-600/20 to-cyan-700/30', text: 'text-emerald-400', accent: '#34d399', accent2: '#22d3ee' },
  violet: { gradient: 'from-violet-500/30 via-indigo-600/20 to-fuchsia-700/25', text: 'text-accent-400', accent: '#818cf8', accent2: '#22d3ee' },
  amber: { gradient: 'from-amber-500/25 via-orange-600/20 to-rose-700/25', text: 'text-amber-400', accent: '#fbbf24', accent2: '#fb7185' },
  rose: { gradient: 'from-rose-500/25 via-pink-600/20 to-violet-700/25', text: 'text-rose-400', accent: '#fb7185', accent2: '#c084fc' }
};

const VISUALS = {
  dashboard: (t) => `<svg viewBox="0 0 320 180" class="h-full w-full" aria-hidden="true">
                <rect x="30" y="24" width="260" height="132" rx="10" fill="#0a1022" stroke="rgba(255,255,255,.12)"/>
                <rect x="44" y="40" width="70" height="8" rx="4" fill="${t.accent}" opacity=".8"/>
                <rect x="44" y="60" width="110" height="40" rx="6" fill="rgba(255,255,255,.06)"/>
                <rect x="164" y="60" width="112" height="40" rx="6" fill="rgba(255,255,255,.06)"/>
                <polyline points="44,140 80,122 116,128 152,110 188,114 224,94 276,100" fill="none" stroke="${t.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="54" y="74" width="60" height="12" rx="3" fill="#fff" opacity=".85"/>
                <rect x="174" y="74" width="44" height="12" rx="3" fill="${t.accent2}"/>
              </svg>`,
  mobile: (t) => `<svg viewBox="0 0 320 180" class="h-full w-full" aria-hidden="true">
                <rect x="118" y="14" width="84" height="156" rx="14" fill="#0a1022" stroke="rgba(255,255,255,.15)"/>
                <rect x="130" y="34" width="60" height="8" rx="4" fill="${t.accent}"/>
                <circle cx="160" cy="82" r="24" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="6"/>
                <circle cx="160" cy="82" r="24" fill="none" stroke="${t.accent}" stroke-width="6" stroke-dasharray="110 151" stroke-linecap="round" transform="rotate(-90 160 82)"/>
                <rect x="130" y="118" width="60" height="10" rx="5" fill="rgba(255,255,255,.08)"/>
                <rect x="130" y="134" width="44" height="10" rx="5" fill="rgba(255,255,255,.08)"/>
                <rect x="40" y="60" width="60" height="44" rx="8" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.08)"/>
                <rect x="220" y="76" width="60" height="44" rx="8" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.08)"/>
              </svg>`,
  network: (t) => `<svg viewBox="0 0 320 180" class="h-full w-full" aria-hidden="true">
                <g stroke="${t.accent}" stroke-opacity=".5" stroke-width="1.5">
                  <line x1="70" y1="50" x2="160" y2="90"/><line x1="70" y1="130" x2="160" y2="90"/>
                  <line x1="160" y1="90" x2="250" y2="45"/><line x1="160" y1="90" x2="250" y2="90"/><line x1="160" y1="90" x2="250" y2="135"/>
                  <line x1="70" y1="50" x2="70" y2="130"/>
                </g>
                <circle cx="70" cy="50" r="10" fill="${t.accent}"/><circle cx="70" cy="130" r="10" fill="${t.accent}"/>
                <circle cx="160" cy="90" r="18" fill="${t.accent}" stroke="#e0e7ff" stroke-width="2"/>
                <circle cx="250" cy="45" r="9" fill="${t.accent2}"/><circle cx="250" cy="90" r="9" fill="${t.accent2}"/><circle cx="250" cy="135" r="9" fill="${t.accent2}"/>
              </svg>`
};

const REGIONS = {
  services: () => listItems('services', { publishedOnly: true }).map((s) => `
            <article class="service-card">
              <div class="icon-tile">${svg(s.icon)}</div>
              <h3>${esc(s.title)}</h3>
              <p>${esc(s.description)}</p>
              ${tagList(s.features, 'check-list')}
              ${tagList(s.tags)}
            </article>`).join('\n') + '\n',

  case_studies: () => listItems('case_studies', { publishedOnly: true }).map((c) => {
    const t = THEMES[c.theme] || THEMES.cyan;
    const visual = c.visual === 'image' && c.image
      ? `<img src="${esc(c.image)}" alt="" class="h-full w-full object-cover" loading="lazy" />`
      : (VISUALS[c.visual] || VISUALS.dashboard)(t);
    return `
            <article class="project-card">
              <div class="project-visual bg-gradient-to-br ${t.gradient}">
              ${visual}
              </div>
              <div class="p-7">
                <p class="text-xs font-semibold uppercase tracking-widest ${t.text}">${esc(c.category)}</p>
                <h3 class="mt-2 font-display text-xl font-semibold text-white">${esc(c.title)}</h3>
                <p class="mt-3 text-slate-400">${esc(c.description)}</p>
                ${tagList(c.tags, 'tag-list mt-5')}
                <a href="${esc(c.link || '#contact')}" class="link-arrow mt-6">View Case Study <span aria-hidden="true">→</span></a>
              </div>
            </article>`;
  }).join('\n') + '\n',

  jobs: () => {
    const jobs = listItems('jobs', { publishedOnly: true });
    if (!jobs.length) {
      return `
            <li class="job"><div><h4>No open positions right now</h4><p class="job-meta"><span>We're always happy to meet great people — send us your CV.</span></p></div></li>\n`;
    }
    return jobs.map((j) => `
            <li class="job">
              <div>
                <h4>${esc(j.title)}</h4>
                <p class="job-meta"><span>${esc(j.department)}</span><span>${esc(j.location)}</span><span>${esc(j.type)}</span></p>
                ${tagList(j.tags)}
              </div>
              <button type="button" class="job-apply" data-apply="${j.id}" data-job-title="${esc(j.title)}" data-job-description="${esc(j.description || '')}">Apply <span aria-hidden="true">→</span></button>
            </li>`).join('\n') + '\n';
  },

  stats: () => listItems('stats', { publishedOnly: true }).map((s) => `
            <div class="about-stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('') + '\n',

  values: () => listItems('values', { publishedOnly: true }).map((v) => `
            <div class="feature">
              <div class="feature-icon">${svg(v.icon)}</div>
              <h3>${esc(v.title)}</h3>
              <p>${esc(v.description)}</p>
            </div>`).join('') + '\n',

  timeline: () => listItems('timeline', { publishedOnly: true }).map((t) => `
            <li><span class="timeline-year">${esc(t.year)}</span><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p></li>`).join('') + '\n',

  contact_info: (s) => {
    const items = [];
    if (s.email) items.push(['Email', `<a href="mailto:${esc(s.email)}" class="font-medium text-white hover:text-brand-300">${esc(s.email)}</a>`, '<rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="m3 7 9 6 9-6"/>']);
    if (s.phone) items.push(['Phone', `<a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}" class="font-medium text-white hover:text-brand-300">${esc(s.phone)}</a>`, '<path stroke-linecap="round" stroke-linejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>']);
    if (s.address) items.push(['Office', `<p class="font-medium text-white">${esc(s.address)}</p>`, '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>']);
    return items.map(([label, value, icon]) => `
            <li class="contact-item">
              <span class="contact-icon"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">${icon}</svg></span>
              <div><p class="text-sm text-slate-400">${label}</p>${value}</div>
            </li>`).join('') + '\n';
  },

  social: (s) => {
    const SOCIAL = {
      linkedin: ['LinkedIn', '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.3-.02-3-1.83-3-1.84 0-2.12 1.43-2.12 2.9V21H9z"/>'],
      twitter: ['X (Twitter)', '<path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3h6.4l4.4 5.8zm-1.1 16.2h1.7L6.9 4.7H5.1z"/>'],
      github: ['GitHub', '<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>'],
      facebook: ['Facebook', '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5Z"/>']
    };
    return Object.entries(SOCIAL).filter(([k]) => s[k]).map(([k, [label, path]]) => `
            <a href="${esc(s[k])}" class="social" aria-label="NTALEC on ${label}" target="_blank" rel="noopener"><svg fill="currentColor" viewBox="0 0 24 24">${path}</svg></a>`).join('') + '\n';
  },

  footer_contact: (s) => [
    s.email && `<li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`,
    s.phone && `<li><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></li>`,
    s.address && `<li>${esc(s.address)}</li>`
  ].filter(Boolean).map((l) => `\n            ${l}`).join('') + '\n',

  jsonld: (s) => {
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'NTALEC',
      url: 'https://www.ntalec.com',
      logo: 'https://www.ntalec.com/assets/img/logo.svg',
      email: s.email || undefined,
      telephone: s.phone || undefined,
      address: s.address ? { '@type': 'PostalAddress', streetAddress: s.address } : undefined,
      sameAs: ['linkedin', 'twitter', 'github', 'facebook'].map((k) => s[k]).filter(Boolean)
    };
    // Escape "<" so the JSON can never close the script element
    return `\n  <script type="application/ld+json">\n  ${JSON.stringify(org, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n  ')}\n  </script>\n  `;
  }
};

export function renderPage(template) {
  const s = getSettings();
  let html = template.replace(/<!--cms:(\w+)-->[\s\S]*?<!--\/cms:\1-->/g, (whole, name) => {
    const fn = REGIONS[name];
    return fn ? `<!--cms:${name}-->${fn(s)}<!--/cms:${name}-->` : whole;
  });

  // SEO + contact attributes outside the marked regions
  const meta = (attr, key, value) => {
    if (!value) return;
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
    html = html.replace(re, (m, a, b) => `${a}${esc(value)}${b}`);
  };
  if (s.seo_title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(s.seo_title)}</title>`);
  meta('name', 'description', s.seo_description);
  meta('property', 'og:title', s.social_title);
  meta('property', 'og:description', s.social_description);
  meta('name', 'twitter:title', s.social_title);
  meta('name', 'twitter:description', s.social_description);
  if (s.email) html = html.replace(/data-mailto="[^"]*"/g, `data-mailto="${esc(s.email)}"`);
  return html;
}
