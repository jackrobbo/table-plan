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
  const PACE_MS = 600;

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
  async function waitFor(fn, timeout = 10000, every = 150) {
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
      .p{all:initial;display:block;box-sizing:border-box;width:min(320px,calc(100vw - 32px));max-height:70vh;overflow:auto;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#1d1d1f;background:#fff;border:1px solid #d8d8dc;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.22);padding:14px 16px}
      h2{font-size:15px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
      .logo{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#1c6b4a;color:#fff;font-size:12px;font-weight:700}
      p{margin:4px 0}.m{color:#6b6b72;font-size:13px}
      .bar{height:6px;border-radius:3px;background:#ececef;margin:10px 0 8px;overflow:hidden}.bar i{display:block;height:100%;background:#1c6b4a;transition:width .3s}
      .row{display:flex;gap:8px;margin-top:10px}
      button{all:initial;box-sizing:border-box;font:600 14px system-ui,sans-serif;padding:9px 14px;border-radius:9px;cursor:pointer;text-align:center;flex:1}
      .go{background:#1c6b4a;color:#fff}.no{background:#ececef;color:#1d1d1f}
      ul{list-style:none;margin:8px 0 0;padding:0;font-size:13px}li{padding:3px 0;display:flex;gap:6px}li b{flex:0 0 14px}
      .p.full{width:100%;max-width:none;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none;padding:24px 20px;display:flex;flex-direction:column;overflow:auto;font-size:16px}
      .full .row{margin-top:auto;padding-top:16px}.full button{padding:14px 16px;font-size:16px}
      .c{margin:auto 0;text-align:center}.c h2{justify-content:center;font-size:21px}
      .spin{width:48px;height:48px;border:5px solid #ececef;border-top-color:#1c6b4a;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 20px}@keyframes s{to{transform:rotate(1turn)}}
      h3{font-size:14px;margin:16px 0 4px}li{align-items:flex-start}li .go{flex:0 0 auto;padding:6px 12px;font-size:13px}
      .pill{all:initial;position:fixed;left:16px;bottom:16px;background:#1c6b4a;color:#fff;font:600 14px system-ui,sans-serif;padding:10px 16px;border-radius:99px;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer}
      .ok b{color:#1c6b4a}.warn b{color:#a15c00}.bad b{color:#b3261e}
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
    if (native) return show(`<div class="spin"></div><p style="font-size:19px"><b>Just filling your trolley</b></p><p class="m">Please wait. It takes a minute or two, and the page behind will keep changing.</p>${bar}
      <p class="m">${job.i + 1} of ${n}: ${esc(item ? item.n || item.s : '')}</p>`, stop, true);
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
      await sleep(350);
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
