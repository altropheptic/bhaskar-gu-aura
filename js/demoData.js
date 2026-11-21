/**
 * Realistic sample data for "Try Instant Demo".
 *
 * Why generated, not static JSON: dates must be relative to *now* so the demo
 * always shows a live Today screen, two weeks of history, a low-stock refill
 * warning, a duplicate-medicine warning and an alarm that rings ~1 minute after
 * the demo starts. Everything is deterministic (seeded) so it looks the same each time.
 */
import { isoDate, addDays, startOfDay, dosesForDay } from './schedule.js';

/** Small deterministic pseudo-random generator (mulberry32). */
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** @returns {{profiles:any[], medicines:any[], logs:any[], links:any[]}} */
export function buildDemoData(now = new Date()) {
  const rand = seeded(42);
  const today = startOfDay(now);
  const twoWeeksAgo = isoDate(addDays(today, -15));
  const soon = new Date(now.getTime() + 75_000); // the alarm demo rings ~1 minute from now
  const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;

  const dadi = {
    id: crypto.randomUUID(), name: 'Dadi', age: 74, language: 'hi', blood_group: 'B+',
    allergies: 'Penicillin', conditions: 'Type 2 diabetes, high blood pressure',
    emergency_name: 'Rohan (grandson)', emergency_phone: '+91 98640 12345',
  };
  const nanaji = {
    id: crypto.randomUUID(), name: 'Nanaji', age: 79, language: 'en', blood_group: 'O+',
    allergies: 'None known', conditions: 'Hypertension, knee pain',
    emergency_name: 'Priya (daughter)', emergency_phone: '+91 94350 67890',
  };

  const med = (profile, m) => ({
    id: crypto.randomUUID(), profile_id: profile.id, days: EVERY_DAY, dose_qty: 1, refill_at: 5,
    start_date: twoWeeksAgo, end_date: null, active: true, notes: '', generic_name: '', ...m,
  });

  const medicines = [
    med(dadi, { name: 'Metformin', generic_name: 'Metformin', dosage: '500 mg', form: 'tablet', color: 'white', shape: 'round', meal: 'after', times: ['08:00', '21:00'], stock: 38 }),
    med(dadi, { name: 'Amlodipine', generic_name: 'Amlodipine', dosage: '5 mg', form: 'tablet', color: 'pink', shape: 'oval', meal: 'any', times: ['08:00'], stock: 3, notes: 'For blood pressure' }),
    med(dadi, { name: 'Atorvastatin', generic_name: 'Atorvastatin', dosage: '10 mg', form: 'tablet', color: 'white', shape: 'oval', meal: 'after', times: ['21:00'], stock: 24 }),
    med(dadi, { name: 'Calcium + Vitamin D3', generic_name: 'Calcium carbonate', dosage: '500 mg', form: 'tablet', color: 'yellow', shape: 'capsule', meal: 'after', times: [soonTime], stock: 50, start_date: isoDate(today), notes: 'Added today to show the alarm' }),
    med(nanaji, { name: 'Telmisartan', generic_name: 'Telmisartan', dosage: '40 mg', form: 'tablet', color: 'white', shape: 'round', meal: 'before', times: ['07:30'], stock: 20 }),
    med(nanaji, { name: 'Ecosprin', generic_name: 'Aspirin', dosage: '75 mg', form: 'tablet', color: 'orange', shape: 'round', meal: 'after', times: ['14:00'], stock: 28 }),
    med(nanaji, { name: 'Dolo 650', generic_name: 'Paracetamol', dosage: '650 mg', form: 'tablet', color: 'white', shape: 'oval', meal: 'after', times: ['09:00', '21:00'], stock: 10, end_date: isoDate(addDays(today, 3)), notes: 'For knee pain, 5 days' }),
    med(nanaji, { name: 'Crocin Advance', generic_name: 'Paracetamol', dosage: '500 mg', form: 'tablet', color: 'blue', shape: 'oval', meal: 'any', times: ['15:00'], stock: 15, notes: 'Same medicine as Dolo: shows the duplicate warning' }),
  ];

  // History: ~90% taken, a few skipped or simply missed (no log).
  const logs = [];
  for (let i = 14; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    for (const dose of dosesForDay(medicines, day)) {
      const minutesAgo = (now - dose.at) / 60_000;
      if (minutesAgo < 0) continue; // future
      if (i === 0 && minutesAgo < 150) continue; // leave today's recent doses open for the demo
      const r = rand();
      if (r < 0.06) continue; // missed
      const status = r < 0.1 ? 'skipped' : 'taken';
      const logged = new Date(dose.at.getTime() + Math.floor(rand() * 25) * 60_000);
      logs.push({ id: crypto.randomUUID(), medicine_id: dose.med.id, scheduled_for: dose.iso, status, logged_at: logged.toISOString() });
    }
  }

  return { profiles: [dadi, nanaji], medicines, logs, links: [] };
}
