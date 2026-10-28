import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('trolley script', () => {
  it('is published at /app/morrisons.js exactly as the extension and the app bundle it (run `node scripts/sync-morrisons.mjs`)', () => {
    expect(readFileSync('public/app/morrisons.js', 'utf8')).toBe(readFileSync('extension/morrisons.js', 'utf8'));
  });
});
