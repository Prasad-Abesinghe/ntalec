// Content model shared by the API, the admin dashboard (via /api/admin/schema) and page rendering.

// Icon set (inner SVG markup, 24×24 viewBox, stroke icons) selectable in the admin
export const ICONS = {
  code: '<path stroke-linecap="round" stroke-linejoin="round" d="m8 9-4 3 4 3m8-6 4 3-4 3M14 5l-4 14"/>',
  mobile: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path stroke-linecap="round" d="M11 18.5h2"/>',
  cloud: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 18a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.52 1.46A3.75 3.75 0 0 1 17.25 18H7Z"/>',
  palette: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.6-1.3-.6-2.2 0-.8.7-1.3 1.5-1.3H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path stroke-linecap="round" d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path stroke-linecap="round" d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6M5 11.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>',
  'shield-check': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="m8.5 12 2.5 2.5 4.5-5"/>',
  shield: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"/>',
  headset: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 14v-2a9 9 0 0 1 18 0v2M3 14a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2v-2Zm18 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2ZM18 18a4 4 0 0 1-4 3h-2"/>',
  users: '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M14 4.13a4 4 0 0 1 0 7.75M14 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>',
  star: '<path stroke-linecap="round" stroke-linejoin="round" d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8-4.2-4.1 5.9-.9L12 3Z"/>',
  bulb: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z"/>',
  chart: '<rect x="3" y="4" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 14 3-3 3 2 4-4"/>',
  rocket: '<path stroke-linecap="round" stroke-linejoin="round" d="M14 4c3 0 6 3 6 6l-6 6-6-6 6-6Zm-6 6-3 1-2 4 4-1m5 5-1 3-4 2 1-4m6-10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  refresh: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5.5 15a7 7 0 0 0 12.9 1.5M18.5 9A7 7 0 0 0 5.6 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/>',
  dollar: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m4.5-14.25H10a2.75 2.75 0 0 0 0 5.5h4a2.75 2.75 0 0 1 0 5.5H7"/>'
};

const icon = { name: 'icon', label: 'Icon', type: 'icon', required: true };

// Field types: text, textarea, list (one item per line), select, icon, image, url
export const COLLECTIONS = {
  services: {
    label: 'Services',
    singular: 'Service',
    titleField: 'title',
    subtitleField: 'description',
    fields: [
      icon,
      { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, max: 400 },
      { name: 'features', label: 'Key offerings (one per line)', type: 'list', maxItems: 8, max: 80 },
      { name: 'tags', label: 'Technology tags (one per line)', type: 'list', maxItems: 8, max: 30 }
    ]
  },
  case_studies: {
    label: 'Case Studies',
    singular: 'Case study',
    titleField: 'title',
    subtitleField: 'category',
    fields: [
      { name: 'category', label: 'Category label', type: 'text', required: true, max: 60, placeholder: 'FinTech · Web Platform' },
      { name: 'title', label: 'Title', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, max: 400 },
      { name: 'tags', label: 'Technologies (one per line)', type: 'list', maxItems: 8, max: 30 },
      { name: 'theme', label: 'Colour theme', type: 'select', required: true, options: ['cyan', 'emerald', 'violet', 'amber', 'rose'] },
      { name: 'visual', label: 'Card visual', type: 'select', required: true, options: ['dashboard', 'mobile', 'network', 'image'], help: 'Choose "image" to use the uploaded image below.' },
      { name: 'image', label: 'Image (used when visual = image)', type: 'image' },
      { name: 'link', label: '"View Case Study" link', type: 'url', max: 300, placeholder: '#contact or https://…' }
    ]
  },
  jobs: {
    label: 'Jobs',
    singular: 'Job',
    titleField: 'title',
    subtitleField: 'department',
    publishedLabel: 'Open',
    fields: [
      { name: 'title', label: 'Job title', type: 'text', required: true, max: 80 },
      { name: 'department', label: 'Department', type: 'text', required: true, max: 40, placeholder: 'Engineering' },
      { name: 'location', label: 'Location', type: 'text', required: true, max: 40, placeholder: 'Hybrid / Remote' },
      { name: 'type', label: 'Employment type', type: 'select', required: true, options: ['Full-time', 'Part-time', 'Contract', 'Internship'] },
      { name: 'tags', label: 'Skills (one per line)', type: 'list', maxItems: 6, max: 30 },
      { name: 'description', label: 'Description (shown in the application form)', type: 'textarea', max: 1500 }
    ]
  },
  stats: {
    label: 'About: Stats',
    singular: 'Stat',
    titleField: 'value',
    subtitleField: 'label',
    fields: [
      { name: 'label', label: 'Label', type: 'text', required: true, max: 40, placeholder: 'Projects delivered' },
      { name: 'value', label: 'Value', type: 'text', required: true, max: 12, placeholder: '150+' }
    ]
  },
  values: {
    label: 'About: Values',
    singular: 'Value',
    titleField: 'title',
    subtitleField: 'description',
    fields: [
      icon,
      { name: 'title', label: 'Title', type: 'text', required: true, max: 40 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, max: 200 }
    ]
  },
  timeline: {
    label: 'About: Timeline',
    singular: 'Milestone',
    titleField: 'title',
    subtitleField: 'year',
    fields: [
      { name: 'year', label: 'Year / label', type: 'text', required: true, max: 12, placeholder: '2024' },
      { name: 'title', label: 'Title', type: 'text', required: true, max: 60 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, max: 240 }
    ]
  }
};

