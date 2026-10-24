// npm run probe -- <slug> [<slug>...]  → name / size / price / availability / label nutrition from each Morrisons product page (2s apart)
import { parseProductPage } from '../src/lib/pricing/parse';
import { parseNutritionTable } from '../src/lib/pricing/nutrition';

const BASE = 'https://groceries.morrisons.com/products/';
const UA = 'TablePlanPriceCheck/0.1 (+https://table-plan-app.vercel.app)';
async function main() {
  for (const slug of process.argv.slice(2)) {
    try {
      const r = await fetch(BASE + slug, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      const html = r.status === 200 ? await r.text() : '';
      const size = html.match(/"size"\s*:\s*"([^"]+)"/)?.[1] ?? '';
      const p = parseProductPage(html);
      console.log(JSON.stringify({ slug, http: r.status, name: p?.name, size, pence: p?.pricePence, stock: p?.availability, nutrition: parseNutritionTable(html) ?? undefined }));
    } catch (e) { console.log(JSON.stringify({ slug, error: (e as Error).message })); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
main();
