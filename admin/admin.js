// NTALEC admin portal — single-page app (vanilla JS, hash routing).
const app = document.getElementById('app');
const toasts = document.getElementById('toasts');

const state = { user: null, schema: null, counts: {} };

/* ---------------- utilities ---------------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z'); // SQLite UTC timestamps
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const timeAgo = (s) => {
  const secs = (Date.now() - new Date(s.replace(' ', 'T') + 'Z')) / 1000;
  if (secs < 60) return 'just now';
  const [n, u] = secs < 3600 ? [secs / 60, 'min'] : secs < 86400 ? [secs / 3600, 'h'] : [secs / 86400, 'd'];
  return `${Math.floor(n)}${u === 'min' ? ' min' : u} ago`;
};

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'ntalec-admin', Accept: 'application/json' };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api/admin/${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { state.user = null; renderLogin(); throw new ApiError('Signed out', 401); }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.fields);
  return data;
}

const ICON = {
  dashboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 5h6v6H4zM14 5h6v4h-6zM14 13h6v6h-6zM4 15h6v4H4z"/>',
  inbox: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 13h4l1.5 2.5h5L16 13h4M5 5h14l1 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1-8Z"/>',
  apps: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5h6M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1Zm0 9 2 2 4-4"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  code: '<path stroke-linecap="round" stroke-linejoin="round" d="m8 9-4 3 4 3m8-6 4 3-4 3M14 5l-4 14"/>',
  chart: '<rect x="3" y="4" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 14 3-3 3 2 4-4"/>',
  hash: '<path stroke-linecap="round" d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',
  star: '<path stroke-linecap="round" stroke-linejoin="round" d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8-4.2-4.1 5.9-.9L12 3Z"/>',
  timeline: '<path stroke-linecap="round" d="M12 3v18M8 7h-3M19 12h-3M8 17H5"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path stroke-linecap="round" d="M4 21a8 8 0 0 1 16 0"/>',
  up: '<path stroke-linecap="round" stroke-linejoin="round" d="m6 15 6-6 6 6"/>',
  down: '<path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>',
  edit: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4"/>',
  trash: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  external: '<path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  menu: '<path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7"/>',
  download: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>'
};
const svg = (paths, cls = '') => `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

/* ---------------- auth ---------------- */
function renderLogin(message = '') {
  document.title = 'Sign in · NTALEC Admin';
  app.innerHTML = `
    <main class="grid min-h-screen place-items-center px-4">
      <form id="login-form" class="card w-full max-w-sm p-8" novalidate>
        <div class="flex items-center gap-3">
          <img src="/assets/img/logo.svg" alt="" class="h-10 w-10" />
          <div>
            <p class="font-display text-xl font-bold text-white">NTALEC</p>
            <p class="text-xs uppercase tracking-widest text-slate-500">Admin portal</p>
          </div>
        </div>
        <h1 class="mt-8 text-lg font-semibold text-white">Sign in</h1>
        <div class="mt-5 space-y-4">
          <div><label class="label" for="login-email">Email</label><input id="login-email" name="email" type="email" class="input" autocomplete="username" required /></div>
          <div><label class="label" for="login-password">Password</label><input id="login-password" name="password" type="password" class="input" autocomplete="current-password" required /></div>
        </div>
        <p id="login-error" class="field-error ${message ? '' : 'hidden'}" role="alert">${esc(message)}</p>
        <button type="submit" class="btn btn-primary mt-6 w-full">Sign in</button>
        <a href="/" class="mt-6 block text-center text-xs text-slate-500 hover:text-slate-300">← Back to website</a>
      </form>
    </main>`;
  const form = $('#login-form');
  $('#login-email').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type="submit"]', form);
    const err = $('#login-error');
    btn.disabled = true;
    try {
      const { user } = await api('login', { method: 'POST', body: { email: form.email.value, password: form.password.value } });
      state.user = user;
      await boot();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
      form.password.value = '';
      form.password.focus();
    } finally {
      btn.disabled = false;
    }
  });
}

