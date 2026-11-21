/**
 * Spoken reminder template (shared by the browser and /api/tts) and the sample
 * family every new account starts with.
 */
import { describe, it, expect } from 'vitest';
import { reminderText } from '../js/voiceText.js';
import { buildDemoData } from '../js/demoData.js';
import { validateMedicine } from '../js/medSchema.js';

describe('reminderText', () => {
  it('builds an English sentence with the place cue', () => {
    const text = reminderText({ lang: 'en', person: 'Dadi', medicines: [{ name: 'Metformin', qty: 1, form: 'tablet', meal: 'after', place: 'the steel dabba' }] });
    expect(text).toBe('Dadi, it is time for your medicine. 1 tablet of Metformin, after food. It is kept at the steel dabba.');
  });

  it('speaks Hindi and says "half" for half tablets', () => {
    const text = reminderText({ lang: 'hi', person: 'दादी', medicines: [{ name: 'Thyronorm', qty: 0.5, form: 'tablet', meal: 'before' }] });
    expect(text).toContain('दवाई का समय हो गया है');
    expect(text).toContain('आधी गोली');
    expect(text).toContain('खाने से पहले');
  });

  it('falls back to English for an unknown language', () => {
    expect(reminderText({ lang: 'xx', person: '', medicines: [{ name: 'A', qty: 2, form: 'capsule', meal: 'any' }] })).toBe('it is time for your medicine. 2 capsules of A.');
  });
});

describe('buildDemoData (sample family)', () => {
  const now = new Date(2026, 10, 21, 12, 0);
  const data = buildDemoData(now);

  it('has four people and every medicine passes the same validation as the form', () => {
    expect(data.profiles.map((p) => p.name)).toEqual(['Dadi', 'Nanaji', 'Papa', 'Maa']);
    expect(data.medicines).toHaveLength(18);
    for (const med of data.medicines) expect(validateMedicine(med), med.name).toEqual([]);
  });

  it('history never logs a future dose or the same dose twice', () => {
    const ids = new Set(data.medicines.map((m) => m.id));
    const keys = new Set();
    for (const log of data.logs) {
      expect(ids.has(log.medicine_id)).toBe(true);
      expect(new Date(log.scheduled_for).getTime()).toBeLessThanOrEqual(now.getTime());
      const key = `${log.medicine_id}|${log.scheduled_for}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(data.logs.length).toBeGreaterThan(300);
  });

  it('is deterministic apart from ids', () => {
    const again = buildDemoData(now);
    expect(again.logs.map((l) => l.status)).toEqual(data.logs.map((l) => l.status));
  });
});
