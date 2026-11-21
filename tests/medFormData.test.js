/**
 * Medicine form -> data: routine slots become clock times, empty stock means
 * "not tracked", edits keep their id, and the result passes validation.
 */
import { describe, it, expect } from 'vitest';
import { newMedicine, customTimesOf, formToMedicine } from '../js/medFormData.js';
import { validateMedicine } from '../js/medSchema.js';
import { routineOf } from '../js/routine.js';

const routine = routineOf({ breakfast_time: '08:00', dinner_time: '20:30' });

/** Build FormData the way the dialog's inputs would. */
function formData(values) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const v of [].concat(value)) fd.append(key, String(v));
  }
  return fd;
}

const filled = {
  name: '  Metformin ',
  generic_name: 'Metformin',
  dosage: '500 mg',
  form: 'tablet',
  color: 'white',
  shape: 'round',
  meal: 'after',
  slot: ['breakfast', 'dinner'],
  days: [0, 1, 2, 3, 4, 5, 6],
  dose_qty: '1',
  stock: '',
  refill_at: '5',
  start_date: '2026-11-21',
  end_date: '',
  kept_at: 'Steel dabba',
  doctor: 'Dr. Baruah',
  notes: '',
};

describe('newMedicine', () => {
  it('starts every day after breakfast, from today', () => {
    const m = newMedicine(new Date(2026, 10, 21));
    expect(m).toMatchObject({
      slots: ['breakfast'],
      meal: 'after',
      start_date: '2026-11-21',
      stock: null,
      active: true,
    });
    expect(m.days).toHaveLength(7);
  });
});

describe('customTimesOf', () => {
  it('returns only the clock times that are not tied to a meal', () => {
    expect(customTimesOf({ times: ['08:15', '15:00'], slots: ['breakfast', 'custom'] })).toEqual(['15:00']);
    expect(customTimesOf({ times: ['09:00'], slots: null })).toEqual(['09:00']);
  });
});

describe('formToMedicine', () => {
  it('turns form values into a valid medicine with meal-based times', () => {
    const med = formToMedicine(formData(filled), { customTimes: ['15:00', ''], routine, photo: null });
    expect(med).toMatchObject({
      name: 'Metformin',
      times: ['08:15', '15:00', '20:45'],
      slots: ['breakfast', 'custom', 'dinner'],
      stock: null,
      end_date: null,
      dose_qty: 1,
      active: true,
    });
    expect(med.id).toBeUndefined();
    expect(validateMedicine(med)).toEqual([]);
  });

  it('keeps the id when editing and reads the Active checkbox', () => {
    const existing = { ...newMedicine(), id: 'm-1' };
    const paused = formToMedicine(formData({ ...filled, stock: '30' }), {
      existing,
      customTimes: [],
      routine,
      photo: '/demo/metformin.jpg',
    });
    expect(paused).toMatchObject({ id: 'm-1', stock: 30, active: false, photo: '/demo/metformin.jpg' });
    const active = formToMedicine(formData({ ...filled, active: 'on' }), {
      existing,
      customTimes: [],
      routine,
      photo: null,
    });
    expect(active.active).toBe(true);
  });
});