async function logout() {
  await api('logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  location.hash = '';
  renderLogin();
}

/* ---------------- layout ---------------- */
function navItems() {
  const c = state.schema.collections;
  return [
    { group: 'Overview' },
    { href: '#/dashboard', label: 'Dashboard', icon: ICON.dashboard },
    { href: '#/messages', label: 'Messages', icon: ICON.inbox, badge: state.counts.newMessages },
    { href: '#/applications', label: 'Applications', icon: ICON.apps, badge: state.counts.newApplications },
    { group: 'Website content' },
    { href: '#/c/services', label: c.services.label, icon: ICON.code },
    { href: '#/c/case_studies', label: c.case_studies.label, icon: ICON.chart },
    { href: '#/c/jobs', label: c.jobs.label, icon: ICON.briefcase },
    { group: 'About Us' },
    { href: '#/c/stats', label: 'Stats', icon: ICON.hash },
    { href: '#/c/values', label: 'Values', icon: ICON.star },
    { href: '#/c/timeline', label: 'Timeline', icon: ICON.timeline },
    { group: 'System' },
    { href: '#/settings', label: 'Site settings', icon: ICON.settings },
    { href: '#/account', label: 'Account', icon: ICON.user }
  ];
}

function renderShell() {
  app.innerHTML = `
    <div class="flex min-h-screen">
      <aside id="sidebar" class="sidebar flex w-64 shrink-0 flex-col border-r divider bg-ink-900 px-3 py-5 lg:sticky lg:top-0 lg:h-screen">
        <a href="#/dashboard" class="flex items-center gap-2.5 px-3">
          <img src="/assets/img/logo.svg" alt="" class="h-8 w-8" />
          <span class="font-display text-lg font-bold text-white">NTALEC</span>
          <span class="rounded bg-white/5 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Admin</span>
        </a>
        <nav id="nav" class="mt-4 flex-1 overflow-y-auto" aria-label="Admin"></nav>
        <div class="mt-4 border-t divider px-3 pt-4">
          <p class="truncate text-sm font-medium text-white">${esc(state.user.name || state.user.email)}</p>
          <p class="truncate text-xs text-slate-500">${esc(state.user.email)}</p>
          <button id="logout" class="nav-item mt-3 w-full">${svg(ICON.logout)}Sign out</button>
        </div>
      </aside>
      <div id="scrim" class="fixed inset-0 z-40 hidden bg-black/60 lg:hidden"></div>
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b divider bg-ink-950/90 px-4 py-3 backdrop-blur sm:px-6">
          <div class="flex items-center gap-3">
            <button id="menu-btn" class="icon-btn lg:hidden" aria-label="Open menu">${svg(ICON.menu)}</button>
            <h1 id="page-title" class="font-display text-lg font-semibold text-white"></h1>
          </div>
          <a href="/" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View site ${svg(ICON.external, 'h-3.5 w-3.5')}</a>
        </header>
        <main id="view" class="flex-1 px-4 py-6 sm:px-6 lg:px-8"></main>
      </div>
    </div>`;
  $('#logout').addEventListener('click', logout);
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const setMenu = (open) => { sidebar.classList.toggle('open', open); scrim.classList.toggle('hidden', !open); };
  $('#menu-btn').addEventListener('click', () => setMenu(true));
  scrim.addEventListener('click', () => setMenu(false));
  $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
}

function renderNav() {
  const hash = location.hash || '#/dashboard';
  $('#nav').innerHTML = navItems().map((n) => n.group
    ? `<p class="nav-group">${n.group}</p>`
    : `<a href="${n.href}" class="nav-item ${hash.startsWith(n.href) ? 'active' : ''}" ${hash.startsWith(n.href) ? 'aria-current="page"' : ''}>
         ${svg(n.icon)}<span>${n.label}</span>${n.badge ? `<span class="count-badge">${n.badge}</span>` : ''}</a>`).join('');
}

async function refreshCounts() {
  try {
    const { counts } = await api('dashboard');
    state.counts = counts;
    renderNav();
  } catch {}
}

function setTitle(t) {
  $('#page-title').textContent = t;
  document.title = `${t} · NTALEC Admin`;
}

/* ---------------- router ---------------- */
async function route() {
  if (!state.user) return;
  const hash = location.hash || '#/dashboard';
  renderNav();
  const view = $('#view');
  view.innerHTML = '<p class="text-slate-500">Loading…</p>';
  const [, page, arg] = hash.split('/');
  try {
    if (page === 'dashboard') await viewDashboard(view);
    else if (page === 'messages') await viewMessages(view);
    else if (page === 'applications') await viewApplications(view);
    else if (page === 'c' && state.schema.collections[arg]) await viewCollection(view, arg);
    else if (page === 'settings') await viewSettings(view);
    else if (page === 'account') viewAccount(view);
    else location.hash = '#/dashboard';
  } catch (err) {
    if (err.status !== 401) view.innerHTML = `<div class="card p-6 text-red-300">${esc(err.message)}</div>`;
  }
}

/* ---------------- dashboard ---------------- */
async function viewDashboard(view) {
  setTitle('Dashboard');
  const d = await api('dashboard');
  state.counts = d.counts;
  renderNav();
  const c = d.counts;
  const stat = (label, value, href, sub = '') => `
    <a href="${href}" class="card stat-card block transition hover:border-brand-400/50">
      <p class="text-sm text-slate-400">${label}</p>
      <p class="num mt-2">${value}</p>
      ${sub ? `<p class="mt-1 text-xs text-slate-500">${sub}</p>` : ''}
    </a>`;
  const list = (rows, href, line) => rows.length
    ? rows.map((r) => `<a href="${href}" class="row row-link flex items-center justify-between gap-3 px-5 py-3">${line(r)}</a>`).join('')
    : '<p class="px-5 py-6 text-sm text-slate-500">Nothing yet.</p>';
  view.innerHTML = `
    <p class="text-slate-400">Welcome back, <span class="text-white">${esc(state.user.name || state.user.email)}</span>.</p>
    <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${stat('New messages', c.newMessages, '#/messages', `${c.messages} total`)}
      ${stat('New applications', c.newApplications, '#/applications', `${c.applications} total`)}
      ${stat('Open jobs', c.openJobs, '#/c/jobs')}
      ${stat('Live services · case studies', `${c.services} · ${c.caseStudies}`, '#/c/services')}
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between border-b divider px-5 py-4"><h2 class="font-semibold text-white">Recent messages</h2><a href="#/messages" class="text-sm text-brand-300 hover:underline">View all</a></div>
        ${list(d.recentMessages, '#/messages', (m) => `
          <div class="min-w-0"><p class="truncate text-sm font-medium text-white">${esc(m.subject)}</p><p class="truncate text-xs text-slate-500">${esc(m.name)} · ${esc(m.email)}</p></div>
          <div class="flex shrink-0 items-center gap-3"><span class="badge badge-${m.status}">${m.status}</span><span class="text-xs text-slate-500">${timeAgo(m.created_at)}</span></div>`)}
      </section>
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between border-b divider px-5 py-4"><h2 class="font-semibold text-white">Recent applications</h2><a href="#/applications" class="text-sm text-brand-300 hover:underline">View all</a></div>
        ${list(d.recentApplications, '#/applications', (a) => `
          <div class="min-w-0"><p class="truncate text-sm font-medium text-white">${esc(a.name)}</p><p class="truncate text-xs text-slate-500">${esc(a.job_title)}</p></div>
          <div class="flex shrink-0 items-center gap-3"><span class="badge badge-${a.status}">${a.status}</span><span class="text-xs text-slate-500">${timeAgo(a.created_at)}</span></div>`)}
      </section>
    </div>`;
}

/* ---------------- messages ---------------- */
async function viewMessages(view) {
  setTitle('Messages');
  let filter = sessionStorage.getItem('msgFilter') || '';
  let query = '';
  let selectedId = null;
  let messages = [];

  const tabs = [['', 'Inbox'], ['new', 'New'], ['read', 'Read'], ['replied', 'Replied'], ['archived', 'Archived']];
  view.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div id="msg-tabs" class="flex flex-wrap gap-1" role="tablist"></div>
      <input id="msg-search" type="search" class="input max-w-xs" placeholder="Search name, email, subject…" />
    </div>
    <div class="mt-5 grid gap-6 lg:grid-cols-5">
      <section id="msg-list" class="card overflow-hidden lg:col-span-2"></section>
      <section id="msg-detail" class="card p-6 lg:col-span-3"><p class="text-slate-500">Select a message to read it.</p></section>
    </div>`;

  const renderTabs = () => {
    $('#msg-tabs').innerHTML = tabs.map(([v, l]) => `<button class="tab ${filter === v ? 'active' : ''}" data-filter="${v}" role="tab" aria-selected="${filter === v}">${l}</button>`).join('');
  };
  const renderList = () => {
    $('#msg-list').innerHTML = messages.length
      ? messages.map((m) => `
        <button class="row row-link block w-full px-5 py-4 text-left ${m.id === selectedId ? 'selected' : ''}" data-id="${m.id}">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate text-sm ${m.status === 'new' ? 'font-semibold text-white' : 'text-slate-200'}">${esc(m.name)}</p>
            <span class="shrink-0 text-xs text-slate-500">${timeAgo(m.created_at)}</span>
          </div>
          <p class="mt-0.5 truncate text-sm text-slate-300">${esc(m.subject)}</p>
          <div class="mt-1.5 flex items-center justify-between gap-3"><p class="truncate text-xs text-slate-500">${esc(m.message.slice(0, 90))}</p><span class="badge badge-${m.status}">${m.status}</span></div>
        </button>`).join('')
      : '<p class="px-5 py-10 text-center text-sm text-slate-500">No messages here.</p>';
  };
  const renderDetail = () => {
    const m = messages.find((x) => x.id === selectedId);
    const box = $('#msg-detail');
    if (!m) { box.innerHTML = '<p class="text-slate-500">Select a message to read it.</p>'; return; }
    const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: ' + m.subject)}`;
    box.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-white">${esc(m.subject)}</h2>
          <p class="mt-1 text-sm text-slate-400">${esc(m.name)} · <a class="text-brand-300 hover:underline" href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
          <p class="mt-1 text-xs text-slate-500">${fmtDate(m.created_at)}</p>
        </div>
        <span class="badge badge-${m.status}">${m.status}</span>
      </div>
      <div class="prose-msg mt-6 border-t divider pt-6 text-[0.95rem]">${esc(m.message)}</div>
      <div class="mt-8 flex flex-wrap gap-2 border-t divider pt-5">
        <a href="${reply}" class="btn btn-primary btn-sm" data-act="reply">Reply by email</a>
        ${m.status !== 'replied' ? '<button class="btn btn-ghost btn-sm" data-act="replied">Mark as replied</button>' : ''}
        ${m.status !== 'read' ? '<button class="btn btn-ghost btn-sm" data-act="read">Mark as read</button>' : ''}
        ${m.status !== 'new' ? '<button class="btn btn-ghost btn-sm" data-act="new">Mark as unread</button>' : ''}
        ${m.status !== 'archived' ? '<button class="btn btn-ghost btn-sm" data-act="archived">Archive</button>' : ''}
        <button class="btn btn-danger btn-sm ml-auto" data-act="delete">${svg(ICON.trash, 'h-4 w-4')}Delete</button>
      </div>`;
  };

  const setStatus = async (m, status, silent = false) => {
    const { message } = await api(`messages/${m.id}`, { method: 'PATCH', body: { status } });
    Object.assign(m, message);
    renderList(); renderDetail(); refreshCounts();
    if (!silent) toast(`Marked as ${status}.`);
  };

  const load = async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (query) params.set('q', query);
    ({ messages } = await api(`messages?${params}`));
    if (!messages.some((m) => m.id === selectedId)) selectedId = null;
    renderTabs(); renderList(); renderDetail();
  };

  $('#msg-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    sessionStorage.setItem('msgFilter', filter);
    load();
  });
  let t;
  $('#msg-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { query = e.target.value.trim(); load(); }, 250); });
  $('#msg-list').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    selectedId = Number(row.dataset.id);
    const m = messages.find((x) => x.id === selectedId);
    renderList(); renderDetail();
    if (m.status === 'new') await setStatus(m, 'read', true);
    if (window.innerWidth < 1024) $('#msg-detail').scrollIntoView({ behavior: 'smooth' });
  });
  $('#msg-detail').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const m = messages.find((x) => x.id === selectedId);
    const act = b.dataset.act;
    try {
      if (act === 'reply') { setTimeout(() => setStatus(m, 'replied', true), 300); return; }
      if (act === 'delete') {
        if (!confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
        await api(`messages/${m.id}`, { method: 'DELETE' });
        toast('Message deleted.');
        selectedId = null;
        await load(); refreshCounts();
        return;
      }
      await setStatus(m, act);
      if (act === 'archived' && filter !== 'archived') { selectedId = null; await load(); }
    } catch (err) { if (err.status !== 401) toast(err.message, 'error'); }
  });
  await load();
}

/* ---------------- applications ---------------- */
async function viewApplications(view) {
  setTitle('Applications');
  const statuses = state.schema.applicationStatuses;
  const { items: jobs } = await api('items/jobs');
  let status = '';
  let job = '';
  let selectedId = null;
  let rows = [];

  view.innerHTML = `
    <div class="flex flex-wrap items-center gap-3">
      <select id="app-status" class="select max-w-[12rem]" aria-label="Filter by status">
        <option value="">All statuses</option>${statuses.map((s) => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select>
      <select id="app-job" class="select max-w-xs" aria-label="Filter by job">
        <option value="">All positions</option>${jobs.map((j) => `<option value="${j.id}">${esc(j.title)}${j.published ? '' : ' (closed)'}</option>`).join('')}
      </select>
    </div>
    <div class="mt-5 grid gap-6 lg:grid-cols-5">
      <section id="app-list" class="card overflow-hidden lg:col-span-2"></section>
      <section id="app-detail" class="card p-6 lg:col-span-3"><p class="text-slate-500">Select an application.</p></section>
    </div>`;

  const renderList = () => {
    $('#app-list').innerHTML = rows.length
      ? rows.map((a) => `
        <button class="row row-link block w-full px-5 py-4 text-left ${a.id === selectedId ? 'selected' : ''}" data-id="${a.id}">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate text-sm ${a.status === 'new' ? 'font-semibold text-white' : 'text-slate-200'}">${esc(a.name)}</p>
            <span class="shrink-0 text-xs text-slate-500">${timeAgo(a.created_at)}</span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-3"><p class="truncate text-xs text-slate-400">${esc(a.job_title)}</p><span class="badge badge-${a.status}">${a.status}</span></div>
        </button>`).join('')
      : '<p class="px-5 py-10 text-center text-sm text-slate-500">No applications match.</p>';
  };
  const renderDetail = () => {
    const a = rows.find((x) => x.id === selectedId);
    const box = $('#app-detail');
    if (!a) { box.innerHTML = '<p class="text-slate-500">Select an application.</p>'; return; }
    const info = (label, value) => value ? `<div><dt class="text-xs text-slate-500">${label}</dt><dd class="mt-0.5 break-words text-sm text-slate-200">${value}</dd></div>` : '';
    const safeLink = /^https?:\/\//i.test(a.linkedin) ? `<a class="text-brand-300 hover:underline" href="${esc(a.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(a.linkedin)}</a>` : esc(a.linkedin);
    box.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h2 class="text-lg font-semibold text-white">${esc(a.name)}</h2><p class="mt-1 text-sm text-slate-400">${esc(a.job_title)}</p><p class="mt-1 text-xs text-slate-500">Applied ${fmtDate(a.created_at)}</p></div>
        ${a.has_cv ? `<a href="/api/admin/applications/${a.id}/cv" class="btn btn-primary btn-sm">${svg(ICON.download, 'h-4 w-4')}Download CV</a>` : ''}
      </div>
      <dl class="mt-6 grid gap-4 border-t divider pt-6 sm:grid-cols-2">
        ${info('Email', `<a class="text-brand-300 hover:underline" href="mailto:${esc(a.email)}">${esc(a.email)}</a>`)}
        ${info('Phone', esc(a.phone))}
        ${info('LinkedIn / portfolio', a.linkedin ? safeLink : '')}
        ${info('CV file', esc(a.cv_name))}
      </dl>
      ${a.cover_letter ? `<div class="mt-6 border-t divider pt-6"><p class="text-xs text-slate-500">Cover letter</p><div class="prose-msg mt-2 text-sm">${esc(a.cover_letter)}</div></div>` : ''}
      <form id="app-form" class="mt-6 grid gap-4 border-t divider pt-6">
        <div><label class="label" for="app-status-edit">Status</label>
          <select id="app-status-edit" name="status" class="select max-w-[14rem]">${statuses.map((s) => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
        <div><label class="label" for="app-notes">Internal notes</label><textarea id="app-notes" name="notes" class="textarea" rows="4" placeholder="Interview feedback, next steps…">${esc(a.notes)}</textarea></div>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn btn-primary btn-sm">Save</button>
          <button type="button" class="btn btn-danger btn-sm ml-auto" data-act="delete">${svg(ICON.trash, 'h-4 w-4')}Delete</button>
        </div>
      </form>`;
    $('#app-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { application } = await api(`applications/${a.id}`, { method: 'PATCH', body: { status: e.target.status.value, notes: e.target.notes.value } });
        Object.assign(a, application);
        renderList(); renderDetail(); refreshCounts();
        toast('Application updated.');
      } catch (err) { if (err.status !== 401) toast(err.message, 'error'); }
    });
    $('[data-act="delete"]', box).addEventListener('click', async () => {
      if (!confirm(`Delete ${a.name}'s application and CV? This cannot be undone.`)) return;
      try {
        await api(`applications/${a.id}`, { method: 'DELETE' });
        toast('Application deleted.');
        selectedId = null;
        await load(); refreshCounts();
      } catch (err) { if (err.status !== 401) toast(err.message, 'error'); }
    });
  };
  const load = async () => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (job) p.set('job', job);
    ({ applications: rows } = await api(`applications?${p}`));
    if (!rows.some((r) => r.id === selectedId)) selectedId = null;
    renderList(); renderDetail();
  };
  $('#app-status').addEventListener('change', (e) => { status = e.target.value; load(); });
  $('#app-job').addEventListener('change', (e) => { job = e.target.value; load(); });
  $('#app-list').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    selectedId = Number(row.dataset.id);
    const a = rows.find((x) => x.id === selectedId);
    renderList(); renderDetail();
    if (a.status === 'new') {
      const { application } = await api(`applications/${a.id}`, { method: 'PATCH', body: { status: 'reviewing' } }).catch(() => ({}));
      if (application) { Object.assign(a, application); renderList(); renderDetail(); refreshCounts(); }
    }
    if (window.innerWidth < 1024) $('#app-detail').scrollIntoView({ behavior: 'smooth' });
  });
  await load();
}

