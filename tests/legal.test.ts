import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANS, gbp } from '@/lib/billing/config';
import { CONTACT_EMAIL } from '@/lib/legal/config';

const page = (p: string) => readFileSync(`src/app/${p}/page.tsx`, 'utf8');

describe('legal pages say what the product does', () => {
  const privacy = page('privacy'), terms = page('terms');

  it('privacy names every processor, the rights, and where to complain', () => {
    for (const w of ['Supabase', 'Vercel', 'Stripe', 'Information Commissioner', 'Download my data', 'Delete my account', 'withdraw']) expect(privacy, w).toContain(w);
    expect(privacy).toContain('CONTACT_EMAIL');
    expect(CONTACT_EMAIL).toMatch(/@/);
  });
  it('privacy only promises what we built: no analytics without consent, nothing sent to retailers', () => {
    expect(privacy).toMatch(/Analytics are off unless you opt in/);
    expect(privacy).toMatch(/doesn&apos;t send your list or anything else to us/);
  });
  it('terms take prices and the trial length from the plan config, not typed-in numbers', () => {
    expect(terms).toContain('gbp(y.pence)');
    expect(terms).toContain('y.trialDays');
    expect(gbp(PLANS.yearly.pence)).toMatch(/^£\d/);
    expect(terms).not.toMatch(/£\d/);
  });
  it('terms carry the safety statements the product depends on', () => {
    for (const w of ['not medical or dietetic advice', 'read the label', 'may contain', '18', '1,300 kcal', 'cancel at any time']) expect(terms.toLowerCase(), w).toContain(w.toLowerCase());
  });
});
