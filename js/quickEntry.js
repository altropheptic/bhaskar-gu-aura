/**
 * Rule-based prescription parser: "Metformin 500mg 1-0-1 after food x 30 days".
 *
 * Why: Indian prescriptions use the "morning-afternoon-night" notation (1-0-1)
 * and Latin shorthands (OD, BD, TDS, HS). Typing that is the fastest way for a
 * family member to enter a medicine. This parser is also the always-available
 * fallback when the Gemini AI parser is offline, so the feature never breaks.
 */
import { isoDate, addDays } from './schedule.js';

/** Default clock times for each slot of the "1-0-1" notation. */
const SLOT_TIMES_3 = ['08:00', '14:00', '21:00'];
const SLOT_TIMES_4 = ['08:00', '13:00', '18:00', '22:00'];

const FREQ_WORDS = [
  { re: /\b(qid|four times)\b/i, pattern: [1, 1, 1, 1] },
  { re: /\b(tds|tid|thrice|three times)\b/i, pattern: [1, 1, 1] },
  { re: /\b(bd|bid|twice|two times)\b/i, pattern: [1, 0, 1] },
  { re: /\b(hs|at bed ?time|bedtime|at night)\b/i, pattern: [0, 0, 1] },
  { re: /\b(od|once( a day| daily)?|daily)\b/i, pattern: [1, 0, 0] },
];

/** "½" and "1/2" -> 0.5 */
function num(token) {
  if (token === '½' || token === '1/2') return 0.5;
  return Number(token);
}

/**
 * Parse free text into a partial medicine. Unknown fields are left out so the
 * form keeps its defaults. Never throws.
 * @param {string} text
 * @param {Date} [today]
 * @returns {{ fields: Record<string, any>, understood: string[] }}
 */
export function parsePrescription(text, today = new Date()) {
  const fields = {};
  const understood = [];
  let rest = ` ${String(text || '').slice(0, 300)} `;

  // 1-0-1 / 1-1-1 / ½-0-½ / 1-0-0-1
  const slotRe = /(?:^|\s)((?:\d|½|1\/2)(?:\.\d)?)\s*-\s*((?:\d|½|1\/2)(?:\.\d)?)\s*-\s*((?:\d|½|1\/2)(?:\.\d)?)(?:\s*-\s*((?:\d|½|1\/2)(?:\.\d)?))?(?=\s|$)/;
  const slot = rest.match(slotRe);
  let pattern = null;
  if (slot) {
    pattern = [slot[1], slot[2], slot[3], slot[4]].filter((v) => v !== undefined).map(num);
    rest = rest.replace(slot[0], ' ');
  } else {
    for (const f of FREQ_WORDS) {
      if (f.re.test(rest)) { pattern = f.pattern; rest = rest.replace(f.re, ' '); break; }
    }
  }
  if (pattern && pattern.some((n) => n > 0)) {
    const times = pattern.length === 4 ? SLOT_TIMES_4 : SLOT_TIMES_3;
    fields.times = pattern.map((n, i) => (n > 0 ? times[i] : null)).filter(Boolean);
    fields.dose_qty = pattern.find((n) => n > 0);
    understood.push(`${fields.times.length}× a day`);
  }

  // Food relation
  if (/\b(before (food|meals?|breakfast|lunch|dinner)|empty stomach|khali pet|ac)\b/i.test(rest)) {
    fields.meal = 'before';
  } else if (/\b(after (food|meals?|breakfast|lunch|dinner)|khane ke baad|pc)\b/i.test(rest)) {
    fields.meal = 'after';
  } else if (/\bwith (food|meals?|milk)\b/i.test(rest)) {
    fields.meal = 'with';
  }
  if (fields.meal) understood.push(`${fields.meal} food`);
  rest = rest.replace(/\b(before|after|with) (food|meals?|breakfast|lunch|dinner|milk)\b|empty stomach|khali pet|khane ke baad/gi, ' ');

  // Duration: "x 30 days", "for 2 weeks", "1 month"
  const dur = rest.match(/(?:x|for|×)?\s*(\d{1,3})\s*(days?|d|weeks?|wks?|months?)\b/i);
  if (dur) {
    const n = Number(dur[1]);
    const unit = dur[2].toLowerCase();
    const days = unit.startsWith('w') ? n * 7 : unit.startsWith('m') ? n * 30 : n;
    if (days > 0 && days <= 365) {
      fields.end_date = isoDate(addDays(today, days - 1));
      understood.push(`for ${days} days`);
    }
    rest = rest.replace(dur[0], ' ');
  }

  // Strength: 500mg, 5 ml, 1000 IU
  const strength = rest.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu|units?)\b/i);
  if (strength) {
    fields.dosage = `${strength[1]} ${strength[2].toLowerCase()}`;
    rest = rest.replace(strength[0], ' ');
  }

  // Form
  if (/\b(syrup|syp|suspension)\b/i.test(rest) || /ml$/.test(fields.dosage ?? '')) fields.form = 'syrup';
  else if (/\b(cap|caps|capsule)\b/i.test(rest)) fields.form = 'capsule';
  else if (/\b(drops?|gtt)\b/i.test(rest)) fields.form = 'drops';
  else if (/\b(inhaler|puffs?|rotacap)\b/i.test(rest)) fields.form = 'inhaler';
  else if (/\b(inj|injection|insulin)\b/i.test(rest)) fields.form = 'injection';
  else if (/\b(tab|tabs|tablet)\b/i.test(rest)) fields.form = 'tablet';
  if (fields.form === 'syrup') fields.shape = 'liquid';
  if (fields.form === 'capsule') fields.shape = 'capsule';

  // Name: what's left, minus form words and filler
  const name = rest
    .replace(/\b(tab|tabs|tablet|cap|caps|capsule|syp|syrup|inj|injection|drops?|x|for|take|daily|morning|night|evening)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N} +\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name) {
    fields.name = name.slice(0, 80).replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    understood.unshift(fields.name);
  }

  return { fields, understood };
}