/* ---------------- content collections ---------------- */
async function viewCollection(view, name) {
  const def = state.schema.collections[name];
  setTitle(def.label);
  let items = [];
  const pubLabel = def.publishedLabel || 'Published';

  view.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate-400">Changes appear on the website immediately. Use the arrows to change the order.</p>
      <button id="add-item" class="btn btn-primary">+ Add ${esc(def.singular.toLowerCase())}</button>
    </div>
    <section id="item-list" class="card mt-5 overflow-hidden"></section>`;

  const render = () => {
    $('#item-list').innerHTML = items.length
      ? items.map((it, i) => `
        <div class="row flex items-center gap-3 px-4 py-3 sm:px-5" data-id="${it.id}">
          <div class="flex flex-col">
            <button class="icon-btn" data-act="up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${svg(ICON.up)}</button>
            <button class="icon-btn" data-act="down" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>${svg(ICON.down)}</button>
          </div>
          ${it.icon && state.schema.icons[it.icon] ? `<span class="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-400/10 text-brand-300 sm:grid">${svg(state.schema.icons[it.icon], 'h-5 w-5')}</span>` : ''}
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-white">${esc(it[def.titleField])}</p>
            <p class="truncate text-sm text-slate-500">${esc(it[def.subtitleField])}</p>
          </div>
          <button class="badge ${it.published ? 'badge-on' : 'badge-off'}" data-act="toggle" title="Click to ${it.published ? 'hide from' : 'show on'} the website">${it.published ? pubLabel : (def.publishedLabel ? 'Closed' : 'Hidden')}</button>
          <button class="icon-btn" data-act="edit" aria-label="Edit">${svg(ICON.edit)}</button>
          <button class="icon-btn hover:!text-red-300" data-act="delete" aria-label="Delete">${svg(ICON.trash)}</button>
        </div>`).join('')
      : `<p class="px-5 py-10 text-center text-sm text-slate-500">No ${esc(def.label.toLowerCase())} yet.</p>`;
  };
  const load = async () => { ({ items } = await api(`items/${name}`)); render(); };

  const save = async (item, values) => {
    const body = { ...values };
    if (item) {
      const { item: updated } = await api(`items/${name}/${item.id}`, { method: 'PUT', body });
      Object.assign(item, updated);
    } else {
      const { item: created } = await api(`items/${name}`, { method: 'POST', body });
      items.push(created);
    }
    render();
    refreshCounts();
  };

  $('#add-item').addEventListener('click', () => openItemForm(def, null, (values) => save(null, values).then(() => toast(`${def.singular} added.`))));
  $('#item-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = Number(b.closest('[data-id]').dataset.id);
    const idx = items.findIndex((x) => x.id === id);
    const it = items[idx];
    try {
      if (b.dataset.act === 'edit') openItemForm(def, it, (values) => save(it, values).then(() => toast('Changes saved.')));
      if (b.dataset.act === 'toggle') {
        await save(it, { ...it, published: !it.published });
        toast(it.published ? `${def.singular} is now visible.` : `${def.singular} hidden from the website.`);
      }
      if (b.dataset.act === 'delete') {
        if (!confirm(`Delete "${it[def.titleField]}"? This cannot be undone.`)) return;
        await api(`items/${name}/${id}`, { method: 'DELETE' });
        items.splice(idx, 1);
        render(); refreshCounts();
        toast(`${def.singular} deleted.`);
      }
      if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = b.dataset.act === 'up' ? idx - 1 : idx + 1;
        [items[idx], items[j]] = [items[j], items[idx]];
        render();
        ({ items } = await api(`items/${name}/reorder`, { method: 'POST', body: { ids: items.map((x) => x.id) } }));
        render();
        $(`[data-id="${id}"] [data-act="${b.dataset.act}"]`)?.focus();
      }
    } catch (err) { if (err.status !== 401) { toast(err.message, 'error'); load(); } }
  });
  await load();
}

/* ---------------- generic form fields ---------------- */
function fieldHtml(f, value, idPrefix = 'f') {
  const id = `${idPrefix}-${f.name}`;
  const req = f.required ? ' <span class="text-brand-400">*</span>' : '';
  const help = f.help ? `<p class="help">${esc(f.help)}</p>` : '';
  const common = `id="${id}" name="${f.name}" ${f.max && f.type !== 'list' ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}"`;
  let control;
  switch (f.type) {
    case 'textarea':
      control = `<textarea ${common} class="textarea" rows="4">${esc(value)}</textarea>`; break;
    case 'list':
      control = `<textarea ${common} class="textarea" rows="4">${esc((value || []).join('\n'))}</textarea>`; break;
    case 'select':
      control = `<select id="${id}" name="${f.name}" class="select">${f.required ? '' : '<option value="">—</option>'}${f.options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o[0].toUpperCase() + o.slice(1)}</option>`).join('')}</select>`; break;
    case 'icon':
      control = `<input type="hidden" id="${id}" name="${f.name}" value="${esc(value || '')}" />
        <div class="icon-grid" role="radiogroup" aria-label="${esc(f.label)}">${Object.entries(state.schema.icons).map(([k, p]) => `<button type="button" class="icon-choice ${k === value ? 'selected' : ''}" data-icon="${k}" role="radio" aria-checked="${k === value}" aria-label="${k}" title="${k}">${svg(p)}</button>`).join('')}</div>`; break;
    case 'image':
      control = `<input type="hidden" id="${id}" name="${f.name}" value="${esc(value || '')}" />
        <div class="flex flex-wrap items-center gap-3">
          <img data-preview src="${esc(value || '')}" alt="" class="h-16 w-28 rounded-lg border border-white/10 object-cover ${value ? '' : 'hidden'}" />
          <label class="btn btn-ghost btn-sm cursor-pointer">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" data-upload="${id}" /></label>
          <button type="button" class="btn btn-ghost btn-sm ${value ? '' : 'hidden'}" data-clear-image="${id}">Remove</button>
        </div>`; break;
    default:
      control = `<input ${common} type="${f.type === 'email' ? 'email' : f.type === 'url' ? 'text' : 'text'}" class="input" value="${esc(value)}" />`;
  }
  return `<div class="field" data-field="${f.name}"><label class="label" for="${id}">${esc(f.label)}${req}</label>${control}${help}<p class="field-error hidden"></p></div>`;
}

function wireFieldControls(root) {
  root.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-icon]');
    if (choice) {
      const field = choice.closest('.field');
      $$('.icon-choice', field).forEach((c) => { c.classList.toggle('selected', c === choice); c.setAttribute('aria-checked', String(c === choice)); });
      $('input[type="hidden"]', field).value = choice.dataset.icon;
    }
    const clear = e.target.closest('[data-clear-image]');
    if (clear) {
      const field = clear.closest('.field');
      $('input[type="hidden"]', field).value = '';
      $('[data-preview]', field).classList.add('hidden');
      clear.classList.add('hidden');
    }
  });
  root.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-upload]');
    if (!input || !input.files[0]) return;
    const field = input.closest('.field');
    const fd = new FormData();
    fd.append('file', input.files[0]);
    try {
      const { url } = await api('upload', { method: 'POST', form: fd });
      $('input[type="hidden"]', field).value = url;
      const img = $('[data-preview]', field);
      img.src = url;
      img.classList.remove('hidden');
      $('[data-clear-image]', field).classList.remove('hidden');
      toast('Image uploaded.');
    } catch (err) { if (err.status !== 401) toast(err.message, 'error'); }
    input.value = '';
  });
}

function showFieldErrors(root, errors) {
  $$('.field', root).forEach((f) => {
    const msg = errors[f.dataset.field];
    f.classList.toggle('has-error', Boolean(msg));
    const el = $('.field-error', f);
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  });
  const first = $('.has-error input:not([type="hidden"]), .has-error textarea, .has-error select, .has-error button', root);
  if (first) first.focus();
}

function openItemForm(def, item, onSave) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const pubLabel = def.publishedLabel ? `${def.publishedLabel} (accepting applications)` : 'Visible on the website';
  dialog.innerHTML = `
    <form class="card flex max-h-[calc(100vh-2rem)] flex-col" novalidate>
      <div class="flex items-center justify-between border-b divider px-6 py-4">
        <h2 class="font-semibold text-white">${item ? 'Edit' : 'Add'} ${esc(def.singular.toLowerCase())}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="grid gap-5 overflow-y-auto px-6 py-5">
        ${def.fields.map((f) => fieldHtml(f, item ? item[f.name] : (f.type === 'select' && f.required ? f.options[0] : ''))).join('')}
        <label class="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="published" class="h-4 w-4 accent-cyan-400" ${!item || item.published ? 'checked' : ''} /> ${esc(pubLabel)}</label>
      </div>
      <div class="flex justify-end gap-2 border-t divider px-6 py-4">
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${item ? 'Save changes' : 'Add'}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  const form = $('form', dialog);
  wireFieldControls(form);
  const close = () => { dialog.close(); dialog.remove(); };
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', close));
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = { published: form.published.checked };
    def.fields.forEach((f) => { values[f.name] = form.elements[f.name].value; });
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await onSave(values);
      close();
    } catch (err) {
      if (err.status === 401) { close(); return; }
      showFieldErrors(form, err.fields || {});
      toast(err.message, 'error');
    } finally { btn.disabled = false; }
  });
  dialog.showModal();
  $('input:not([type="hidden"]), textarea, select', form)?.focus();
}

