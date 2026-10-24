import { describe, expect, it } from 'vitest';
import { shapeReport } from '@/lib/errorReport';

describe('error reports', () => {
  it('keeps where and what, and drops everything else', () => {
    const r = shapeReport({ kind: 'rejection', message: 'Cannot read x', stack: 'at f (app.js:1:2)', page: '/plan?token=abc#hash', build: 'abc123', userId: 'u1', email: 'a@b.co', extra: { deep: 1 } });
    expect(r).toEqual({ kind: 'rejection', message: 'Cannot read x', stack: 'at f (app.js:1:2)', page: '/plan', build: 'abc123' });
  });
  it('blanks emails and long tokens that sneak into messages', () => {
    const r = shapeReport({ message: 'bad email jo@example.com token ' + 'a'.repeat(40) })!;
    expect(r.message).toBe('bad email [email] token [token]');
  });
  it('bounds the size, and ignores junk', () => {
    expect(shapeReport({ message: 'word '.repeat(1000), stack: 'y'.repeat(5000) })!.message).toHaveLength(300);
    expect(shapeReport({ message: 'x', stack: 'line '.repeat(1000) })!.stack).toHaveLength(1200);
    for (const bad of [null, 'text', 42, {}, { message: '' }, { message: 5 }]) expect(shapeReport(bad)).toBeNull();
    expect(shapeReport({ kind: 'weird', message: 'm' })!.kind).toBe('error');
  });
});
