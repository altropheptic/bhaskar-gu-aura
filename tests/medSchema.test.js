/**
 * Input validation and AI-output sanitising: the browser-side half of
 * "validate in the browser and again on the server".
 */
import { describe, it, expect } from 'vitest';
import { cleanText, cleanTime, sanitizeAiMedicine, validateMedicine } from '../js/medSchema.js';

const valid = {
  name: 'Amlodipine', generic_name: 'Amlodipine', dosage: '5 mg', form: 'tablet', color: 'pink', shape: 'oval',
  meal: 'any', times: ['08:00'], slots: ['breakfast'], days: [0, 1, 2, 3, 4, 5, 6], dose_qty: 1, stock: 30,
  refill_at: 5, start_date: '2026-11-21', end_date: null, notes: '', kept_at: 'Steel dabba', doctor: 'Dr. Baruah', photo: null,
};

describe('cleanText / cleanTime', () => {
  it('strips control characters and enforces length', () => {
    expect(cleanText('  Dolo\u0000 650  ', 80)).toBe('Dolo  650');
    expect(cleanText('abcdef', 3)).toBe('abc');
    expect(cleanText(42, 10)).toBe('');
  });

  it('normalises times and rejects impossible ones', () => {
    expect(cleanTime('8:00')).toBe('08:00');
    expect(cleanTime('20:45:00')).toBe('20:45');
    expect(cleanTime('25:00')).toBeNull();
    expect(cleanTime('soon')).toBeNull();
  });
});

describe('sanitizeAiMedicine', () => {
  it('keeps only known fields and allowed values', () => {
    const out = sanitizeAiMedicine({
      name: 'Glycomet', form: 'potion', meal: 'after', times: ['21:00', '8:00', '8:00', 'bad'], dose_qty: 99,
      slots: ['breakfast', 'teatime'], color: 'white', shape: 'hexagon', doctor: 'Dr. S. Bora', evil: '<script>',
    });
    expect(out).toMatchObject({ name: 'Glycomet', form: 'tablet', meal: 'after', times: ['08:00', '21:00'], dose_qty: 1, slots: ['breakfast'], color: 'white' });
    expect(out.shape).toBeUndefined();
    expect(out.evil).toBeUndefined();
  });

  it('rejects output without a name', () => {
    expect(sanitizeAiMedicine({ dosage: '5 mg' })).toBeNull();
    expect(sanitizeAiMedicine('nope')).toBeNull();
  });
});

describe('validateMedicine', () => {
  it('accepts a complete medicine', () => {
    expect(validateMedicine(valid)).toEqual([]);
  });

  it('explains each problem in plain words', () => {
    const errors = validateMedicine({ ...valid, name: '', times: ['08:00', '08:00'], slots: ['breakfast', 'breakfast'], end_date: '2026-01-01', dose_qty: 0 });
    expect(errors).toContain('Enter the medicine name (up to 80 letters).');
    expect(errors).toContain('The same time is listed twice.');
    expect(errors).toContain('End date is before the start date.');
    expect(errors).toContain('Dose must be between ½ and 20.');
  });

  it('allows small data-URL photos and bundled sample photos only', () => {
    expect(validateMedicine({ ...valid, photo: '/demo/metformin.jpg' })).toEqual([]);
    expect(validateMedicine({ ...valid, photo: 'data:image/jpeg;base64,AAAA' })).toEqual([]);
    expect(validateMedicine({ ...valid, photo: 'https://evil.example/x.jpg' })).toHaveLength(1);
    expect(validateMedicine({ ...valid, photo: '/demo/../secret.jpg' })).toHaveLength(1);
  });
});
