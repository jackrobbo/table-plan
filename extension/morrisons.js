// Table Plan for Morrisons: content script for groceries.morrisons.com.
//
// What it does: opens each product on your list in turn and presses the same Add / + buttons you would press, in your own
// browser and your own session (signed in or not). It never calls Morrisons' APIs, never reads your login, and never goes past
// the trolley: you still choose a slot and check out yourself.
//
// How it is started: Table Plan opens a Morrisons product page with the list in the URL fragment (#tableplan=<base64url JSON>,
// format in extension/README.md). We store it, remove it from the address bar, and ask before doing anything.
(() => {
  'use strict';

  const JOB_KEY = 'tp_job';
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const MAX_QTY = 36; // Morrisons' own limit on the quantity box
  const BASE = 'https://groceries.morrisons.com/products/';
  const PACE_MS = 200;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Same script runs in the browser extension (chrome.storage) and in the Android app's Morrisons screen, where the app injects it
  // and provides window.TPNative (job kept in the app, handoff given by the app instead of the URL fragment).
  const native = window.TPNative || null;
  if (native && window.__tpInjected) return;
  if (native) window.__tpInjected = true;
  const store = native ? {
    get: async () => { try { return JSON.parse(native.getJob() || 'null'); } catch { return null; } },
    set: async (job) => { native.setJob(JSON.stringify(job)); },
    clear: async () => { native.clearJob(); },
  } : {
    get: async () => (await chrome.storage.local.get(JOB_KEY))[JOB_KEY] || null,
    set: (job) => chrome.storage.local.set({ [JOB_KEY]: job }),
    clear: () => chrome.storage.local.remove(JOB_KEY),
  };

  /** Polls until fn() is truthy; returns its value, or null on timeout. */
  async function waitFor(fn, timeout = 10000, every = 60) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(every);
    }
  }

  // ---- reading the page ---------------------------------------------------------------------------------------------
  // Product pages also carry "You might also like" carousels with their own Add buttons; the main product is the one outside them.
  const CAROUSEL = '[data-test="carousel-fop-wrapper"]';
  const main = (sel) => [...document.querySelectorAll(sel)].find((e) => !e.closest(CAROUSEL)) || null;
  const addButton = () => main('button[data-test="counter-button"][data-synthetics="add-button"]');
  const incButton = () => main('button[data-test="counter:increment"]');
  const qtyInput = () => main('input[data-test="quantity-in-basket"]');
  const quantity = () => (qtyInput() ? Number(qtyInput().value) || 0 : 0);
  const hasControl = () => !!(addButton() || qtyInput());
  const skuOf = (path) => (path.match(/(\d+)\/?$/) || [])[1] || null;

  const visible = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  /** The "Check if we deliver to you" box appears after a first add and blocks clicks until closed. */
  function closeDialogs() {
    let closed = false;
    for (const d of document.querySelectorAll('[role="dialog"]')) {
      if (!visible(d) || d.closest('#onetrust-consent-sdk')) continue;
      const x = d.querySelector('button[aria-label="Close modal"], button[aria-label="Close"]');
      if (x) { x.click(); closed = true; }
    }
    if (!closed && [...document.querySelectorAll('[role="dialog"]')].some((d) => visible(d) && !d.closest('#onetrust-consent-sdk'))) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }
  }

  // ---- the list arriving from Table Plan ---------------------------------------------------------------------------
  function readHandoff() {
    const m = location.hash.match(/^#tableplan=([A-Za-z0-9_-]+)$/);
    if (!m) return null;
    try {
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (d.v !== 1 || !Array.isArray(d.items)) return null;
      const items = d.items.slice(0, 120)
        .map((x) => ({ s: String(x.s), q: Math.max(1, Math.min(MAX_QTY, Math.floor(Number(x.q)) || 1)), n: String(x.n || '').slice(0, 120) }))
        .filter((x) => /^[a-z0-9][a-z0-9-]*\/\d+$/i.test(x.s));
      return items.length ? items : null;
    } catch { return null; }
  }

  // ---- panel (shadow DOM so Morrisons' styles can't touch it, and ours can't touch theirs) ----------------------------
  let host = null;
  let root = null;
  function ui() {
    if (host) return root;
    host = document.createElement('div');
    host.id = 'table-plan-ext';
    host.style.cssText = native ? 'position:fixed;inset:0;z-index:2147483647;' : 'position:fixed;right:16px;bottom:16px;max-width:calc(100vw - 32px);z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{--ink:#141414;--ink2:#6b6b70;--card:rgba(255,255,255,.94);--bg:#f2f2f6;--line:rgba(0,0,0,.1);--fill:rgba(118,118,128,.14);--btn:#141414;--btn-ink:#fff;--ok:oklch(0.55 0.13 150);--warn:oklch(0.55 0.13 60);--bad:#c4361f;--track:rgba(118,118,128,.2);--shadow:0 12px 34px rgba(32,64,60,.18),0 1px 2px rgba(0,0,0,.08)}
      @media (prefers-color-scheme:dark){:host{--ink:#f4f4f6;--ink2:#98989f;--card:rgba(34,40,42,.94);--bg:#000;--line:rgba(255,255,255,.14);--fill:rgba(118,118,128,.3);--btn:#f4f4f6;--btn-ink:#141414;--ok:oklch(0.75 0.14 150);--warn:oklch(0.78 0.13 75);--bad:#ff7a66;--shadow:0 12px 34px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4)}}
      .p{all:initial;display:block;box-sizing:border-box;width:min(340px,calc(100vw - 32px));max-height:70vh;overflow:auto;font:15px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:var(--ink);background:var(--card);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);box-shadow:inset 0 0 0 1px var(--line),var(--shadow);border-radius:18px;padding:16px}
      h2{font-size:15px;font-weight:600;margin:0 0 8px;display:flex;align-items:center;gap:8px}
      .logo{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;background:linear-gradient(160deg,#3a3d44,#0e0f12);color:#fff;font-size:13px;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 3px 8px rgba(10,20,20,.25)}
      p{margin:4px 0}.m{color:var(--ink2);font-size:14px}b{font-weight:600}
      .bar{height:6px;border-radius:99px;background:var(--track);margin:12px 0 10px;overflow:hidden}.bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ok),#6cc3ff);transition:width .3s}
      .row{display:flex;gap:8px;margin-top:14px}
      button{all:initial;box-sizing:border-box;font:600 16px -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;min-height:48px;display:flex;align-items:center;justify-content:center;padding:0 16px;border-radius:14px;cursor:pointer;text-align:center;flex:1}
      button:focus-visible{outline:3px solid var(--ok);outline-offset:2px}
      .go{background:var(--btn);color:var(--btn-ink)}.no{background:var(--fill);color:var(--ink)}
      ul{list-style:none;margin:8px 0 0;padding:0;font-size:14px}li{padding:6px 0;display:flex;gap:8px;border-top:1px solid var(--line)}li:first-child{border-top:0}li b{flex:0 0 14px}
      .p.full{width:100%;max-width:none;height:100%;max-height:none;border-radius:0;box-shadow:none;padding:24px 20px;display:flex;flex-direction:column;overflow:auto;font-size:17px;-webkit-backdrop-filter:none;backdrop-filter:none;background:radial-gradient(60% 38% at 8% 0%,rgba(110,205,160,.45),transparent 70%),radial-gradient(55% 36% at 100% 6%,rgba(120,170,255,.38),transparent 70%),var(--bg)}
      .full .row{margin-top:auto;padding-top:16px;padding-bottom:max(8px,env(safe-area-inset-bottom))}.full button{min-height:52px;font-size:17px}
      .c{margin:auto 0;text-align:center}.c h2{justify-content:center;font-size:20px}
      .spin{width:44px;height:44px;border:4px solid var(--track);border-top-color:var(--ink);border-radius:50%;animation:s 1s linear infinite;margin:0 auto 20px}@keyframes s{to{transform:rotate(1turn)}}
      .big{font-size:46px;font-weight:700;letter-spacing:-.02em;margin:0;font-variant-numeric:tabular-nums}.big span{font-size:20px;color:var(--ink2);font-weight:500;margin-left:6px}
      .t{font-size:17px;font-weight:600;margin:2px 0 6px}.cur{min-height:20px}.recent{margin:14px auto 0;max-width:320px;text-align:left}.recent li{border-top:0;padding:4px 0}.small{margin-top:16px;font-size:13px}
      .bar i{position:relative;overflow:hidden}.bar i::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.55) 50%,transparent 80%);transform:translateX(-100%);animation:sh 1.3s ease-in-out infinite}@keyframes sh{to{transform:translateX(100%)}}
      .trolley{display:inline-flex;align-items:center;gap:8px;margin:14px 0 0;font-size:15px;color:var(--ink2)}.trolley svg{width:22px;height:22px;color:var(--ink);flex:none}.trolley .cnt{color:var(--ink);display:inline-block;animation:pop .45s cubic-bezier(.34,1.5,.5,1)}
      .recent li:first-child{animation:rowIn .45s cubic-bezier(.2,.8,.2,1) both}.recent li:first-child b{display:inline-block;animation:pop .5s cubic-bezier(.34,1.5,.5,1) .1s both}
      @keyframes rowIn{from{opacity:0;transform:translateY(-10px) scale(.98)}}@keyframes pop{0%{transform:scale(.4)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
      @media (prefers-reduced-motion:reduce){.bar i::after,.trolley .cnt,.recent li:first-child,.recent li:first-child b{animation:none}}
      @media (prefers-reduced-motion:reduce){.spin{animation-duration:3s}.bar i{transition:none}}
      h3{font-size:13px;font-weight:600;color:var(--ink2);margin:18px 0 4px}li{align-items:flex-start}li .go{flex:0 0 auto;min-height:34px;padding:0 14px;font-size:14px;border-radius:10px}
      .pill{all:initial;position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));background:var(--btn);color:var(--btn-ink);font:600 15px -apple-system,system-ui,sans-serif;padding:12px 18px;border-radius:99px;box-shadow:var(--shadow);cursor:pointer}
      .ok b{color:var(--ok)}.warn b{color:var(--warn)}.bad b{color:var(--bad)}
    </style><div class="p" role="status" aria-live="polite"></div>`;
    document.documentElement.appendChild(host);
    return root;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function show(html, actions = [], centre = false) {
    const p = ui().querySelector('.p');
    p.className = native ? 'p full' : 'p';
    const body = native && centre ? `<div class="c"><h2><span class="logo">T</span>Table Plan</h2>${html}</div>` : `<h2><span class="logo">T</span>Table Plan</h2>${html}`;
    p.innerHTML = `${body}${actions.length ? '<div class="row"></div>' : ''}`;
    const row = p.querySelector('.row');
    for (const [label, cls, fn] of actions) {
      const b = document.createElement('button');
      b.className = cls; b.textContent = label; b.addEventListener('click', fn);
      row.appendChild(b);
    }
  }
  const hide = () => { host?.remove(); host = null; root = null; };

  // ---- the run ------------------------------------------------------------------------------------------------------
  let stopped = false;

  function showConfirm(job) {
    const n = job.items.length, units = job.items.reduce((a, x) => a + x.q, 0);
    show(`<p>Add <b>${n}</b> item${n === 1 ? '' : 's'} (${units} pack${units === 1 ? '' : 's'}) from your plan to your Morrisons trolley?</p>
      <p class="m">I'll open each product and press Add for you. You choose the delivery slot and check out yourself.</p>${native ? '<p class="m">You don\'t need to be signed in to Morrisons for this.</p>' : ''}`,
    [['Add them', 'go', () => start(job)], ['Cancel', 'no', async () => { await store.clear(); hide(); native?.close(); }]], true);
  }

  async function start(job) {
    job.state = 'running'; job.i = 0; job.tries = 0; job.results = []; job.at = Date.now();
    await store.set(job);
    await step(job);
  }

  function showProgress(job, note) {
    const n = job.items.length;
    const item = job.items[job.i];
    const stop = [['Stop', 'no', async () => { stopped = true; job.state = 'stopped'; await store.set(job); showSummary(job); }]];
    const bar = `<div class="bar"><i style="width:${Math.round((job.i / n) * 100)}%"></i></div>`;
    if (native) {
      const recent = (job.results || []).slice(-3).reverse();
      const added = (job.results || []).filter(isOk).length;
      const row = (x) => `<li class="${isOk(x) ? 'ok' : 'warn'}"><b>${isOk(x) ? '✓' : '!'}</b><span>${esc(x.n || x.s)}${x.q > 1 ? ` ×${x.q}` : ''}</span></li>`;
      const cart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
      // The page reloads for every product, so the bar starts where the last one's creep ended, snaps to this step, then keeps creeping.
      const from = Math.max(0, (job.i - 0.15) / n), to = job.i / n, creep = Math.min(0.97, (job.i + 0.85) / n);
      show(`<div class="spin"></div><p class="big"><b>${job.i + 1}</b><span>of ${n}</span></p><p class="t">Filling Your Trolley</p>
        <div class="bar"><i style="width:${Math.round(from * 100)}%"></i></div>
        <p class="m cur">${esc(item ? item.n || item.s : '')}</p>
        <p class="trolley">${cart}<span><b class="cnt">${added}</b> in your trolley</span></p>
        ${recent.length ? `<ul class="recent">${recent.map(row).join('')}</ul>` : ''}
        <p class="m small">Please wait. The page behind will keep changing.</p>`, stop, true);
      const fill = ui().querySelector('.bar i');
      if (fill) requestAnimationFrame(() => {
        fill.style.transition = 'width .35s ease-out'; fill.style.width = `${to * 100}%`;
        setTimeout(() => { fill.style.transition = 'width 4.5s linear'; fill.style.width = `${creep * 100}%`; }, 380);
      });
      return;
    }
    show(`<p><b>Adding ${job.i + 1} of ${n}</b></p><p class="m">${esc(item ? item.n || item.s : '')}</p>
      ${bar}${note ? `<p class="m">${esc(note)}</p>` : ''}`, stop);
  }

  async function step(job) {
    if (stopped) return;
    const item = job.items[job.i];
    if (!item) return finish(job);
    showProgress(job);

    // Be on this product's page (the SKU is what identifies it; the name part of the URL may be tidied by Morrisons).
    if (!location.pathname.startsWith('/products/') || skuOf(location.pathname) !== skuOf(item.s)) {
      job.tries = (job.tries || 0) + 1;
      if (job.tries > 2) return record(job, item, { status: 'unavailable', note: 'The product page would not open (it may have been removed).' });
      await store.set(job);
      location.assign(BASE + item.s);
      return;
    }

    const res = await addToTrolley(job, item);
    if (stopped) return;
    await record(job, item, res);
  }

  async function record(job, item, res) {
    job.results.push({ s: item.s, n: item.n, q: item.q, ...res });
    job.i += 1; job.tries = 0;
    await store.set(job);
    if (job.i >= job.items.length) return finish(job);
    showProgress(job);
    await sleep(PACE_MS);
    if (stopped) return;
    location.assign(BASE + job.items[job.i].s);
  }

  async function addToTrolley(job, item) {
    if (!(await waitFor(hasControl, 12000))) return { status: 'unavailable', note: 'No Add button on the page: out of stock, or not available where you deliver.' };

    const cap = Math.min(item.q, Number(qtyInput()?.max) || MAX_QTY);
    let cur = quantity();
    if (cur >= cap) return { status: 'already', got: cur, note: `${cur} already in your trolley` };
    const before = cur;

    for (let guard = 0; cur < cap && guard < cap + 3 && !stopped; guard++) {
      closeDialogs();
      const btn = cur === 0 ? addButton() : incButton();
      if (!btn) break;
      btn.click();
      let moved = await waitFor(() => quantity() > cur, 6000);
      if (!moved) { closeDialogs(); moved = await waitFor(() => quantity() > cur, 3000); }
      if (!moved) break;
      cur = quantity();
      await sleep(150);
    }
    closeDialogs();
    if (cur >= cap) return { status: 'added', got: cur, ...(before ? { note: `${before} were already in your trolley` } : {}) };
    return { status: cur > before ? 'partial' : 'blocked', got: cur, note: cur > before ? `Only ${cur} of ${item.q} could be added` : 'Morrisons did not accept the click' };
  }

  async function finish(job) {
    job.state = 'done'; await store.set(job);
    showSummary(job);
  }

  const isOk = (x) => x.status === 'added' || x.status === 'already';
  function showSummary(job) {
    const r = job.results || [];
    const good = r.filter(isOk);
    const todo = r.filter((x) => !isOk(x));
    const left = job.items.slice(r.length); // stopped before these
    const line = (x, cls, mark, open) => `<li class="${cls}"><b>${mark}</b><span>${esc(x.n || x.s)}${x.q > 1 ? ` ×${x.q}` : ''}${x.note ? `<br><span class="m">${esc(x.note)}</span>` : ''}</span>${open ? `<button class="go" data-open="${esc(x.s)}">Open</button>` : ''}</li>`;
    const need = [
      ...todo.map((x) => line(x, x.status === 'partial' ? 'warn' : 'bad', x.status === 'partial' ? '!' : '✕', native)),
      ...left.map((x) => line({ ...x, note: 'Not tried (stopped)' }, 'warn', '–', native)),
    ];
    const head = `<p><b>${good.length} of ${job.items.length}</b> are in your trolley.</p>`;
    const needHtml = need.length
      ? `<h3>You'll need to add these yourself (${need.length})</h3><ul>${need.join('')}</ul>`
      : '<p class="m">Everything on your list went in.</p>';
    const goodHtml = good.length ? `<h3>Added (${good.length})</h3><ul>${good.map((x) => line(x, 'ok', '✓', false)).join('')}</ul>` : '';
    show(`${head}${needHtml}${goodHtml}
      <p class="m" style="margin-top:12px">Next: check the trolley, choose a delivery slot and check out. Morrisons may flag more items as unavailable once you sign in and it knows your address.</p>`,
    [['Open trolley', 'go', () => { if (native) { job.state = 'browsing'; store.set(job); hide(); } document.querySelector('button[aria-label^="Trolley"]')?.click(); }],
      ['Done', 'no', async () => { await store.clear(); hide(); native?.close(); }]]);
    if (native) ui().querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
      job.state = 'browsing'; await store.set(job); location.assign(BASE + b.getAttribute('data-open'));
    }));
  }

  /** After "Open" on an item the summary steps aside; this pill brings it back. */
  function showPill(job) {
    ui().querySelector('.p').remove();
    host.style.cssText = 'position:fixed;left:0;bottom:0;z-index:2147483647;';
    const b = document.createElement('button');
    b.className = 'pill'; b.textContent = 'Back to Table Plan summary';
    b.addEventListener('click', async () => { host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;'; job.state = 'done'; await store.set(job); hide(); showSummary(job); });
    root.appendChild(b);
  }

  // ---- entry --------------------------------------------------------------------------------------------------------
  async function init() {
    const items = readHandoff();
    if (items) {
      history.replaceState(null, '', location.pathname + location.search);
      const job = { id: Date.now(), items, i: 0, results: [], state: 'ready', tries: 0, at: Date.now() };
      await store.set(job);
      return showConfirm(job);
    }
    const job = await store.get();
    if (!job) return;
    if (Date.now() - (job.at || 0) > MAX_AGE_MS) { await store.clear(); return; }
    if (job.state === 'ready') return showConfirm(job);
    if (job.state === 'running') return step(job);
    if (job.state === 'done' || job.state === 'stopped') return showSummary(job);
    if (job.state === 'browsing' && native) return showPill(job);
  }
  init().catch((e) => { console.error('Table Plan extension', e); });
})();
