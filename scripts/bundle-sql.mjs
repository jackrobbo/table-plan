// node scripts/bundle-sql.mjs — one file to paste into the Supabase SQL editor: migrations in order, then the seed.
import fs from 'node:fs';
const files = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort().map((f) => `supabase/migrations/${f}`);
const out = ['-- Table Plan: full database setup. Run once on a new, empty Supabase project.', ...files.concat('supabase/seed.sql').flatMap((f) => [`\n-- ===== ${f} =====`, fs.readFileSync(f, 'utf8')])].join('\n');
fs.writeFileSync('supabase/setup.sql', out);
console.log(files.length + 1, 'files →', 'supabase/setup.sql', (out.length / 1024).toFixed(0) + ' KB');
