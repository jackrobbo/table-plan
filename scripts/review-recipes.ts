// npm run review:recipes [-- --port 4178] [-- --status draft]
// A local page to read each draft recipe and mark it Keep / Change / Drop with a note. Nothing leaves this machine.
// Decisions are saved to content/reviews/recipes.json (gitignored). It never edits recipes or sets anything live;
// tell Claude "apply my review" and it will act on the decisions.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { budgetTier, computePerPortion, costPerPortion, resolvePerPortion } from '../src/lib/content/macros';
import { deriveAllergens, verifyRecipe } from '../src/lib/content/validate';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 4178);
const wantStatus = opt('status') ?? 'draft';
const file = 'content/reviews/recipes.json';

const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const loadRecipes = () => fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(`content/recipes/${f}`, 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
}).filter((r) => r.status === wantStatus && !r.macros_only);

type Decision = { decision: 'keep' | 'change' | 'drop' | ''; note: string; at?: string };
const readDecisions = (): Record<string, Decision> => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
const qtyText = (d: IngredientDef | undefined, q: number) => !d ? String(q) : d.unit === 'g' ? `${q}g` : d.unit === 'ml' ? `${q}ml` : `${q} × ${d.unit}`;

/** Cost of buying whole packs of the fresh items for n portions (cupboard items excluded), in pounds. */
function shopCost(r: RecipeDef, n: number): number | null {
  let t = 0;
  for (const l of r.ingredients) {
    const d = ing.get(l.ingredient);
    if (!d?.product) return null;
    t += Math.ceil(Math.round((l.qty * n) / (r.serves || 1) * 100) / 100 / d.product.pack_size) * d.product.price_pence;
  }
  return t / 100;
}

