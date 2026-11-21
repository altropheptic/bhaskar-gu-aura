/**
 * Export the schedule as an .ics calendar file with an alarm on every dose.
 *
 * Why: web pages can't ring reliably when the browser is closed (iPhone web push
 * is especially flaky). Every phone calendar can. Importing this file makes the
 * phone's own calendar ring at each dose time, no extra app needed.
 */
import { doseLabel, MEAL_LABEL } from './ui.js';

const DAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Escape text per RFC 5545. */
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold long lines at 74 characters (RFC 5545 §3.1). */
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join('\r\n');
}

const compactDate = (iso) => iso.replaceAll('-', '');

/**
 * Build the calendar text.
 * @param {{ name: string }} profile
 * @param {any[]} medicines
 */
export function buildIcs(profile, medicines) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dawai Dost//Medicine reminders//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`Medicines · ${profile.name}`)}`];
  for (const med of medicines.filter((m) => m.active)) {
    for (const time of med.times) {
      const title = `${med.name}${med.dosage ? ` ${med.dosage}` : ''} · ${doseLabel(med)}`;
      const rule = [`FREQ=WEEKLY`, `BYDAY=${med.days.slice().sort().map((d) => DAY_CODE[d]).join(',')}`];
      if (med.end_date) rule.push(`UNTIL=${compactDate(med.end_date)}T235959`);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${med.id}-${time.replace(':', '')}@dawai-dost`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${compactDate(med.start_date)}T${time.replace(':', '')}00`,
        'DURATION:PT10M',
        `RRULE:${rule.join(';')}`,
        `SUMMARY:${esc(`${profile.name}: ${title}`)}`,
        `DESCRIPTION:${esc(`${MEAL_LABEL[med.meal] ?? ''}. Mark it in Dawai Dost after taking it.`)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`Time for ${med.name}`)}`,
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

/** Download the .ics file. */
export function downloadIcs(profile, medicines) {
  const blob = new Blob([buildIcs(profile, medicines)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dawai-dost-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'medicines'}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
