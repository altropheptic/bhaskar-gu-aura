/**
 * Dose scheduling: which doses exist on a day, their live status, the
 * double-dose matching of logs, adherence, streaks, refills and duplicate brands.
 */
import { describe, it, expect } from 'vitest';
import {
  isoDate,
  addDays,
  startOfDay,
  isScheduledOn,
  dosesForDay,
  indexLogs,
  findLog,
  doseStatus,
  adherence,
  streak,
  daysOfSupply,
  duplicateGenerics,
} from '../js/schedule.js';

const day = new Date(2026, 10, 21); // Sat 21 Nov 2026 (local time)
const med = (over = {}) => ({
  id: 'm1',
  name: 'Metformin',
  generic_name: 'Metformin',
  active: true,
  days: [0, 1, 2, 3, 4, 5, 6],
  times: ['08:15', '20:45'],
  slots: ['breakfast', 'dinner'],
  start_date: '2026-11-01',
  end_date: null,
  dose_qty: 1,
  stock: 30,
  ...over,
});
const at = (h, m = 0, d = day) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

describe('dates', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(isoDate(day)).toBe('2026-11-21');
    expect(isoDate(addDays(day, 10))).toBe('2026-12-01');
    expect(startOfDay(at(13, 30)).getHours()).toBe(0);
  });
});

describe('isScheduledOn', () => {
  it('respects active, start/end dates and weekdays', () => {
    expect(isScheduledOn(med(), day)).toBe(true);
    expect(isScheduledOn(med({ active: false }), day)).toBe(false);
    expect(isScheduledOn(med({ start_date: '2026-11-22' }), day)).toBe(false);
    expect(isScheduledOn(med({ end_date: '2026-11-20' }), day)).toBe(false);
    expect(isScheduledOn(med({ days: [0] }), day)).toBe(false); // Sunday only, day is Saturday
  });
});

describe('dosesForDay', () => {
  it('returns one dose per time, sorted, with its routine slot', () => {
    const doses = dosesForDay([med({ times: ['20:45', '08:15'], slots: ['dinner', 'breakfast'] })], day);
    expect(doses.map((d) => d.time)).toEqual(['08:15', '20:45']);
    expect(doses.map((d) => d.slot)).toEqual(['breakfast', 'dinner']);
    expect(doses[0].at.getHours()).toBe(8);
  });
});

describe('doseStatus', () => {
  const [morning] = dosesForDay([med()], day);

  it('is upcoming, then due 30 min before, then missed 2 h after', () => {
    expect(doseStatus(morning, new Map(), at(7, 0))).toBe('upcoming');
    expect(doseStatus(morning, new Map(), at(7, 50))).toBe('due');
    expect(doseStatus(morning, new Map(), at(10, 0))).toBe('due');
    expect(doseStatus(morning, new Map(), at(10, 30))).toBe('missed');
  });

  it('uses the log when the dose was taken or skipped', () => {
    const logs = indexLogs([{ id: 'l1', medicine_id: 'm1', scheduled_for: morning.iso, status: 'taken' }]);
    expect(doseStatus(morning, logs, at(12))).toBe('taken');
  });
});

describe('findLog after re-timing', () => {
  it('lets a moved dose claim its old log, but never two doses one log', () => {
    // Logged at the old 08:00 time; breakfast later moved to 08:15.
    const logs = indexLogs([{ id: 'l1', medicine_id: 'm1', scheduled_for: at(8, 0).toISOString(), status: 'taken' }]);
    const [morning, evening] = dosesForDay([med()], day);
    expect(findLog(morning, logs)?.id).toBe('l1');
    expect(findLog(evening, logs)).toBeUndefined();
  });
});

describe('adherence and streak', () => {
  it('counts only doses whose outcome is known', () => {
    const m = med({ times: ['08:15'], slots: ['breakfast'], start_date: '2026-11-19' });
    const yesterday = addDays(day, -1);
    const logs = indexLogs([
      { medicine_id: 'm1', scheduled_for: at(8, 15, addDays(day, -2)).toISOString(), status: 'taken' },
      { medicine_id: 'm1', scheduled_for: at(8, 15, yesterday).toISOString(), status: 'taken' },
    ]);
    const now = at(9); // today's dose is still "due", so it does not count yet
    expect(adherence([m], logs, 7, now)).toBe(100);
    expect(streak([m], logs, now)).toBe(2);
  });

  it('breaks the streak on a missed day', () => {
    const m = med({ times: ['08:15'], slots: ['breakfast'], start_date: '2026-11-19' });
    const logs = indexLogs([
      { medicine_id: 'm1', scheduled_for: at(8, 15, addDays(day, -2)).toISOString(), status: 'taken' },
    ]);
    expect(streak([m], logs, at(9))).toBe(0);
    expect(adherence([m], logs, 7, at(9))).toBe(50);
  });
});

describe('daysOfSupply', () => {
  it('divides stock by daily use, and ignores untracked stock', () => {
    expect(daysOfSupply(med({ stock: 30 }))).toBe(15); // 2 a day
    expect(daysOfSupply(med({ stock: 3, times: ['08:15'], slots: ['breakfast'] }))).toBe(3);
    expect(daysOfSupply(med({ stock: null }))).toBeNull();
  });
});

describe('duplicateGenerics', () => {
  it('flags two brands of the same molecule', () => {
    const dolo = med({ id: 'a', name: 'Dolo 650', generic_name: 'Paracetamol' });
    const crocin = med({ id: 'b', name: 'Crocin', generic_name: 'paracetamol 500' });
    const other = med({ id: 'c', name: 'Telma', generic_name: 'Telmisartan' });
    const pairs = duplicateGenerics([dolo, crocin, other]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((m) => m.id)).toEqual(['a', 'b']);
  });
});
