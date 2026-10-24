// npm run beta:invites -- 50   → writes .private/invites-<date>.{csv,sql} (gitignored). Never commit codes.
import fs from 'node:fs';
import { generateCodes, normaliseCode } from '../src/lib/beta/invites';

const n = Number(process.argv[2] ?? 25);
if (!Number.isInteger(n) || n < 1 || n > 1000) { console.error('Usage: npm run beta:invites -- <1-1000>'); process.exit(1); }
const codes = generateCodes(n);
fs.mkdirSync('.private', { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
fs.writeFileSync(`.private/invites-${stamp}.csv`, 'code\n' + codes.join('\n') + '\n');
fs.writeFileSync(`.private/invites-${stamp}.sql`,
  'insert into public.invites (code) values\n' + codes.map((c) => `  ('${normaliseCode(c)}')`).join(',\n') + '\non conflict do nothing;\n');
console.log(`${n} codes → .private/invites-${stamp}.csv (send these) and .sql (run in Supabase)`);
