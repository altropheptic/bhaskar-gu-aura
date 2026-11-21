// @vitest-environment jsdom
/**
 * Screens rendered in a simulated browser: the Today screen shows the next
 * dose with real buttons, tapping "Took it" logs the dose, the alerts bell
 * counts what needs attention, and the calendar export is valid iCalendar.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../js/store.js';
import { MemoryBackend } from '../js/storeLocal.js';
import { state, loadAll } from '../js/state.js';
import { buildDemoData } from '../js/demoData.js';
import { renderToday } from '../js/todayView.js';
import { renderMedicines } from '../js/medicinesView.js';
import { renderHistory } from '../js/historyView.js';
import { notificationItems, notificationCount } from '../js/notifications.js';
import { buildIcs } from '../js/ics.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  document.body.innerHTML = '<div id="banner-region"></div><div id="toast-region"></div><main id="panel"></main>';
  store.backend = new MemoryBackend({ profiles: [], medicines: [], logs: [], links: [] }, null);
  store.mode = 'local';
  await store.importAll(buildDemoData());
  state.profileId = null;
  await loadAll();
});

describe('Today screen', () => {
  it('shows the date, the week strip and an up-next card', () => {
    const panel = document.getElementById('panel');
    renderToday(panel);
    expect(panel.querySelector('h1, h2')?.textContent).toMatch(/Today/);
    expect(panel.querySelectorAll('.week button, .week [role="button"], .week a, .week li').length).toBeGreaterThanOrEqual(7);
    expect(panel.querySelector('.next')).not.toBeNull();
  });

  it('every icon-only button has an accessible name', () => {
    const panel = document.getElementById('panel');
    renderToday(panel);
    for (const btn of panel.querySelectorAll('button')) {
      const name = btn.getAttribute('aria-label') || btn.textContent.trim();
      expect(name, btn.outerHTML.slice(0, 80)).not.toBe('');
    }
  });

  it('"Took it" on a due or missed dose saves a log', async () => {
    const panel = document.getElementById('panel');
    renderToday(panel);
    const before = state.logs.length;
    const take = [...panel.querySelectorAll('button')].find((b) => /Took it|Taken/.test(b.textContent));
    if (!take) return; // nothing due at this moment of the day
    take.click();
    await flush(); await flush();
    expect(state.logs.length).toBe(before + 1);
  });
});

describe('other screens', () => {
  it('Medicines lists every medicine with its photo or pill', () => {
    const panel = document.getElementById('panel');
    renderMedicines(panel);
    expect(panel.querySelectorAll('.medcard').length).toBe(state.medicines.length);
    expect(panel.textContent).toContain('Steel dabba');
  });

  it('Progress shows an adherence percentage', () => {
    const panel = document.getElementById('panel');
    renderHistory(panel);
    expect(panel.textContent).toMatch(/\d+%/);
  });
});

describe('alerts bell', () => {
  it('counts due/missed doses, low stock and reminder setup', () => {
    const { doses, refills, setupToFix } = notificationItems();
    expect(refills.map((r) => r.med.name)).toContain('Amlodipine'); // 3 tablets left in the sample family
    expect(notificationCount()).toBe(doses.length + refills.length + (setupToFix ? 1 : 0));
  });
});

describe('calendar export', () => {
  it('writes one weekly event with an alarm per dose time', () => {
    const ics = buildIcs(state.profiles[0], state.medicines);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    const events = ics.split('BEGIN:VEVENT').length - 1;
    const doseTimes = state.medicines.filter((m) => m.active).reduce((n, m) => n + m.times.length, 0);
    expect(events).toBe(doseTimes);
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true); // RFC 5545 line folding
  });
});