/* ---------------- settings ---------------- */
async function viewSettings(view) {
  setTitle('Site settings');
  const { settings } = await api('settings');
  const groups = {};
  state.schema.settings.forEach((f) => { (groups[f.group] ||= []).push(f); });
  view.innerHTML = `
    <form id="settings-form" class="max-w-3xl space-y-6" novalidate>
      ${Object.entries(groups).map(([g, fields]) => `
        <section class="card p-6">
          <h2 class="font-semibold text-white">${esc(g)}</h2>
          <div class="mt-5 grid gap-5 ${g === 'SEO' ? '' : 'sm:grid-cols-2'}">${fields.map((f) => fieldHtml(f, settings[f.name], 's')).join('')}</div>
        </section>`).join('')}
      <div class="flex justify-end"><button type="submit" class="btn btn-primary">Save settings</button></div>
    </form>`;
  const form = $('#settings-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(state.schema.settings.map((f) => [f.name, form.elements[f.name].value]));
    try {
      await api('settings', { method: 'PUT', body: values });
      showFieldErrors(form, {});
      toast('Settings saved. The website is updated.');
    } catch (err) {
      if (err.status === 401) return;
      showFieldErrors(form, err.fields || {});
      toast(err.message, 'error');
    }
  });
}

/* ---------------- account ---------------- */
function viewAccount(view) {
  setTitle('Account');
  const min = state.schema.passwordMin;
  view.innerHTML = `
    <div class="max-w-xl space-y-6">
      <section class="card p-6">
        <h2 class="font-semibold text-white">Signed in as</h2>
        <p class="mt-2 text-slate-300">${esc(state.user.name || '—')} · ${esc(state.user.email)}</p>
        <p class="help">To add another admin, run <code class="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">npm run create-admin</code> on the server.</p>
      </section>
      <form id="pw-form" class="card space-y-5 p-6" novalidate>
        <h2 class="font-semibold text-white">Change password</h2>
        <div><label class="label" for="pw-current">Current password</label><input id="pw-current" name="current" type="password" class="input" autocomplete="current-password" required /></div>
        <div><label class="label" for="pw-next">New password</label><input id="pw-next" name="next" type="password" class="input" autocomplete="new-password" minlength="${min}" required /><p class="help">At least ${min} characters. Other devices will be signed out.</p></div>
        <div><label class="label" for="pw-confirm">Confirm new password</label><input id="pw-confirm" name="confirm" type="password" class="input" autocomplete="new-password" required /></div>
        <p id="pw-error" class="field-error hidden" role="alert"></p>
        <button type="submit" class="btn btn-primary">Update password</button>
      </form>
    </div>`;
  const form = $('#pw-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#pw-error');
    const fail = (m) => { err.textContent = m; err.classList.remove('hidden'); };
    if (form.next.value.length < min) return fail(`New password must be at least ${min} characters.`);
    if (form.next.value !== form.confirm.value) return fail('New passwords do not match.');
    try {
      await api('password', { method: 'POST', body: { current: form.current.value, next: form.next.value } });
      form.reset();
      err.classList.add('hidden');
      toast('Password updated.');
    } catch (ex) { if (ex.status !== 401) fail(ex.message); }
  });
}

/* ---------------- boot ---------------- */
async function boot() {
  state.schema = await api('schema');
  renderShell();
  window.addEventListener('hashchange', route);
  await refreshCounts();
  if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
  else route();
  setInterval(refreshCounts, 60_000);
}

(async () => {
  try {
    const { user } = await api('me');
    state.user = user;
    await boot();
  } catch (err) {
    if (err.status !== 401) renderLogin(err.status ? err.message : 'Cannot reach the server.');
  }
})();
