/**
 * Routine-based reminders: doses follow the person's meals, not fixed clock times.
 */
import { describe, it, expect } from 'vitest';
import { routineOf, slotTime, buildSchedule, retime, doseSlotLabel } from '../js/routine.js';

const routine = routineOf({
  breakfast_time: '08:00',
  lunch_time: '13:00',
  dinner_time: '20:30',
  bed_time: '22:00',
  wake_time: '06:00',
});

describe('slotTime', () => {
  it('shifts meal slots by food timing', () => {
    expect(slotTime('breakfast', 'before', routine)).toBe('07:30');
    expect(slotTime('breakfast', 'after', routine)).toBe('08:15');
    expect(slotTime('dinner', 'with', routine)).toBe('20:30');
  });

  it('never shifts wake-up or bedtime', () => {
    expect(slotTime('wake', 'before', routine)).toBe('06:00');
    expect(slotTime('bed', 'after', routine)).toBe('22:00');
  });
});

describe('routineOf', () => {
  it('fills missing times with defaults and trims seconds', () => {
    const r = routineOf({ breakfast_time: '09:15:00' });
    expect(r.breakfast_time).toBe('09:15');
    expect(r.bed_time).toBe('22:00');
  });
});

describe('buildSchedule', () => {
  it('returns sorted, de-duplicated parallel arrays', () => {
    const s = buildSchedule(['dinner', 'breakfast'], ['15:00', '08:15'], 'after', routine);
    expect(s.times).toEqual(['08:15', '15:00', '20:45']);
    expect(s.slots).toEqual(['breakfast', 'custom', 'dinner']);
  });
});

describe('retime', () => {
  it('moves anchored doses when the routine changes and keeps custom times', () => {
    const med = { meal: 'after', times: ['08:15', '15:00'], slots: ['breakfast', 'custom'] };
    const later = routineOf({ ...routine, breakfast_time: '09:00' });
    expect(retime(med, later)).toEqual({ times: ['09:15', '15:00'], slots: ['breakfast', 'custom'] });
  });

  it('returns null when nothing changes or nothing is anchored', () => {
    expect(retime({ meal: 'after', times: ['08:15'], slots: ['breakfast'] }, routine)).toBeNull();
    expect(retime({ meal: 'any', times: ['10:00'], slots: null }, routine)).toBeNull();
  });
});

describe('doseSlotLabel', () => {
  it('names the routine slot, or the part of day for custom times', () => {
    expect(doseSlotLabel('lunch', '13:15')).toBe('Lunch');
    expect(doseSlotLabel('custom', '15:00')).toBe('Afternoon');
    expect(doseSlotLabel('custom', '23:00')).toBe('Night');
  });
});
