/**
 * /api guards: bad input, missing session, unknown caregiver links and rate
 * limits are all rejected before any paid AI/voice call or database query.
 */
import { describe, it, expect } from 'vitest';
import { POST as ai } from '../api/ai.js';
import { POST as tts } from '../api/tts.js';
import { GET as caregiver } from '../api/caregiver.js';
import { readJson, rateLimited } from '../api/_lib.js';

let ip = 0;
/** Each request gets its own fake IP so the per-IP rate limit doesn't interfere. */
const req = (url, { body, headers = {}, method = 'POST' } = {}) => new Request(`https://test.local${url}`, {
  method,
  headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${(ip += 1)}`, ...headers },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});

describe('readJson', () => {
  it('rejects wrong content type, oversized and non-object bodies', async () => {
    expect(await readJson(req('/x', { body: '{}', headers: { 'content-type': 'text/plain' } }), 100)).toBeNull();
    expect(await readJson(req('/x', { body: { a: 'x'.repeat(200) } }), 100)).toBeNull();
    expect(await readJson(req('/x', { body: '[1,2]' }), 100)).toBeNull();
    expect(await readJson(req('/x', { body: 'not json' }), 100)).toBeNull();
    expect(await readJson(req('/x', { body: { a: 1 } }), 100)).toEqual({ a: 1 });
  });
});

describe('rateLimited', () => {
  it('allows up to the limit per minute, then blocks', () => {
    const r = () => new Request('https://test.local/x', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    const results = Array.from({ length: 4 }, () => rateLimited(r(), 'unit-test', 3));
    expect(results).toEqual([false, false, false, true]);
  });
});

describe('/api/ai', () => {
  it('rejects a malformed body with 400', async () => {
    expect((await ai(req('/api/ai', { body: 'nope' }))).status).toBe(400);
  });

  it('rejects a request without a session with 401 and a generic message', async () => {
    const res = await ai(req('/api/ai', { body: { action: 'parseText', text: 'Metformin 1-0-1' } }));
    expect(res.status).toBe(401);
    expect(Object.keys(await res.json())).toEqual(['error']);
  });
});

describe('/api/tts', () => {
  it('rejects invalid input before checking the session', async () => {
    expect((await tts(req('/api/tts', { body: { lang: 'fr' } }))).status).toBe(400);
  });
});

describe('/api/caregiver', () => {
  it('answers 404 for a malformed token without touching the database', async () => {
    const res = await caregiver(req('/api/caregiver?token=short', { method: 'GET' }));
    expect(res.status).toBe(404);
  });
});
