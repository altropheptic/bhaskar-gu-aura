/**
 * Printable doctor report and emergency card.
 *
 * Why print: doctors in India still work largely on paper, and an emergency card
 * in a wallet or on the fridge works without a phone. We build plain DOM into
 * #print-area and let print CSS hide everything else.
 */
import { el, formatTime, MEAL_LABEL, doseLabel, showBanner } from './ui.js';
import { state, currentProfile } from './state.js';
import { perMedicine, dosesForDay, doseStatus, addDays, startOfDay } from './schedule.js';

function printNow(children) {
  const area = document.getElementById('print-area');
  area.replaceChildren(...children);
  document.body.classList.add('is-printing');
  const done = () => {
    document.body.classList.remove('is-printing');
    area.replaceChildren();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

const row = (cells, tag = 'td') => el('tr', {}, cells.map((c) => el(tag, { text: c })));

/** One-page adherence summary to take to the doctor. */
export function printDoctorReport() {
  const p = currentProfile();
  if (!p || !state.medicines.length) { showBanner('info', 'Add medicines first.'); return; }
  const now = new Date();
  const adherenceByMed = new Map(perMedicine(state.medicines, state.logIndex, 30, now).map((x) => [x.med.id, x.pct]));
  const missed = [];
  for (let i = 13; i >= 0; i -= 1) {
    for (const d of dosesForDay(state.medicines, addDays(startOfDay(now), -i))) {
      const s = doseStatus(d, state.logIndex, now);
      if (s === 'missed' || s === 'skipped') missed.push([d.at.toLocaleDateString(), formatTime(d.time), d.med.name, s]);
    }
  }
  printNow([
    el('h1', { text: `Medication report: ${p.name}${p.age ? ` (${p.age})` : ''}` }),
    el('p', { text: `Prepared ${now.toLocaleDateString()} with Dawai Dost. Adherence covers the last 30 days.` }),
    el('p', { text: `Conditions: ${p.conditions || 'not recorded'} · Allergies: ${p.allergies || 'not recorded'}` }),
    el('h2', { text: 'Current medicines' }),
    el('table', {}, [
      el('thead', {}, [row(['Medicine', 'Strength', 'Contains', 'Doctor', 'Dose', 'Times', 'With food', 'Taken (30 days)'], 'th')]),
      el('tbody', {}, state.medicines.filter((m) => m.active).map((m) => row([
        m.name, m.dosage || '', m.generic_name || '', m.doctor || '', doseLabel(m), m.times.map(formatTime).join(', '),
        MEAL_LABEL[m.meal] ?? '', adherenceByMed.get(m.id) === null || adherenceByMed.get(m.id) === undefined ? '–' : `${adherenceByMed.get(m.id)}%`,
      ]))),
    ]),
    el('h2', { text: 'Missed or skipped doses (last 14 days)' }),
    missed.length
      ? el('table', {}, [el('thead', {}, [row(['Date', 'Time', 'Medicine', 'Status'], 'th')]), el('tbody', {}, missed.map((r) => row(r)))])
      : el('p', { text: 'None. Every dose was taken.' }),
    el('p', { text: 'This report is generated from what was logged in the app. It is not a medical record.' }),
  ]);
}

/** Wallet / fridge emergency card. */
export function printEmergencyCard() {
  const p = currentProfile();
  if (!p) return;
  const meds = state.medicines.filter((m) => m.active);
  printNow([
    el('div', { className: 'print-card' }, [
      el('h1', { text: `EMERGENCY · ${p.name}` }),
      el('p', { text: `Age: ${p.age ?? '–'} · Blood group: ${p.blood_group || '–'}` }),
      el('p', { text: `Allergies: ${p.allergies || 'None recorded'}` }),
      el('p', { text: `Conditions: ${p.conditions || 'None recorded'}` }),
      el('p', { text: `Emergency contact: ${p.emergency_name || '–'} ${p.emergency_phone || ''}` }),
      el('h2', { text: 'Current medicines' }),
      meds.length
        ? el('table', {}, [el('tbody', {}, meds.map((m) => row([[m.name, m.dosage].filter(Boolean).join(' '), m.times.map(formatTime).join(', ')])))])
        : el('p', { text: 'None recorded.' }),
      el('p', { text: `Updated ${new Date().toLocaleDateString()} · Dawai Dost` }),
    ]),
  ]);
}
