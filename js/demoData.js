/**
 * Realistic sample data for "Try Instant Demo": four family members, 18 medicines
 * (most with a photo), 30 days of history.
 *
 * Why generated, not static JSON: dates must be relative to *now* so the demo
 * always shows a live Today screen, a month of history, a low-stock refill
 * warning, a duplicate-medicine warning and an alarm that rings ~1 minute after
 * the demo starts. History is deterministic (seeded) so it looks the same each
 * time. Medicine photos are real, freely licensed photos from Wikimedia Commons
 * (public/demo/, credits in public/demo/CREDITS.md).
 */
import { isoDate, addDays, startOfDay, dosesForDay } from './schedule.js';
import { buildSchedule, routineOf } from './routine.js';

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
const HISTORY_DAYS = 30;

/** @returns {{profiles:any[], medicines:any[], logs:any[], links:any[]}} */
export function buildDemoData(now = new Date()) {
  const rand = seeded(42);
  const today = startOfDay(now);
  const monthAgo = isoDate(addDays(today, -HISTORY_DAYS));
  const soon = new Date(now.getTime() + 75_000); // the alarm demo rings ~1 minute from now
  const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;

  const person = (p) => ({ id: crypto.randomUUID(), ...p });
  const dadi = person({
    name: 'Dadi', age: 74, language: 'hi', blood_group: 'B+',
    allergies: 'Penicillin', conditions: 'Type 2 diabetes, high blood pressure',
    emergency_name: 'Rohan (grandson)', emergency_phone: '+91 98640 12345',
    wake_time: '06:00', breakfast_time: '08:00', lunch_time: '13:00', dinner_time: '20:30', bed_time: '22:00',
  });
  const nanaji = person({
    name: 'Nanaji', age: 79, language: 'en', blood_group: 'O+',
    allergies: 'None known', conditions: 'Hypertension, knee pain',
    emergency_name: 'Priya (daughter)', emergency_phone: '+91 94350 67890',
    wake_time: '06:30', breakfast_time: '08:30', lunch_time: '14:00', dinner_time: '21:00', bed_time: '22:30',
  });
  const papa = person({
    name: 'Papa', age: 61, language: 'en', blood_group: 'A+',
    allergies: 'Sulfa drugs', conditions: 'Type 2 diabetes, hypothyroidism',
    emergency_name: 'Ankit (son)', emergency_phone: '+91 70020 45678',
    wake_time: '05:45', breakfast_time: '07:30', lunch_time: '13:30', dinner_time: '20:00', bed_time: '22:30',
  });
  const maa = person({
    name: 'Maa', age: 57, language: 'hi', blood_group: 'B-',
    allergies: 'None known', conditions: 'Anaemia, vitamin D deficiency',
    emergency_name: 'Ankit (son)', emergency_phone: '+91 70020 45678',
    wake_time: '05:30', breakfast_time: '08:00', lunch_time: '13:00', dinner_time: '20:00', bed_time: '22:00',
  });

  /** Medicine with times from the person's routine slots, plus a real photo (public/demo/<name>.jpg). */
  const med = (profile, { slots = [], custom = [], photo, ...m }) => {
    const schedule = buildSchedule(slots, custom, m.meal, routineOf(profile));
    const base = {
      id: crypto.randomUUID(), profile_id: profile.id, days: EVERY_DAY, dose_qty: 1, refill_at: 5,
      start_date: monthAgo, end_date: null, active: true, notes: '', generic_name: '', kept_at: '', doctor: '', photo: null,
      ...m, times: schedule.times, slots: schedule.slots,
    };
    if (photo) base.photo = `/demo/${photo}.jpg`;
    return base;
  };

  const medicines = [
    // Dadi: diabetes + blood pressure (the alarm demo is hers)
    med(dadi, { name: 'Metformin', generic_name: 'Metformin', dosage: '500 mg', form: 'tablet', color: 'white', shape: 'round', meal: 'after', slots: ['breakfast', 'dinner'], stock: 38, kept_at: 'Steel dabba, dining table', doctor: 'Dr. Meera Baruah', photo: 'metformin' }),
    med(dadi, { name: 'Amlodipine', generic_name: 'Amlodipine', dosage: '5 mg', form: 'tablet', color: 'pink', shape: 'oval', meal: 'any', slots: ['breakfast'], stock: 3, notes: 'For blood pressure', kept_at: 'Steel dabba, dining table', doctor: 'Dr. Meera Baruah', photo: 'amlodipine' }),
    med(dadi, { name: 'Atorvastatin', generic_name: 'Atorvastatin', dosage: '40 mg', form: 'tablet', color: 'blue', shape: 'oval', meal: 'after', slots: ['dinner'], stock: 24, kept_at: 'Bedside drawer', doctor: 'Dr. Meera Baruah', photo: 'atorvastatin' }),
    med(dadi, { name: 'Calcium + D3', generic_name: 'Calcium carbonate', dosage: '500 mg', form: 'tablet', color: 'yellow', shape: 'capsule', meal: 'after', custom: [soonTime], stock: 50, start_date: isoDate(today), notes: 'Added today to show the alarm', kept_at: 'Kitchen shelf, blue box', photo: 'calcium-d3' }),

    // Nanaji: blood pressure, heart, knee pain (with a duplicate paracetamol to show the warning)
    med(nanaji, { name: 'Telmisartan', generic_name: 'Telmisartan', dosage: '80 mg', form: 'tablet', color: 'green', shape: 'round', meal: 'before', slots: ['breakfast'], stock: 20, kept_at: 'Pill organiser, study table', doctor: 'Dr. R. K. Das', photo: 'telmisartan' }),
    med(nanaji, { name: 'Ecosprin', generic_name: 'Aspirin', dosage: '75 mg', form: 'tablet', color: 'orange', shape: 'round', meal: 'after', slots: ['lunch'], stock: 28, kept_at: 'Pill organiser, study table', doctor: 'Dr. R. K. Das', photo: 'aspirin' }),
    med(nanaji, { name: 'Pantoprazole', generic_name: 'Pantoprazole', dosage: '20 mg', form: 'tablet', color: 'yellow', shape: 'oval', meal: 'before', slots: ['breakfast'], stock: 14, kept_at: 'Pill organiser, study table', doctor: 'Dr. R. K. Das', photo: 'pantoprazole' }),
    med(nanaji, { name: 'Dolo 650', generic_name: 'Paracetamol', dosage: '650 mg', form: 'tablet', color: 'white', shape: 'oval', meal: 'after', slots: ['breakfast', 'dinner'], stock: 10, start_date: isoDate(addDays(today, -2)), end_date: isoDate(addDays(today, 3)), notes: 'For knee pain, 5 days', doctor: 'Dr. Anil Kalita (ortho)', photo: 'paracetamol' }),
    med(nanaji, { name: 'Crocin Advance', generic_name: 'Paracetamol', dosage: '500 mg', form: 'tablet', color: 'blue', shape: 'oval', meal: 'any', custom: ['15:00'], stock: 15, start_date: isoDate(addDays(today, -2)), notes: 'Same medicine as Dolo: shows the duplicate warning' }),

    // Papa: diabetes + thyroid (thyroxine on an empty stomach at wake-up), weekly B12
    med(papa, { name: 'Thyroxine', generic_name: 'Levothyroxine', dosage: '25 mcg', form: 'tablet', color: 'white', shape: 'round', meal: 'before', slots: ['wake'], stock: 60, notes: 'Empty stomach, 30 min before tea', kept_at: 'Bathroom shelf', doctor: 'Dr. S. Bora (endocrine)', photo: 'levothyroxine' }),
    med(papa, { name: 'Glimepiride', generic_name: 'Glimepiride', dosage: '2 mg', form: 'tablet', color: 'green', shape: 'oval', meal: 'before', slots: ['breakfast'], stock: 22, kept_at: 'Office bag, front pocket', doctor: 'Dr. S. Bora (endocrine)', photo: 'glimepiride' }),
    med(papa, { name: 'Metformin SR', generic_name: 'Metformin', dosage: '1000 mg', form: 'tablet', color: 'white', shape: 'oval', meal: 'after', slots: ['dinner'], stock: 26, kept_at: 'Dining table, steel dabba', doctor: 'Dr. S. Bora (endocrine)', photo: 'metformin' }),
    med(papa, { name: 'Rosuvastatin', generic_name: 'Rosuvastatin', dosage: '10 mg', form: 'tablet', color: 'pink', shape: 'round', meal: 'any', slots: ['bed'], stock: 18, kept_at: 'Bedside drawer', doctor: 'Dr. R. K. Das', photo: 'rosuvastatin' }),
    med(papa, { name: 'Vitamin B12', generic_name: 'Methylcobalamin', dosage: '1500 mcg', form: 'capsule', color: 'red', shape: 'capsule', meal: 'after', slots: ['lunch'], days: [0, 3], stock: 8, kept_at: 'Kitchen shelf', photo: 'vitamin-b12' }),

    // Maa: anaemia + vitamin D, a short course of cough syrup
    med(maa, { name: 'Iron + Folic Acid', generic_name: 'Ferrous ascorbate', dosage: '100 mg', form: 'tablet', color: 'red', shape: 'oval', meal: 'after', slots: ['lunch'], stock: 25, notes: 'Not with tea or milk', kept_at: 'Kitchen shelf, red tin', doctor: 'Dr. Nandita Sharma' }),
    med(maa, { name: 'Vitamin D3', generic_name: 'Cholecalciferol', dosage: '60000 IU', form: 'capsule', color: 'yellow', shape: 'capsule', meal: 'with', slots: ['breakfast'], days: [0], stock: 4, notes: 'Once a week, Sunday', kept_at: 'Fridge door', doctor: 'Dr. Nandita Sharma' }),
    med(maa, { name: 'Cough Syrup', generic_name: 'Ambroxol', dosage: '10 ml', form: 'syrup', color: 'orange', shape: 'liquid', meal: 'after', slots: ['breakfast', 'dinner'], dose_qty: 10, stock: null, start_date: isoDate(addDays(today, -3)), end_date: isoDate(addDays(today, 4)), kept_at: 'Bedroom cupboard', doctor: 'Dr. Nandita Sharma', photo: 'cough-syrup' }),
    med(maa, { name: 'Calcium', generic_name: 'Calcium citrate', dosage: '500 mg', form: 'tablet', color: 'white', shape: 'capsule', meal: 'after', slots: ['dinner'], stock: 30, kept_at: 'Dining table', photo: 'calcium' }),
  ];

  // History: mostly taken, a few skipped or simply missed (no log). Papa slips a bit more.
  const logs = [];
  for (let i = HISTORY_DAYS; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    for (const dose of dosesForDay(medicines, day)) {
      const minutesAgo = (now - dose.at) / 60_000;
      if (minutesAgo < 0) continue; // future
      if (i === 0 && minutesAgo < 150) continue; // leave today's recent doses open for the demo
      const r = rand();
      const missRate = dose.med.profile_id === papa.id ? 0.12 : 0.05;
      if (r < missRate) continue; // missed
      const status = r < missRate + 0.04 ? 'skipped' : 'taken';
      const logged = new Date(dose.at.getTime() + Math.floor(rand() * 25) * 60_000);
      logs.push({ id: crypto.randomUUID(), medicine_id: dose.med.id, scheduled_for: dose.iso, status, logged_at: logged.toISOString() });
    }
  }

  return { profiles: [dadi, nanaji, papa, maa], medicines, logs, links: [] };
}
