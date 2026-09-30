/* ==========================================================================
   NTALEC — site interactivity
   - Sticky header state, mobile menu, active nav link
   - Scroll reveal
   - Scroll-driven story: hero video → section cards → each section's video plays with the
     scroll (Services, Case Studies, About Us, Careers), then its content
   - Contact form validation + submission (/api/contact)
   - Job application dialog with CV upload (/api/apply)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Footer year ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Sticky header + back-to-top ---------- */
  const header = $('#site-header');
  const toTop = $('#to-top');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    toTop.classList.toggle('show', y > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('#menu-toggle');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    $('.icon-open', menuBtn).classList.toggle('hidden', open);
    $('.icon-close', menuBtn).classList.toggle('hidden', !open);
    if (open) header.classList.add('is-scrolled');
    else onScroll();
  };
  menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = $$('.nav-link, .mobile-link');
  const sections = $$('main section[id]');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));

  /* ---------- Scroll reveal ---------- */
  // Scene content (cards, headings) rises in as it scrolls over the video's last frame
  $$('.scene-content .service-card, .scene-content .model-card, .scene-content .stack-row, .scene-content .industry-grid li, .scene-content .cta-banner, .scene-content .project-card, .scene-content .feature, .scene-content .step, .scene-content .job, .scene-content .about-stat, .scene-content .timeline li, .scene-content .text-center, .scene-content .lg\\:col-span-2')
    .forEach((el) => el.classList.add('reveal'));
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el, i) => {
    // Stagger siblings slightly for a smoother cascade
    el.style.transitionDelay = `${(i % 3) * 80}ms`;
    revealObserver.observe(el);
  });

  /* ---------- Service card spotlight (follows cursor) ---------- */
  $$('.service-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ==========================================================================
     Scroll-driven story
     Hero: camera flies into the building → four cards fade in → the other three fade out and
     the Services card moves to the centre and grows. Then, for each scene (Services, Case
     Studies, About Us, Careers): the screen fades to dark behind the section's card, the card
     enlarges and dissolves, the section's video plays with the scroll, and when the video ends
     the content scrolls up over its last frame.

     Smoothness: every clip has a single keyframe, so seeking a <video> is slow. Each clip is
     played once, muted, in a tiny off-screen dock; every frame is captured to a JPEG and the
     stage canvas paints the cached frame for the current scroll position (nearest captured
     frame while capture is still running). If playback is blocked (e.g. iOS Low Power Mode),
     it falls back to seeking the video.
     ========================================================================== */
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const range = (p, start, end) => clamp((p - start) / (end - start));
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep
  const lerp = (a, b, t) => a + (b - a) * t;
  const FPS = 24;
  const CAPTURE_W = window.innerWidth < 768 ? 960 : 1280;
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  // Videos being captured must be "on screen" for browsers to keep decoding them
  const dock = document.createElement('div');
  dock.setAttribute('aria-hidden', 'true');
  dock.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.appendChild(dock);

  const createScrubber = (src, canvas) => {
    const ctx = canvas.getContext('2d');
    const frames = [];
    let frameCount = 0;
    let target = 0;
    let current = 0;
    let drawn = -1;
    let video = null;
    let blobUrl = null;
    let seekMode = false;

    const paint = (img, sw, sh) => {
      const cw = canvas.width, ch = canvas.height;
      if (!cw || !ch || !sw) return;
      const scale = Math.max(cw / sw, ch / sh);
      const w = sw * scale, h = sh * scale;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    };
    const nearest = (i) => {
      for (let d = 0; d < frameCount; d++) {
        if (frames[i - d]) return i - d;
        if (frames[i + d]) return i + d;
      }
      return -1;
    };

    const api = {
      get ready() { return frameCount > 0; },
      // fraction 0..1 of the clip; `instant` skips the easing (used after jumps)
      set(fraction, instant = false) {
        if (!frameCount) return;
        target = clamp(fraction) * (frameCount - 1);
        if (instant) current = target;
      },
      resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        drawn = -1;
      },
      tick() {
        if (!frameCount) return;
        const diff = target - current;
        current = Math.abs(diff) < 0.01 ? target : current + diff * (prefersReducedMotion ? 1 : 0.16);
        const want = Math.round(current);
        if (seekMode) {
          if (want !== drawn && !video.seeking) { video.currentTime = want / FPS; drawn = want; }
          return;
        }
        const i = nearest(want);
        if (i !== -1 && i !== drawn) { paint(frames[i], frames[i].naturalWidth, frames[i].naturalHeight); drawn = i; }
      },
      // Download the clip and paint its first frame
      load() {
        if (api._load) return api._load;
        api._load = fetch(src)
          .then((res) => { if (!res.ok) throw new Error(res.status); return res.blob(); })
          .then((blob) => (blobUrl = URL.createObjectURL(blob)))
          .catch(() => src) // e.g. opened via file:// — stream it instead
          .then((url) => new Promise((resolve) => {
            video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.src = url;
            dock.appendChild(video);
            video.addEventListener('loadeddata', () => {
              frameCount = Math.max(1, Math.round(video.duration * FPS));
              api.resize();
              paint(video, video.videoWidth, video.videoHeight);
              resolve();
            }, { once: true });
            video.addEventListener('error', () => resolve(), { once: true });
          }));
        return api._load;
      },
      // Play once and cache every frame; resolves when the clip has ended
      capture() {
        if (api._capture) return api._capture;
        api._capture = api.load().then(() => new Promise((resolve) => {
          if (!frameCount) { resolve(); return; }
          const cw = Math.min(video.videoWidth, CAPTURE_W);
          const chh = Math.round(cw * video.videoHeight / video.videoWidth);
          const off = document.createElement('canvas');
          off.width = cw;
          off.height = chh;
          const octx = off.getContext('2d');
          const next = (fn) => (hasRVFC ? video.requestVideoFrameCallback(fn) : requestAnimationFrame(fn));
          let done = false;

          const grab = (mediaTime) => {
            const i = Math.min(frameCount - 1, Math.round(mediaTime * FPS));
            if (frames[i]) return;
            octx.drawImage(video, 0, 0, cw, chh);
            off.toBlob((blob) => {
              if (!blob) return;
              const img = new Image();
              img.src = URL.createObjectURL(blob);
              img.decode().then(() => { frames[i] = img; drawn = -1; }).catch(() => {});
            }, 'image/jpeg', 0.82);
          };
          const loop = (now, meta) => {
            if (done) return;
            grab(meta ? meta.mediaTime : video.currentTime);
            next(loop);
          };
          const onVisibility = () => {
            if (done) return;
            if (document.hidden) video.pause();
            else video.play().catch(() => {});
          };
          const finish = () => {
            done = true;
            document.removeEventListener('visibilitychange', onVisibility);
            // Free the clip once its frames are cached
            setTimeout(() => {
              video.removeAttribute('src');
              video.load();
              video.remove();
              if (blobUrl) URL.revokeObjectURL(blobUrl);
            }, 1000);
            resolve();
          };

          document.addEventListener('visibilitychange', onVisibility);
          video.addEventListener('ended', finish, { once: true });
          video.play()
            .then(() => { grab(0); next(loop); })
            .catch(() => { // autoplay blocked → seek fallback, keep the video
              done = true;
              seekMode = true;
              drawn = -1;
              video.addEventListener('seeked', () => paint(video, video.videoWidth, video.videoHeight));
              resolve();
            });
        }));
        return api._capture;
      }
    };
    return api;
  };

  // Capture queue: two clips at a time on larger screens, one on phones; nearest scene first
  const captureQueue = [];
  let capturing = 0;
  const MAX_CAPTURE = window.innerWidth >= 1024 ? 2 : 1;
  const pump = () => {
    while (capturing < MAX_CAPTURE && captureQueue.length) {
      const s = captureQueue.shift();
      capturing++;
      s.capture().finally(() => { capturing--; pump(); });
    }
  };
  const prioritize = (s) => {
    const i = captureQueue.indexOf(s);
    if (i > 0) { captureQueue.splice(i, 1); captureQueue.unshift(s); pump(); }
  };

  const vh = () => window.innerHeight;
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  /* ---------- Hero ----------
     Hero is 500vh tall (400vh of scroll). Progress p (0 → 1):
       0.00 – 0.50  camera flies into the building
       0.40 – 0.52  four cards fade in
       0.58 – 0.74  other cards fade out; the Services card moves to the centre and grows
       0.75 – 1.00  the Services scene fades to dark over it (its "approach") */
  const hero = $('#home');
  const heroCanvas = $('#hero-canvas');
  const heroVideo = $('#hero-video');
  const CARD_SCALE = 1.5; // size of the focused card, shared with every chapter card
  let heroScrubber = null;
  let renderHero = () => {};
  let measureHero = () => {};

  if (hero && heroCanvas && heroVideo) {
    heroVideo.remove(); // capture uses its own element in the dock
    heroScrubber = createScrubber(heroVideo.dataset.src, heroCanvas);
    const nav = $('#hero-nav');
    const heading = $('.hero-heading', nav);
    const tiles = $$('.hero-tile', nav);
    const focusTile = $('.hero-tile[href="#services"]', nav);
    const hint = $('#scroll-hint');
    const shade = $('.hero-shade', hero);
    const bar = $('#hero-progress');
    let focusDX = 0, focusDY = 0;

    measureHero = () => {
      // Measure the Services card without any scroll-driven transforms applied
      const saved = [nav.style.transform, focusTile.style.transform];
      nav.style.transform = 'none';
      focusTile.style.transform = 'none';
      const r = focusTile.getBoundingClientRect();
      focusDX = document.documentElement.clientWidth / 2 - (r.left + r.width / 2); // excludes the scrollbar, like the stage
      focusDY = window.innerHeight / 2 - (r.top + r.height / 2);
      document.documentElement.style.setProperty('--chapter-w', `${r.width}px`);
      [nav.style.transform, focusTile.style.transform] = saved;
    };

    renderHero = () => {
      const scrollable = hero.offsetHeight - vh();
      const p = scrollable > 0 ? clamp(-hero.getBoundingClientRect().top / scrollable) : 0;

      hint.style.opacity = String(1 - range(p, 0, 0.04));
      bar.style.transform = `scaleX(${range(p, 0, 0.75)})`;
      heroScrubber.set(range(p, 0, 0.5));

      const inn = ease(range(p, 0.4, 0.52));
      const f = ease(range(p, 0.58, 0.74));
      nav.style.opacity = String(inn);
      nav.style.transform = `translateY(${40 * (1 - inn)}px)`;
      nav.classList.toggle('is-active', inn > 0.05);
      shade.style.opacity = String(0.45 * inn + 0.3 * f);
      heading.style.opacity = String(1 - f);
      heading.style.transform = `translateY(${-30 * f}px)`;
      tiles.forEach((t) => {
        if (t === focusTile) {
          t.style.transform = `translate(${focusDX * f}px, ${focusDY * f}px) scale(${1 + (CARD_SCALE - 1) * f})`;
          t.style.zIndex = '1';
        } else {
          t.style.opacity = String(1 - f);
          t.style.transform = `scale(${1 - 0.12 * f})`;
          t.style.pointerEvents = f > 0.5 ? 'none' : '';
        }
      });
    };

    captureQueue.push(heroScrubber);
  }

  /* ---------- Scenes ----------
     Each scene overlaps the previous section (200vh after the hero, 100vh otherwise) and has a
     400vh spacer, so its stage is pinned while the previous section is still on screen.
     v = screens scrolled since the scene's top reached the top of the viewport:
       0.00 – 1.00  approach: dark cover fades in over the previous content, card grows in
       1.00 – 1.45  cover fades out, card enlarges further and dissolves
       1.05 – 3.00  the video plays with the scroll
       3.00 – 3.60  content rises from the bottom over the last frame; shade darkens */
  const VIDEO_END = 3;
  const scenes = $$('.scene[data-video]').map((el, index) => {
    const canvas = $('.scene-canvas', el);
    return {
      el,
      first: index === 0, // Services: its card continues the hero's focused card
      canvas,
      shade: $('.scene-shade', el),
      cover: $('.scene-cover', el),
      card: $('.chapter-card', el),
      scrubber: createScrubber(el.dataset.video, canvas)
    };
  });
  scenes.forEach((s) => captureQueue.push(s.scrubber));

  const renderScene = (s) => {
    const v = (window.scrollY - docTop(s.el)) / vh();
    if (v < -1.5 || v > 6) return; // far away: nothing to update
    if (v > -2) prioritize(s.scrubber);

    const a = ease(range(v, 0, 1));    // approach
    const r = ease(range(v, 1, 1.45)); // reveal
    s.cover.style.opacity = String(v < 1 ? a : 1 - r);
    s.canvas.style.opacity = v >= 0.95 ? '1' : '0';

    const cardIn = s.first ? (v >= 0 ? 1 : 0) : range(v, 0.6, 0.95); // after the screen is mostly dark
    const cardScale = v < 1
      ? (s.first ? CARD_SCALE : lerp(0.75, CARD_SCALE, ease(range(v, 0.6, 1))))
      : CARD_SCALE * (1 + 0.6 * r);
    s.card.style.opacity = String(v < 1 ? cardIn : 1 - r);
    s.card.style.transform = `translate(-50%, -50%) scale(${cardScale})`;

    s.scrubber.set(range(v, 1.05, VIDEO_END));
    s.shade.style.opacity = String(ease(range(v, VIDEO_END, VIDEO_END + 0.6)));
  };

  const renderAll = () => {
    renderHero();
    scenes.forEach(renderScene);
  };
  const tickAll = () => {
    renderAll();
    if (heroScrubber) heroScrubber.tick();
    scenes.forEach((s) => s.scrubber.tick());
    requestAnimationFrame(tickAll);
  };
  const resizeAll = () => {
    measureHero();
    if (heroScrubber) heroScrubber.resize();
    scenes.forEach((s) => s.scrubber.resize());
  };
  window.addEventListener('resize', resizeAll);

  measureHero();
  renderAll();
  pump();
  requestAnimationFrame(tickAll);

  /* ---------- Clicking a section link: jump to its card and play the video ----------
     Links to #services, #portfolio, #about or #careers jump straight to that scene's
     enlarged card, then scroll through the video automatically and stop at the content.
     Any wheel, touch or key input hands control back to the visitor. */
  const sceneById = new Map(scenes.map((s) => [s.el.id, s]));
  let autoplay = null;
  const stopAutoplay = () => { if (autoplay) { cancelAnimationFrame(autoplay); autoplay = null; } };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) =>
    window.addEventListener(type, stopAutoplay, { passive: true }));

  const playScene = (s) => {
    stopAutoplay();
    prioritize(s.scrubber);
    const top = docTop(s.el);
    const start = top + vh();                                   // dark screen, card enlarged
    const end = top + (VIDEO_END + 1) * vh() - header.offsetHeight; // content at the top
    window.scrollTo({ top: start, behavior: 'instant' });
    if (prefersReducedMotion) { window.scrollTo({ top: end, behavior: 'instant' }); return; }
    const duration = 5200;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / duration);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      window.scrollTo({ top: start + (end - start) * k, behavior: 'instant' });
      autoplay = t < 1 ? requestAnimationFrame(step) : null;
    };
    autoplay = requestAnimationFrame(step);
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const s = sceneById.get(link.getAttribute('href').slice(1));
    if (!s) return;
    e.preventDefault();
    history.replaceState(null, '', `#${s.el.id}`);
    playScene(s);
  });

  // Direct links such as /#services
  const initialScene = sceneById.get(location.hash.slice(1));
  if (initialScene) window.addEventListener('load', () => playScene(initialScene), { once: true });

  /* ---------- Contact form ---------- */
  const form = $('#contact-form');
  if (form) {
    const status = $('#form-status');
    const submitBtn = $('button[type="submit"]', form);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const rules = {
      name: (v) => (v.length < 2 ? 'Please enter your full name.' : ''),
      email: (v) => (!v ? 'Please enter your email address.' : !EMAIL_RE.test(v) ? 'Please enter a valid email address.' : ''),
      subject: (v) => (v.length < 3 ? 'Please add a short subject.' : ''),
      message: (v) => (v.length < 20 ? `Please tell us a bit more (${Math.max(0, 20 - v.length)} more characters).` : '')
    };

    const validateField = (input) => {
      const rule = rules[input.name];
      if (!rule) return true;
      const msg = rule(input.value.trim());
      const field = input.closest('.field');
      field.classList.toggle('invalid', Boolean(msg));
      $('.error', field).textContent = msg;
      input.setAttribute('aria-invalid', String(Boolean(msg)));
      return !msg;
    };

    const inputs = $$('input[name], textarea[name]', form).filter((el) => rules[el.name]);
    inputs.forEach((input) => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => { if (input.closest('.field').classList.contains('invalid')) validateField(input); });
    });

    const showStatus = (type, msg) => {
      status.className = `mt-6 rounded-xl px-4 py-3 text-sm ${type}`;
      status.textContent = msg;
    };
    const setLoading = (loading) => {
      submitBtn.disabled = loading;
      $('.spinner', submitBtn).classList.toggle('hidden', !loading);
      $('.btn-label', submitBtn).textContent = loading ? 'Sending…' : 'Send Message';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const results = inputs.map(validateField);
      if (results.includes(false)) {
        inputs[results.indexOf(false)].focus();
        showStatus('error', 'Please fix the highlighted fields and try again.');
        return;
      }

      // Honeypot: silently accept bots without sending
      if (form._gotcha.value) { form.reset(); showStatus('success', 'Thank you! Your message has been sent.'); return; }

      const data = Object.fromEntries(inputs.map((i) => [i.name, i.value.trim()]));
      const endpoint = form.getAttribute('action') || '/api/contact';

      setLoading(true);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Show server-side field errors next to the fields
          Object.entries(body.fields || {}).forEach(([name, msg]) => {
            const input = form.elements[name];
            if (!input) return;
            input.closest('.field').classList.add('invalid');
            $('.error', input.closest('.field')).textContent = msg;
          });
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        form.reset();
        showStatus('success', `Thanks, ${data.name.split(' ')[0]}! Your message is on its way — we'll reply within one business day.`);
      } catch (err) {
        console.error(err);
        const mailto = form.dataset.mailto;
        showStatus('error', `Sorry, your message couldn't be sent${err.message ? ` (${err.message})` : ''}. Please try again or email us at ${mailto}.`);
      } finally {
        setLoading(false);
      }
    });
  }

  /* ---------- Job application dialog ----------
     Any [data-apply] button (job "Apply" buttons, "Send us your CV") opens the dialog.
     data-apply holds the job id ("" = general application). Submits multipart to /api/apply. */
  const applyDialog = $('#apply-dialog');
  if (applyDialog && typeof applyDialog.showModal === 'function') {
    const applyForm = $('#apply-form');
    const applyStatus = $('#apply-status');
    const applyBtn = $('button[type="submit"]', applyForm);
    const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const CV_TYPES = /\.(pdf|docx?)$/i;

    const setField = (input, msg) => {
      const field = input.closest('.field');
      field.classList.toggle('invalid', Boolean(msg));
      $('.error', field).textContent = msg || '';
    };
    const checks = {
      name: (v) => (v.trim().length < 2 ? 'Please enter your full name.' : ''),
      email: (v) => (!EMAIL_OK.test(v.trim()) ? 'Please enter a valid email address.' : ''),
      linkedin: (v) => (v.trim() && !/^https?:\/\/\S+$/i.test(v.trim()) ? 'Use a full link starting with https://' : ''),
      cv: (v, input) => {
        const file = input.files[0];
        if (!file) return 'Please attach your CV.';
        if (!CV_TYPES.test(file.name)) return 'CV must be a PDF, DOC or DOCX file.';
        if (file.size > 5 * 1024 * 1024) return 'CV must be 5 MB or smaller.';
        return '';
      }
    };
    const validateApply = () => {
      let first = null;
      Object.entries(checks).forEach(([name, check]) => {
        const input = applyForm.elements[name];
        const msg = check(input.value, input);
        setField(input, msg);
        if (msg && !first) first = input;
      });
      if (first) first.focus();
      return !first;
    };
    const showApplyStatus = (type, msg) => {
      applyStatus.className = `mt-5 rounded-xl px-4 py-3 text-sm ${type}`;
      applyStatus.textContent = msg;
    };

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-apply]');
      if (!trigger) return;
      e.preventDefault();
      applyForm.reset();
      $$('.field', applyForm).forEach((f) => { f.classList.remove('invalid'); $('.error', f).textContent = ''; });
      applyStatus.className = 'mt-5 hidden rounded-xl px-4 py-3 text-sm';
      applyBtn.disabled = false;
      applyBtn.hidden = false;
      $('#apply-job-id').value = trigger.dataset.apply || '';
      $('#apply-job-title').textContent = trigger.dataset.jobTitle || 'General application';
      const desc = $('#apply-job-description');
      desc.textContent = trigger.dataset.jobDescription || '';
      desc.classList.toggle('hidden', !desc.textContent);
      applyDialog.showModal();
      $('#apply-name').focus();
    });
    $('[data-close]', applyDialog).addEventListener('click', () => applyDialog.close());
    applyDialog.addEventListener('click', (e) => { if (e.target === applyDialog) applyDialog.close(); }); // backdrop
    Object.keys(checks).forEach((name) => {
      const input = applyForm.elements[name];
      input.addEventListener(name === 'cv' ? 'change' : 'blur', () => setField(input, checks[name](input.value, input)));
    });

    applyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateApply()) { showApplyStatus('error', 'Please fix the highlighted fields.'); return; }
      applyBtn.disabled = true;
      $('.spinner', applyBtn).classList.remove('hidden');
      $('.btn-label', applyBtn).textContent = 'Sending…';
      try {
        const res = await fetch('/api/apply', { method: 'POST', body: new FormData(applyForm), headers: { Accept: 'application/json' } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          Object.entries(body.fields || {}).forEach(([name, msg]) => { if (applyForm.elements[name]) setField(applyForm.elements[name], msg); });
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        showApplyStatus('success', 'Thank you! Your application has been received — our team will be in touch soon.');
        applyBtn.hidden = true;
      } catch (err) {
        console.error(err);
        const mailto = ($('#contact-form') || {}).dataset?.mailto || 'us';
        showApplyStatus('error', `Sorry, we couldn't submit your application (${err.message}). Please try again or email your CV to ${mailto}.`);
        applyBtn.disabled = false;
      } finally {
        $('.spinner', applyBtn).classList.add('hidden');
        $('.btn-label', applyBtn).textContent = 'Submit application';
      }
    });
  }
})();
