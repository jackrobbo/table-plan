import fs from 'node:fs';
import path from 'node:path';

// Method outlines and source calories live in one main file plus any number of fragment files in a folder next to it
// (tests/fixtures/outlines/*.json, tests/fixtures/source-nutrition/*.json), so several people or agents can add recipes
// without editing the same file. Fragments are merged over the main file.
const root = path.resolve(__dirname, '..', '..');
function merged<T>(main: string, dir: string): Record<string, T> {
  const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, T>;
  const out: Record<string, T> = fs.existsSync(path.join(root, main)) ? read(path.join(root, main)) : {};
  const d = path.join(root, dir);
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) Object.assign(out, read(path.join(d, f)));
  delete (out as Record<string, unknown>)._about;
  return out;
}
export interface OutlineStep { do: string[]; temp?: number; mins?: [number, number]; deviation?: string }
export const loadOutlines = () => merged<{ source: string; steps: OutlineStep[] }>('tests/fixtures/method-outlines.json', 'tests/fixtures/outlines');
export const loadSourceNutrition = () => merged<{ kcal: number; source: string; tolerance: number; note?: string }>('tests/fixtures/source-nutrition.json', 'tests/fixtures/source-nutrition');
