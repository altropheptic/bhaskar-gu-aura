/**
 * The offline "1-0-1" prescription reader (also the fallback when AI is down).
 */
import { describe, it, expect } from 'vitest';
import { parsePrescription } from '../js/quickEntry.js';

const today = new Date(2026, 10, 21);

describe('parsePrescription', () => {
  it('reads the Indian 1-0-1 notation, strength, food timing and duration', () => {
    const { fields } = parsePrescription('Metformin 500mg 1-0-1 after food 30 days', today);
    expect(fields).toMatchObject({
      name: 'Metformin', dosage: '500 mg', slots: ['breakfast', 'dinner'], dose_qty: 1, meal: 'after', end_date: '2026-12-20',
    });
  });

  it('understands Latin shorthand like BD and HS', () => {
    expect(parsePrescription('Telma 40 mg BD', today).fields.slots).toEqual(['breakfast', 'dinner']);
    expect(parsePrescription('Cremaffin syrup 10 ml HS', today).fields).toMatchObject({ slots: ['bed'], form: 'syrup', dose_qty: 10, shape: 'liquid' });
  });

  it('handles half tablets and a four-slot pattern', () => {
    const { fields } = parsePrescription('Thyronorm ½-0-0-½ before food', today);
    expect(fields.dose_qty).toBe(0.5);
    expect(fields.slots).toEqual(['breakfast', 'bed']);
    expect(fields.meal).toBe('before');
  });

  it('never throws and leaves unknown fields out', () => {
    expect(parsePrescription('', today).fields).toEqual({});
    expect(parsePrescription(null, today).fields).toEqual({});
    expect(parsePrescription('x'.repeat(5000), today).fields.name.length).toBeLessThanOrEqual(80);
  });
});
