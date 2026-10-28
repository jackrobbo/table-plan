// npm run match -- <command> --store tesco [options]
//
// Matches another store's products to our ingredients, from ANY price source (Yappman, Hobnight, a hand-made file):
//   suggest --input <file.json|csv> [--source yappman|hobnight|generic] [--price-unit pounds|pence] [--map cols.json]
//        reads the file, ranks the best stand-ins for each ingredient, saves content/matches/<store>.json
//   review [--port 4177]     a local page to confirm, change or reject each suggestion (nothing leaves this machine)
//   status                   how many are decided, and coverage of the ingredients live meals actually use
//   apply [--dry]            writes the confirmed matches into content/ingredients.json (products.<store>) and prices.<store>.json
//
// Source files and decisions stay in content/matches/ (gitignored: vendor data and licences). Only the result of `apply` is committed.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { validateContent } from '../src/lib/content/validate';
import { applyDecisions, neededIngredients } from '../src/lib/matching/apply';
import { scoreRow, suggest, tokens } from '../src/lib/matching/score';
import { normaliseRows, parseCsv, type SourceKind } from '../src/lib/matching/sources';
import type { Decision, SourceRow, Suggestion } from '../src/lib/matching/types';
import type { PriceCache } from '../src/lib/pricing/refresh';
import { STORES, isStoreId } from '../src/lib/stores';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k: string) => args.includes(`--${k}`);
const storeArg = opt('store') ?? '';
if (!cmd || !isStoreId(storeArg) || storeArg === 'morrisons') {
  console.error('Usage: npm run match -- <suggest|review|status|apply> --store tesco [options]  (see the header of scripts/match-products.ts)');
  process.exit(1);
}
const store = storeArg;
const readJson = <T>(f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const stateFile = `content/matches/${store}.json`;
interface State { store: string; source: string; createdAt: string; rows: SourceRow[]; suggestions: Record<string, Suggestion[]>; decisions: Record<string, Decision> }
const loadState = (): State => { if (!fs.existsSync(stateFile)) { console.error(`No ${stateFile}. Run "suggest" first.`); process.exit(1); } return readJson<State>(stateFile); };
const saveState = (s: State) => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s) + '\n'); };
const ingredients = () => readJson<IngredientDef[]>('content/ingredients.json');
const recipes = () => {
  const out: RecipeDef[] = [];
  for (const f of fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json'))) { const v = readJson<RecipeDef | RecipeDef[]>(path.join('content/recipes', f)); out.push(...(Array.isArray(v) ? v : [v])); }
  return out;
};
/** Ingredients that are bought as a product (or are cupboard staples) and so need a store mapping. */
const wanted = (ing: IngredientDef[]) => ing.filter((i) => i.product || i.cupboard);

if (cmd === 'suggest') {
  const input = opt('input');
  if (!input || !fs.existsSync(input)) { console.error('Give --input <file.json|csv>'); process.exit(1); }
  const text = fs.readFileSync(input, 'utf8');
  const raw: Record<string, unknown>[] = input.toLowerCase().endsWith('.csv') ? parseCsv(text) : (() => { const v = JSON.parse(text); return Array.isArray(v) ? v : v.items ?? v.products ?? v.data ?? []; })();
  const map = opt('map') ? readJson<Record<string, string>>(opt('map')!) : undefined;
  const rows = normaliseRows(raw, { store, source: (opt('source') as SourceKind) ?? 'generic', priceUnit: (opt('price-unit') as 'pounds' | 'pence') ?? 'pounds', map });
  console.log(`${raw.length} lines read, ${rows.length} usable ${STORES[store].name} products (the rest had no id, name or price, or were for another store)`);
  if (!rows.length) { console.error('Nothing usable. Check --source, --price-unit and --map.'); process.exit(1); }
  const ing = wanted(ingredients());
  // Keep rows that share a word with some ingredient, so a 250,000-product file stays workable.
  const vocab = new Set(ing.flatMap((i) => tokens(i.display ?? i.name)));
  const pool = rows.filter((r) => tokens(`${r.name} ${r.brand ?? ''}`).some((t) => vocab.has(t)));
  const prev = fs.existsSync(stateFile) ? readJson<State>(stateFile) : null;
  const suggestions = Object.fromEntries(ing.map((i) => [i.slug, suggest(i, pool, 6)]));
  saveState({ store, source: opt('source') ?? 'generic', createdAt: new Date().toISOString(), rows: pool, suggestions, decisions: prev?.decisions ?? {} });
  const high = Object.values(suggestions).filter((s) => s[0]?.confidence === 'high').length;
  console.log(`${pool.length} candidate products kept · ${ing.length} ingredients · ${high} with a clear best match, ${ing.length - high} to look at by hand`);
  console.log(`Saved ${stateFile}. Next: npm run match -- review --store ${store}`);
}

if (cmd === 'status') {
  const s = loadState(), ing = wanted(ingredients()), need = neededIngredients(recipes());
  const d = s.decisions;
  const count = (st: string) => ing.filter((i) => d[i.slug]?.status === st).length;
  const usedMapped = [...need].filter((k) => d[k]?.status === 'confirmed').length;
  console.log(`${ing.length} ingredients · confirmed ${count('confirmed')} · no equivalent ${count('no_equivalent')} · skipped ${count('skipped')} · undecided ${ing.filter((i) => !d[i.slug]).length}`);
  console.log(`Coverage of what live meals use: ${usedMapped}/${need.size} (${Math.round((usedMapped / Math.max(1, need.size)) * 100)}%). A store needs about 95% before it can go live.`);
  const missing = [...need].filter((k) => d[k]?.status !== 'confirmed');
  if (missing.length) console.log(`Not yet mapped but used by live meals: ${missing.join(', ')}`);
}

if (cmd === 'apply') {
  const s = loadState();
  const priceFile = `content/prices.${store}.json`;
  const prices = fs.existsSync(priceFile) ? readJson<PriceCache>(priceFile) : {};
  const r = applyDecisions(ingredients(), store, s.decisions, prices);
  const issues = validateContent(r.ingredients, recipes()).filter((i) => i.level === 'error');
  console.log(`${r.applied.length} mapped · ${r.removed.length} unmapped · ${r.problems.length} problems · ${issues.length} content errors`);
  r.problems.forEach((p) => console.log('  ! ' + p));
  issues.forEach((i) => console.log(`  ✖ ${i.where}: ${i.message}`));
  if (r.problems.length || issues.length) { console.error('Fix those, then run apply again. Nothing written.'); process.exit(1); }
  if (flag('dry')) { console.log('Dry run: nothing written.'); process.exit(0); }
  fs.writeFileSync('content/ingredients.json', JSON.stringify(r.ingredients, null, 1) + '\n');
  fs.writeFileSync(priceFile, JSON.stringify(r.prices, null, 1) + '\n');
  console.log(`Wrote content/ingredients.json and ${priceFile}. Now: npm run content:import (then check the totals), and set \`live\` in src/lib/stores.ts only when coverage is about 95%.`);
}

if (cmd === 'review') {
  const port = Number(opt('port') ?? 4177);
  const state = loadState();
  const ing = wanted(ingredients());
  const need = neededIngredients(recipes());
  const usedBy = new Map<string, number>();
  for (const r of recipes()) if (r.status === 'live') for (const k of [...r.ingredients.map((l) => l.ingredient), ...r.cupboard]) usedBy.set(k, (usedBy.get(k) ?? 0) + 1);
  const view = () => ing.map((i) => ({
    slug: i.slug, display: i.display ?? i.name, category: i.category ?? (i.cupboard ? 'Cupboard' : 'Other'), unit: i.unit, needed: need.has(i.slug), usedBy: usedBy.get(i.slug) ?? 0,
    ours: i.product ? { name: i.product.name, pack: i.product.pack_size, pence: i.product.price_pence } : null,
    suggestions: state.suggestions[i.slug] ?? [], decision: state.decisions[i.slug] ?? null,
  }));
  const body = (req: http.IncomingMessage) => new Promise<string>((res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => res(b)); });
  const send = (res: http.ServerResponse, code: number, data: unknown, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof data === 'string' ? data : JSON.stringify(data)); };
  http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
      if (req.method === 'GET' && req.url === '/api/state') return send(res, 200, { store: STORES[store].name, source: state.source, items: view() });
      if (req.method === 'POST' && req.url === '/api/search') {
        const { slug, q } = JSON.parse(await body(req)) as { slug: string; q: string };
        const i = ing.find((x) => x.slug === slug); const want = new Set(tokens(q));
        if (!i || !want.size) return send(res, 200, []);
        const hits = state.rows.filter((r) => { const t = new Set(tokens(`${r.name} ${r.brand ?? ''}`)); return [...want].every((w) => t.has(w)); }).map((r) => scoreRow(i, r)).sort((a, b) => b.score - a.score).slice(0, 15);
        return send(res, 200, hits);
      }
      if (req.method === 'POST' && req.url === '/api/decide') {
        const { slug, status, row, note } = JSON.parse(await body(req)) as { slug: string; status: Decision['status'] | 'clear'; row?: SourceRow; note?: string };
        if (!ing.some((x) => x.slug === slug)) return send(res, 400, { error: 'unknown ingredient' });
        if (status === 'clear') delete state.decisions[slug]; else state.decisions[slug] = { status, ...(row ? { row } : {}), ...(note ? { note } : {}), decidedAt: new Date().toISOString() };
        saveState(state);
        return send(res, 200, { ok: true, decided: Object.keys(state.decisions).length });
      }
      send(res, 404, { error: 'not found' });
    } catch (e) { send(res, 500, { error: (e as Error).message }); }
  }).listen(port, '127.0.0.1', () => console.log(`Review page: http://127.0.0.1:${port}  (Ctrl-C to stop; decisions save as you go)`));
}

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Match products</title>
<style>
body{font:15px/1.4 -apple-system,system-ui,sans-serif;margin:0;background:#f2f2f6;color:#141414}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:10px 16px;z-index:2;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:17px;margin:0}.bar{flex:1;min-width:140px;height:8px;background:#e4e4e8;border-radius:9px;overflow:hidden}.bar i{display:block;height:100%;background:#2e9a62}
main{max-width:860px;margin:0 auto;padding:12px 16px 80px}button{font:inherit;border:0;border-radius:8px;padding:7px 12px;background:#e8e8ec;cursor:pointer}button.p{background:#141414;color:#fff}button:hover{filter:brightness(.95)}
.tabs button.on{background:#141414;color:#fff}.card{background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 2px #0001}.card.done{opacity:.8}
.head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.head b{font-size:16px}.ours{color:#666;font-size:13px}.tag{font-size:12px;padding:1px 7px;border-radius:99px;background:#eee;margin-left:6px}.tag.need{background:#ffe9b0}
.cand{display:grid;grid-template-columns:1fr auto;gap:4px 12px;border-top:1px solid #eee;padding:8px 0}.cand .n{font-weight:600}.why{font-size:12px;color:#2a7;}.warn{font-size:12px;color:#b5501b}
.conf{font-size:11px;font-weight:700;padding:1px 6px;border-radius:5px;margin-right:6px}.conf.high{background:#d6f5e3;color:#176b3e}.conf.medium{background:#fff1c9;color:#8a6200}.conf.low{background:#fde0d8;color:#a0391c}
input[type=search]{font:inherit;padding:7px 10px;border:1px solid #ccc;border-radius:8px;width:60%}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center}.muted{color:#777;font-size:13px}
</style>
<header><h1 id=title>Match products</h1><div class=bar><i id=prog style="width:0"></i></div><span id=count class=muted></span>
<span class=tabs><button data-t=todo class=on>To do</button> <button data-t=done>Decided</button> <button data-t=all>All</button></span>
<button id=hi title="Confirm every ingredient whose best match is high-confidence with no warnings">Accept clear matches</button></header>
<main id=list></main>
<script>
let S=null,tab='todo';const gbp=p=>'£'+(p/100).toFixed(2);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load(){S=await (await fetch('/api/state')).json();document.getElementById('title').textContent='Match '+S.store+' products';render()}
async function decide(slug,status,row,note){await fetch('/api/decide',{method:'POST',body:JSON.stringify({slug,status,row,note})});const it=S.items.find(x=>x.slug===slug);it.decision=status==='clear'?null:{status,row,note};render(true)}
function cand(it,s,k,ctx){const r=s.row;return '<div class=cand><div><span class="conf '+s.confidence+'">'+s.score+'</span><span class=n>'+esc(r.name)+'</span> <span class=muted>'+esc(r.packSize||'')+' · '+gbp(r.price)+(r.inStock===false?' · out of stock':'')+'</span>'
+'<div class=why>'+s.reasons.map(esc).join(' · ')+'</div><div class=warn>'+s.warnings.map(esc).join(' · ')+'</div></div><div><button class=p data-use="'+ctx+':'+k+'">Use this</button></div></div>'}
function render(keep){const y=scrollY;const items=S.items;const decided=items.filter(i=>i.decision).length;document.getElementById('prog').style.width=(100*decided/items.length)+'%';document.getElementById('count').textContent=decided+' of '+items.length+' decided';
const shown=items.filter(i=>tab==='all'||(tab==='done')===!!i.decision);let cat='';const el=document.getElementById('list');el.innerHTML=shown.map(it=>{const d=it.decision;let h='';if(it.category!==cat){cat=it.category;h+='<h3>'+esc(cat)+'</h3>'}
h+='<div class="card'+(d?' done':'')+'" id="c-'+it.slug+'"><div class=head><div><b>'+esc(it.display)+'</b><span class="tag'+(it.needed?' need':'')+'">'+(it.needed?'used by '+it.usedBy+' meals':'not used by live meals')+'</span><div class=ours>Morrisons: '+(it.ours?esc(it.ours.name)+' · '+it.ours.pack+' '+it.unit+' · '+gbp(it.ours.pence):'cupboard item, no product')+'</div></div></div>';
if(d){h+='<div class=row>'+(d.status==='confirmed'?'<span>✓ <b>'+esc(d.row.name)+'</b> <span class=muted>'+esc(d.row.packSize||'')+' · '+gbp(d.row.price)+' · id '+esc(d.row.productId)+'</span></span>':d.status==='no_equivalent'?'<span>✗ No equivalent</span>':'<span>– Skipped</span>')+'<button data-clear="'+it.slug+'">Change</button></div>'}
else{h+=it.suggestions.map((s,k)=>cand(it,s,k,it.slug)).join('')+'<div class=row><input type=search placeholder="Search other products (e.g. mince)" data-q="'+it.slug+'"><button data-search="'+it.slug+'">Search</button><button data-none="'+it.slug+'">No equivalent</button><button data-skip="'+it.slug+'">Skip</button></div><div id="r-'+it.slug+'"></div>'}
return h+'</div>'}).join('')||'<p class=muted>Nothing here.</p>';if(keep)scrollTo(0,y)}
document.addEventListener('click',async e=>{const t=e.target;if(!(t instanceof HTMLElement))return;
if(t.dataset.t){tab=t.dataset.t;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b===t));render()}
if(t.dataset.use){const [slug,k]=t.dataset.use.split(':');const it=S.items.find(x=>x.slug===slug);const s=(it._found&&k.startsWith('f')?it._found[+k.slice(1)]:it.suggestions[+k]);decide(slug,'confirmed',s.row)}
if(t.dataset.none)decide(t.dataset.none,'no_equivalent');if(t.dataset.skip)decide(t.dataset.skip,'skipped');if(t.dataset.clear)decide(t.dataset.clear,'clear');
if(t.dataset.search){const slug=t.dataset.search;const q=document.querySelector('[data-q="'+slug+'"]').value;const hits=await (await fetch('/api/search',{method:'POST',body:JSON.stringify({slug,q})})).json();const it=S.items.find(x=>x.slug===slug);it._found=hits;document.getElementById('r-'+slug).innerHTML=hits.length?hits.map((s,k)=>cand(it,s,k,slug).replace('data-use="'+slug+':'+k+'"','data-use="'+slug+':f'+k+'"')).join(''):'<p class=muted>No products with all those words.</p>'}});
document.getElementById('hi').onclick=async()=>{const ok=S.items.filter(i=>!i.decision&&i.suggestions[0]&&i.suggestions[0].confidence==='high'&&!i.suggestions[0].warnings.length);if(!ok.length)return alert('No clear matches without warnings.');if(!confirm('Confirm '+ok.length+' clear matches? You can still change any of them.'))return;for(const i of ok)await decide(i.slug,'confirmed',i.suggestions[0].row)};
load();
</script>`;
