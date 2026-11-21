// @vitest-environment jsdom
/**
 * The main user journey on the real page, end to end in a simulated browser:
 * home page -> "Get started" (sample family saved once) -> every tab -> alerts
 * -> settings -> log out -> "View my medicines" -> switch person.
 * Supabase is mocked as unreachable, so this also proves the on-device fallback.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../js/supabaseClient.js', () => ({
  isSupabaseConfigured: false,
  getAccessToken: vi.fn(async () => null),
  getSupabase: vi.fn(async () => null),
  ensureAnonymousSession: vi.fn(async () => {
    throw new Error('offline');
  }),
  db: () => {
    throw new Error('no cloud');
  },
}));

const $ = (sel) => document.querySelector(sel);
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
async function until(check, ms = 3000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await wait();
  }
}

beforeAll(async () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
  localStorage.clear();
  await import('../js/app.js');
});

describe('first visit', () => {
  it('starts on the home page with one call to action', () => {
    expect($('#landing').hidden).toBe(false);
    expect($('#app').hidden).toBe(true);
    expect($('#demo-btn').textContent).toBe('Get started');
  });

  it('"Get started" opens the app with the sample family saved on this device', async () => {
    $('#demo-btn').click();
    await until(() => !$('#app').hidden);
    const people = [...$('#profile-select').options].map((o) => o.text);
    expect(people).toEqual(['Dadi', 'Nanaji', 'Papa', 'Maa', '+ Add a person']);
    expect($('#panel-today').textContent).toMatch(/Today/);
    expect(JSON.parse(localStorage.getItem('dawai-dost-local-v1')).medicines).toHaveLength(18);
  });
});

describe('in the app', () => {
  it('every tab renders its screen', async () => {
    const tab = (name) => document.querySelector(`.nav__item[data-tab="${name}"]`);
    tab('medicines').click();
    expect($('#panel-medicines').hidden).toBe(false);
    expect($('#panel-medicines').querySelectorAll('.medcard').length).toBeGreaterThan(0);
    expect(tab('medicines').getAttribute('aria-current')).toBe('page');
    tab('history').click();
    expect($('#panel-history').textContent).toMatch(/\d+%/);
    tab('care').click();
    expect($('#panel-care').textContent).toContain('Reminder check');
    tab('today').click();
    expect($('#panel-today').hidden).toBe(false);
  });

  it('the bell opens the alerts sheet', () => {
    $('#health-btn').click();
    expect($('#info-dialog').open).toBe(true);
    expect($('#info-title').textContent).toContain('Alerts');
    $('#info-dialog').close();
  });

  it('switching person updates the header', async () => {
    const select = $('#profile-select');
    select.value = [...select.options].find((o) => o.text === 'Maa').value;
    select.dispatchEvent(new Event('change'));
    await until(() => $('#avatar').textContent === 'M');
  });

  it('settings offer text size and log out', () => {
    $('#settings-btn').click();
    expect($('#settings-dialog').open).toBe(true);
    expect($('#settings-dialog').textContent).toContain('Extra large');
    expect([...$('#settings-dialog').querySelectorAll('button')].some((b) => b.textContent.includes('Log out'))).toBe(
      true,
    );
    $('#settings-dialog').close();
  });
});

describe('log out and come back', () => {
  it('returns to the home page and keeps the list', async () => {
    $('#logout-btn').click();
    expect($('#landing').hidden).toBe(false);
    expect($('#demo-btn').textContent).toBe('View my medicines');

    $('#demo-btn').click();
    await until(() => !$('#app').hidden);
    expect([...$('#profile-select').options]).toHaveLength(5); // the family was not added twice
  });
});
