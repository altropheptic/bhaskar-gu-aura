// @vitest-environment jsdom
/**
 * The alarm engine: when a dose comes due it rings once, shows the medicine
 * and where it is kept, and "I took it" logs it. Also the chime, settings
 * and the text-size preference.
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

const { store } = await import('../js/store.js');
const { MemoryBackend } = await import('../js/storeLocal.js');
const { state, loadAll } = await import('../js/state.js');
const { startReminders, testChime, isAudioReady } = await import('../js/reminders.js');
const { getSettings, setSettings } = await import('../js/settings.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Fake Web Audio, enough for the chime. */
class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    FakeAudioContext.oscillators = 0;
  }
  resume() {
    this.state = 'running';
  }
  createOscillator() {
    FakeAudioContext.oscillators += 1;
    return { type: '', frequency: {}, connect: (n) => n, start() {}, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n };
  }
}

beforeAll(async () => {
  document.body.innerHTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').match(
    /<body[^>]*>([\s\S]*)<\/body>/,
  )[1];
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  window.AudioContext = FakeAudioContext;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});

  // One person with a tablet due one minute ago (unless it's just past midnight).
  const now = new Date();
  const due = new Date(Math.max(now.getTime() - 60_000, new Date(now).setHours(0, 0, 0, 0)));
  const profileId = crypto.randomUUID();
  store.backend = new MemoryBackend(
    {
      profiles: [{ id: profileId, name: 'Dadi', language: 'en' }],
      medicines: [
        {
          id: crypto.randomUUID(),
          profile_id: profileId,
          name: 'Amlodipine',
          generic_name: '',
          dosage: '5 mg',
          form: 'tablet',
          color: 'pink',
          shape: 'oval',
          meal: 'any',
          times: [hhmm(due)],
          slots: ['custom'],
          days: [0, 1, 2, 3, 4, 5, 6],
          dose_qty: 1,
          stock: 10,
          refill_at: 5,
          start_date: '2020-01-01',
          end_date: null,
          active: true,
          notes: '',
          kept_at: 'Steel dabba',
          doctor: '',
          photo: null,
        },
      ],
      logs: [],
      links: [],
    },
    null,
  );
  state.profileId = null;
  await loadAll();
});

describe('alarm', () => {
  it('rings for a due dose, then "I took it" logs it and lowers the stock', async () => {
    startReminders();
    await wait(1700); // first check runs 1.5 s after start
    const dialog = document.getElementById('alarm-dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Amlodipine 5 mg');
    expect(dialog.textContent).toContain('Steel dabba');

    [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes('I took it')).click();
    await wait(50);
    expect(dialog.open).toBe(false);
    expect(state.logs).toHaveLength(1);
    expect(state.medicines[0].stock).toBe(9);
  });

  it('does not ring twice for the same dose', async () => {
    document.dispatchEvent(new Event('visibilitychange')); // triggers another check
    await wait(20);
    expect(document.getElementById('alarm-dialog').open).toBe(false);
  });
});

describe('sound and settings', () => {
  it('the test chime plays two notes and marks audio as ready', () => {
    testChime();
    expect(FakeAudioContext.oscillators).toBe(2);
    expect(isAudioReady()).toBe(true);
  });

  it('remembers settings and applies extra-large text', () => {
    expect(getSettings()).toMatchObject({ size: 'normal', voice: true });
    setSettings({ size: 'xl' });
    expect(document.documentElement.dataset.size).toBe('xl');
    expect(getSettings().size).toBe('xl');
    setSettings({ size: 'normal' });
    expect(document.documentElement.dataset.size).toBeUndefined();
  });
});