export const SETTINGS = [
  { name: 'email', label: 'Contact email', type: 'email', required: true, group: 'Contact' },
  { name: 'phone', label: 'Phone', type: 'text', max: 40, group: 'Contact' },
  { name: 'address', label: 'Office address', type: 'text', max: 120, group: 'Contact' },
  { name: 'linkedin', label: 'LinkedIn URL', type: 'url', max: 200, group: 'Social links' },
  { name: 'twitter', label: 'X (Twitter) URL', type: 'url', max: 200, group: 'Social links' },
  { name: 'github', label: 'GitHub URL', type: 'url', max: 200, group: 'Social links' },
  { name: 'facebook', label: 'Facebook URL', type: 'url', max: 200, group: 'Social links' },
  { name: 'seo_title', label: 'Page title', type: 'text', max: 70, group: 'SEO', help: 'Shown in browser tabs and search results (≤ 60 characters is ideal).' },
  { name: 'seo_description', label: 'Meta description', type: 'textarea', max: 170, group: 'SEO', help: 'Search result snippet (≤ 160 characters is ideal).' },
  { name: 'social_title', label: 'Social share title', type: 'text', max: 90, group: 'SEO' },
  { name: 'social_description', label: 'Social share description', type: 'text', max: 200, group: 'SEO' }
];

export const MESSAGE_STATUSES = ['new', 'read', 'replied', 'archived'];
export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'rejected', 'hired'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Links may be in-page anchors, site-relative paths or http(s) URLs — never javascript: etc.
const SAFE_URL_RE = /^(#[\w-]*|\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/i;

// Validate and normalise data against a field list. Returns { data, errors }.
export function validate(fields, input = {}) {
  const data = {};
  const errors = {};
  for (const f of fields) {
    let v = input[f.name];
    if (f.type === 'list') {
      const arr = Array.isArray(v) ? v : String(v ?? '').split('\n');
      v = arr.map((x) => String(x).trim()).filter(Boolean);
      if (f.maxItems && v.length > f.maxItems) errors[f.name] = `At most ${f.maxItems} items.`;
      if (f.max && v.some((x) => x.length > f.max)) errors[f.name] = `Each item must be ${f.max} characters or fewer.`;
      if (f.required && !v.length) errors[f.name] = 'Required.';
      data[f.name] = v;
      continue;
    }
    v = String(v ?? '').trim();
    if (f.required && !v) { errors[f.name] = 'Required.'; continue; }
    if (f.max && v.length > f.max) errors[f.name] = `Must be ${f.max} characters or fewer.`;
    if (v && f.type === 'email' && !EMAIL_RE.test(v)) errors[f.name] = 'Enter a valid email address.';
    if (v && f.type === 'url' && !SAFE_URL_RE.test(v)) errors[f.name] = 'Use a full https:// URL, a /path or a #section link.';
    if (v && f.type === 'image' && !/^\/uploads\/[\w.-]+$/.test(v)) errors[f.name] = 'Upload an image.';
    if (v && f.type === 'select' && !f.options.includes(v)) errors[f.name] = 'Choose one of the options.';
    if (v && f.type === 'icon' && !ICONS[v]) errors[f.name] = 'Choose an icon.';
    data[f.name] = v;
  }
  return { data, errors };
}

export { EMAIL_RE };
