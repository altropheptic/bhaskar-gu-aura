// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://dawai.test/caregiver?t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}
/**
 * The read-only family page: it reads the link token, removes it from the
 * address bar, loads today's summary from /api/caregiver and shows what was
 * taken or missed.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let requestedUrl = '';

beforeAll(async () => {
  document.body.innerHTML = readFileSync(resolve(process.cwd(), 'caregiver.html'), 'utf8').match(
    /<body[^>]*>([\s\S]*)<\/body>/,
  )[1];
  const now = new Date();
  const earlier = new Date(now.getTime() - 3 * 3600_000); // 3 hours ago: missed if not logged
  const time = `${String(earlier.getHours()).padStart(2, '0')}:${String(earlier.getMinutes()).padStart(2, '0')}`;
  const fetchMock = vi.fn(async (url) => {
    requestedUrl = String(url);
    return new Response(
      JSON.stringify({
        profile: { name: 'Dadi', language: 'hi' },
        medicines: [
          {
            id: 'm1',
            name: 'Metformin',
            dosage: '500 mg',
            form: 'tablet',
            color: 'white',
            shape: 'round',
            meal: 'after',
            times: [`${time}:00`],
            days: [0, 1, 2, 3, 4, 5, 6],
            dose_qty: 1,
            start_date: '2020-01-01',
            end_date: null,
            active: true,
            stock: 2,
            refill_at: 5,
          },
        ],
        logs: [],
        generated_at: now.toISOString(),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  await import('../js/caregiver.js');
  await wait(50);
});

describe('family page', () => {
  it('asks the API with the token and then hides the token from the address bar', () => {
    expect(requestedUrl).toContain('t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(location.search).toBe('');
    expect(sessionStorage.getItem('dawai-dost-cg')).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it("shows the person's day, a missed-dose note and a refill warning", () => {
    const text = document.getElementById('cg-root').textContent;
    expect(text).toContain("Dadi's medicines today");
    expect(text).toContain('Metformin 500 mg');
    if (new Date().getHours() >= 3) expect(text).toContain('A dose was missed');
    expect(text).toContain('Metformin is running low');
  });
});