function payload() {
  const decisions = readDecisions();
  return loadRecipes().sort((a, b) => a.slug.localeCompare(b.slug)).map((r) => {
    const m = resolvePerPortion(r, ing), c = computePerPortion(r, ing), cost = costPerPortion(r, ing), v = verifyRecipe(r, ing);
    return {
      slug: r.slug, name: r.name, emoji: r.emoji, course: r.course, serves: r.serves, time: r.time, source: r.source,
      kcal: m.kcal, protein: m.protein_g, carbs: m.carbs_g, fat: m.fat_g, missing: c.missing,
      cost: cost == null ? null : cost / 100, tier: cost == null ? null : budgetTier(cost, r.course),
      verified: v.verified, reason: v.reason, allergens: deriveAllergens(r, ing),
      ingredients: r.ingredients.map((l) => ({ name: ing.get(l.ingredient)?.display ?? ing.get(l.ingredient)?.name ?? l.ingredient, qty: qtyText(ing.get(l.ingredient), l.qty) })),
      cupboard: (r.cupboard ?? []).map((k) => ({ name: ing.get(k)?.display ?? ing.get(k)?.name ?? k, qty: r.cupboard_qty?.[k] != null ? qtyText(ing.get(k), r.cupboard_qty[k]) : '' })),
      lines: [
        ...r.ingredients.map((l) => ({ name: ing.get(l.ingredient)?.display ?? ing.get(l.ingredient)?.name ?? l.ingredient, qty: l.qty, unit: ing.get(l.ingredient)?.unit ?? '', cupboard: false })),
        ...(r.cupboard ?? []).filter((k) => r.cupboard_qty?.[k] != null).map((k) => ({ name: ing.get(k)?.display ?? ing.get(k)?.name ?? k, qty: r.cupboard_qty![k], unit: ing.get(k)?.unit ?? '', cupboard: true })),
      ],
      shop: [1, 2, 3, 4, 5, 6].map((n) => shopCost(r, n)),
      method: r.method, decision: decisions[r.slug] ?? { decision: '', note: '' },
    };
  });
}

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Recipe review</title>
<style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1f2420;--mute:#6b726c;--line:#e3e0d8;--keep:#2f7d4f;--chg:#b7791f;--drop:#b83a3a}
@media(prefers-color-scheme:dark){:root{--bg:#161a17;--card:#1f2521;--ink:#eceee9;--mute:#9aa39b;--line:#2d352f}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink);display:flex;min-height:100vh}
nav{width:290px;border-right:1px solid var(--line);padding:12px;overflow:auto;height:100vh;position:sticky;top:0}
nav button{display:flex;gap:8px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:7px 8px;border-radius:8px;cursor:pointer;font:inherit}
nav button:hover,nav button.on{background:var(--card)}.dot{width:10px;height:10px;border-radius:50%;margin-top:6px;border:1px solid var(--mute);flex:none}
.dot.keep{background:var(--keep);border-color:var(--keep)}.dot.change{background:var(--chg);border-color:var(--chg)}.dot.drop{background:var(--drop);border-color:var(--drop)}
main{flex:1;max-width:820px;padding:20px 24px 60px}h1{margin:0 0 4px;font-size:26px}.mute{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0}
.stats{display:flex;flex-wrap:wrap;gap:8px 18px}.stats b{font-size:19px}.warn{color:var(--drop)}
ul,ol{padding-left:20px;margin:6px 0}li{margin:3px 0}.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.act{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}.act button{padding:10px 18px;border-radius:10px;border:2px solid var(--line);background:var(--card);color:var(--ink);font:600 15px system-ui;cursor:pointer}
.act .keep.on{background:var(--keep);color:#fff;border-color:var(--keep)}.act .change.on{background:var(--chg);color:#fff;border-color:var(--chg)}.act .drop.on{background:var(--drop);color:#fff;border-color:var(--drop)}
textarea{width:100%;min-height:70px;margin-top:10px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:inherit;font:inherit}
.pn{display:flex;justify-content:space-between;margin-top:12px}.pn button{padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:inherit;cursor:pointer}
@media(max-width:760px){body{display:block}nav{width:auto;height:auto;position:static;border:0}.cols{grid-template-columns:1fr}}
</style><nav id=nav></nav><main id=main></main>
<script>
let R=[],i=0,N=null;const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function load(){R=await (await fetch('/data')).json();const h=+location.hash.slice(1);if(h>=0&&h<R.length)i=h;draw()}
function counts(){const c={keep:0,change:0,drop:0,'':0};R.forEach(r=>c[r.decision.decision]++);return c}
function draw(){const c=counts();
 $('#nav').innerHTML='<div class=mute style="padding:4px 8px 10px">'+R.length+' drafts · '+c.keep+' keep · '+c.change+' change · '+c.drop+' drop · '+c['']+' to do</div>'+R.map((r,k)=>'<button class="'+(k==i?'on':'')+'" onclick="go('+k+')"><span class="dot '+r.decision.decision+'"></span><span>'+r.emoji+' '+esc(r.name)+'</span></button>').join('');
 const r=R[i];if(!r)return;const t=r.time;
 $('#main').innerHTML='<div class=mute>'+(i+1)+' of '+R.length+' · '+esc(r.course)+' · '+esc(r.source||'')+'</div><h1>'+r.emoji+' '+esc(r.name)+'</h1>'
 +'<div class=card><div class=stats><span><b>'+r.kcal+'</b> kcal</span><span><b>'+r.protein+'g</b> protein</span><span><b>'+(r.carbs??'?')+'g</b> carbs</span><span><b>'+(r.fat??'?')+'g</b> fat</span><span><b>'+(r.cost==null?'n/a':'£'+r.cost.toFixed(2))+'</b> per portion'+(r.tier?' ('+r.tier+')':'')+'</span></div>'
 +'<div class=mute style="margin-top:6px">Serves '+r.serves+' · prep '+t.prep+' min · cook '+t.cook+' min · allergens: '+(r.allergens.join(', ')||'none')+'</div>'
 +(r.verified?'':'<div class=warn style="margin-top:6px">Nutrition not fully verified: '+esc(r.reason)+'</div>')+'</div>'
 +scaled(r)
 +'<div class=card><b>Method</b><ol>'+r.method.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></div>'
 +'<div class=card><b>Your verdict</b><div class=act>'+['keep','change','drop'].map(d=>'<button class="'+d+(r.decision.decision==d?' on':'')+'" onclick="set(\\''+d+'\\')">'+d[0].toUpperCase()+d.slice(1)+'</button>').join('')+'</div>'
 +'<textarea id=note placeholder="What would you change? (saved when you click away)" onblur="save()">'+esc(r.decision.note)+'</textarea></div>'
 +'<div class=pn><button onclick="go(i-1)">← Previous</button><button onclick="go(i+1)">Next →</button></div>'}
const FRAC={0.25:'¼',0.5:'½',0.75:'¾'};
function fmt(l,q){const u=l.unit;if(u=='g'||u=='ml')return (q>=10?Math.round(q):Math.round(q*10)/10)+u;const w=Math.floor(q+0.001),f=Math.round((q-w)*4)/4;if(Math.abs(q-(w+f))<0.04&&FRAC[f]!==undefined||f==0&&Math.abs(q-w)<0.04)return (w?w:'')+(FRAC[f]||'')+' × '+u;return (Math.round(q*100)/100)+' × '+u}
const WHOLE=['eggs','sausages','wraps','pittas','bagels','bananas','apples','medallions','naans','slices','pots','bars','bags','cheeses','wafers'];
function awkward(l,q){if(!WHOLE.includes(l.unit))return false;return Math.abs(q-Math.round(q))>0.08||q<0.9}
function scaled(r){const n=N||r.serves;let bad=0;
 const row=l=>{const q=l.qty*n/r.serves,a=awkward(l,q);if(a)bad++;return '<li'+(a?' class=warn':'')+'>'+fmt(l,q)+' '+esc(l.name)+(a?' ⚠':'')+'</li>'};
 const f=r.lines.filter(l=>!l.cupboard).map(row).join(''),c=r.lines.filter(l=>l.cupboard).map(row).join('');
 const sh=r.shop[n-1];
 return '<div class=card><b>Servings</b> <span class=act style="display:inline-flex;margin:0 0 0 8px">'+[1,2,3,4,5,6].map(k=>'<button class="'+(k==n?'keep on':'')+'" style="padding:5px 12px" onclick="N='+k+';draw()">'+k+'</button>').join('')+'</span>'
 +'<div class=mute style="margin-top:6px">Written for '+r.serves+'. Showing quantities for '+n+(n==1?' person':' people')+'. Buying whole packs of the fresh items for '+n+': '+(sh==null?'n/a':'£'+sh.toFixed(2))+(sh==null?'':' (£'+(sh/n).toFixed(2)+' each)')+(bad?' · <span class=warn>'+bad+' item(s) are part of a whole egg, sausage or wrap (⚠)</span>':'')+'</div>'
 +'<div class=cols style="margin-top:8px"><div><b>Ingredients</b><ul>'+f+'</ul></div><div><b>Cupboard</b><ul>'+c+'</ul></div></div></div>'}
function go(k){if(k<0||k>=R.length)return;i=k;N=null;location.hash=k;draw();scrollTo(0,0)}
async function post(){const r=R[i];await fetch('/decision',{method:'POST',body:JSON.stringify({slug:r.slug,...r.decision})})}
async function set(d){const r=R[i];r.decision.decision=r.decision.decision==d?'':d;r.decision.note=($('#note')||{}).value??r.decision.note;await post();draw()}
async function save(){const r=R[i],n=$('#note').value;if(n===r.decision.note)return;r.decision.note=n;await post();draw()}
document.addEventListener('keydown',e=>{if(e.target.tagName=='TEXTAREA')return;if(e.key=='ArrowRight')go(i+1);if(e.key=='ArrowLeft')go(i-1)});
load();
</script>`;

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/data') { res.setHeader('content-type', 'application/json'); return void res.end(JSON.stringify(payload())); }
  if (req.method === 'POST' && req.url === '/decision') {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      try {
        const { slug, decision, note } = JSON.parse(b) as { slug: string; decision: Decision['decision']; note: string };
        const all = readDecisions();
        all[slug] = { decision, note: note ?? '', at: new Date().toISOString() };
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(all, null, 1) + '\n');
        res.end('ok');
      } catch { res.statusCode = 400; res.end('bad'); }
    });
    return;
  }
  res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(PAGE);
}).listen(port, '127.0.0.1', () => console.log(`Recipe review: http://localhost:${port}  (${loadRecipes().length} ${wantStatus} recipes; decisions saved to ${file})`));
