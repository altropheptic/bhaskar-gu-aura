// @vitest-environment jsdom
/**
 * State actions on top of the local backend: loading people, logging a dose
 * (stock goes down), the double-dose guard, Undo (stock comes back), re-timing
 * doses when a routine changes, and localStorage persistence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { store, DuplicateDoseError } from '../js/store.js';
import { MemoryBackend, LOCAL_KEY } from '../js/storeLocal.js';
import { state, loadAll, logDose, undoDose, saveProfile, saveMedicine, selectProfile } from '../js/state.js';
import { buildDemoData } from '../js/demoData.js';
import { dosesForDay, doseStatus } from '../js/schedule.js';

/** A dose of `name` today that has not been logged yet. */
function openDose(name) {
  const now = new Date();
  return dosesForDay(state.medicines, now)
    .find((d) => d.med.name === name && !['taken', 'skipped'].includes(doseStatus(d, state.logIndex, now)));
}

beforeEach(async () => {
  localStorage.clear();
  store.backend = new MemoryBackend({ profiles: [], medicines: [], logs: [], links: [] }, LOCAL_KEY);
  store.mode = 'local';
  await store.importAll(buildDemoData());
  state.profileId = null;
  await loadAll();
});

describe('loading', () => {
  it('opens on the first person with their medicines and history', () => {
    expect(state.profiles.map((p) => p.name)).toEqual(['Dadi', 'Nanaji', 'Papa', 'Maa']);
    expect(state.profileId).toBe(state.profiles[0].id);
    expect(state.medicines.map((m) => m.name)).toContain('Metformin');
    expect(state.logs.length).toBeGreaterThan(0);
  });

  it('switches person and remembers the choice', async () => {
    const maa = state.profiles.find((p) => p.name === 'Maa');
    await selectProfile(maa.id);
    expect(state.medicines.map((m) => m.name)).toContain('Iron + Folic Acid');
    expect(localStorage.getItem('dawai-dost-profile')).toBe(maa.id);
  });
});

describe('logging doses', () => {
  it('lowers the stock, blocks a second log of the same dose, and Undo restores it', async () => {
    const dose = openDose('Atorvastatin');
    expect(dose).toBeDefined();
    const before = dose.med.stock;

    const log = await logDose(dose, 'taken');
    expect(state.medicines.find((m) => m.id === dose.med.id).stock).toBe(before - 1);

    await expect(logDose(dose, 'taken')).rejects.toBeInstanceOf(DuplicateDoseError);

    await undoDose(log);
    expect(state.medicines.find((m) => m.id === dose.med.id).stock).toBe(before);
    expect(state.logs.some((l) => l.id === log.id)).toBe(false);
  });

  it('a skipped dose does not touch the stock', async () => {
    const dose = openDose('Atorvastatin');
    await logDose(dose, 'skipped');
    expect(state.medicines.find((m) => m.id === dose.med.id).stock).toBe(dose.med.stock);
  });
});

describe('routine changes', () => {
  it('re-times every dose tied to a meal when the meal time moves', async () => {
    const dadi = state.profiles[0];
    const saved = await saveProfile({ ...dadi, breakfast_time: '09:00' });
    expect(saved.retimed).toBeGreaterThan(0);
    const metformin = state.medicines.find((m) => m.name === 'Metformin');
    expect(metformin.times).toContain('09:15'); // after food = breakfast + 15 min
  });
});

describe('saving medicines', () => {
  it('adds a medicine to the selected person and persists it on this device', async () => {
    await saveMedicine({
      name: 'Vitamin C', generic_name: '', dosage: '500 mg', form: 'tablet', color: 'orange', shape: 'round', meal: 'any',
      times: ['10:00'], slots: ['custom'], days: [0, 1, 2, 3, 4, 5, 6], dose_qty: 1, stock: null, refill_at: 5,
      start_date: '2026-11-21', end_date: null, active: true, notes: '', kept_at: '', doctor: '', photo: null,
    });
    expect(state.medicines.some((m) => m.name === 'Vitamin C')).toBe(true);
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    expect(saved.medicines.some((m) => m.name === 'Vitamin C' && m.profile_id === state.profileId)).toBe(true);
  });

  it('starts empty if the saved data is corrupted', async () => {
    localStorage.setItem(LOCAL_KEY, '{not json');
    const fresh = MemoryBackend.fromLocalStorage();
    expect(await fresh.listProfiles()).toEqual([]);
  });
});
