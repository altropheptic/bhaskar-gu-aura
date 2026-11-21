// @vitest-environment jsdom
/**
 * Dialogs and helpers in a simulated browser, on the real page markup:
 * adding and editing a medicine (Quick fill, validation, save), adding a
 * person, the Family screen, one-tap mode, print views, the AI client and
 * the voice fallback.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../js/supabaseClient.js', () => ({
  isSupabaseConfigured: false,
  getAccessToken: vi.fn(async () => 'test-token'),
  getSupabase: vi.fn(async () => null),
  ensureAnonymousSession: vi.fn(async () => {
    throw new Error('offline in tests');
  }),
  db: () => {
    throw new Error('no cloud in tests');
  },
}));

const { store } = await import('../js/store.js');
const { MemoryBackend } = await import('../js/storeLocal.js');
const { state, loadAll } = await import('../js/state.js');
const { buildDemoData } = await import('../js/demoData.js');
const { openMedicineDialog } = await import('../js/medForm.js');
const { openProfileDialog } = await import('../js/profileDialog.js');
const { renderCare } = await import('../js/careView.js');
const { openOneTap } = await import('../js/oneTap.js');
const { printDoctorReport, printEmergencyCard } = await import('../js/reports.js');
const { todaySummaryText, shareOnWhatsApp } = await import('../js/share.js');
const { todayDoses } = await import('../js/doseActions.js');
const { parseTextWithAi, explainWithAi, AiUnavailableError } = await import('../js/ai.js');
const { speakReminder } = await import('../js/voice.js');

const body = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (sel) => document.querySelector(sel);
const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const submit = async (form) => {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  for (let i = 0; i < 6; i += 1) await tick();
};

beforeAll(() => {
  // jsdom has <dialog> elements but not their modal methods.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  Element.prototype.scrollIntoView = () => {};
  window.print = vi.fn();
});

beforeEach(async () => {
  document.body.innerHTML = body;
  store.backend = new MemoryBackend({ profiles: [], medicines: [], logs: [], links: [] }, null);
  store.mode = 'local';
  await store.importAll(buildDemoData());
  state.profileId = null;
  await loadAll();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('add / edit medicine dialog', () => {
  it('Quick fill reads "1-0-1" text offline, then Save adds the medicine', async () => {
    openMedicineDialog();
    const dialog = $('#med-dialog');
    expect(dialog.open).toBe(true);
    $('#quick-text').value = 'Telma 40 mg BD after food';
    button(dialog, 'Quick fill').click();
    expect(dialog.querySelector('input[name="name"]').value).toBe('Telma');
    expect([...dialog.querySelectorAll('input[name="slot"]:checked')].map((i) => i.value)).toEqual([
      'breakfast',
      'dinner',
    ]);

    await submit(dialog.querySelector('form'));
    expect(dialog.open).toBe(false);
    const telma = state.medicines.find((m) => m.name === 'Telma');
    expect(telma).toMatchObject({ dosage: '40 mg', meal: 'after', slots: ['breakfast', 'dinner'] });
  });

  it('shows plain-language errors instead of saving bad input', async () => {
    openMedicineDialog();
    const dialog = $('#med-dialog');
    await submit(dialog.querySelector('form'));
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]').textContent).toContain('Enter the medicine name');
  });

  it('edits an existing medicine and keeps its schedule', async () => {
    const med = state.medicines.find((m) => m.name === 'Metformin');
    openMedicineDialog(med);
    const dialog = $('#med-dialog');
    expect($('#med-title').textContent).toBe('Edit Metformin');
    dialog.querySelector('input[name="dosage"]').value = '850 mg';
    dialog.querySelector('.stepper button[aria-label="More"]').click();
    await submit(dialog.querySelector('form'));
    const saved = state.medicines.find((m) => m.id === med.id);
    expect(saved).toMatchObject({ dosage: '850 mg', dose_qty: 1.5, times: med.times });
  });
});

describe('person dialog', () => {
  it('adds a new person and selects them', async () => {
    const onSaved = vi.fn();
    openProfileDialog(null, { onSaved });
    const dialog = $('#profile-dialog');
    dialog.querySelector('input[name="name"]').value = 'Bua';
    await submit(dialog.querySelector('form'));
    expect(onSaved).toHaveBeenCalled();
    expect(state.profiles.map((p) => p.name)).toContain('Bua');
    expect(state.profiles.find((p) => p.id === state.profileId).name).toBe('Bua');
  });
});

describe('Family & safety screen', () => {
  it('shows the reminder check, routine, family and emergency cards', () => {
    const panel = $('#panel-care');
    renderCare(panel);
    for (const title of ['Reminder check', 'Daily routine', 'Family', 'Emergency'])
      expect(panel.textContent).toContain(title);
  });

  it("the WhatsApp update opens wa.me with today's summary", () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const text = todaySummaryText(state.profiles[0], todayDoses());
    expect(text).toContain('Dadi');
    shareOnWhatsApp(text);
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});

describe('one-tap mode and print views', () => {
  it('one-tap mode shows one dose or "all done"', () => {
    openOneTap();
    expect($('#onetap-dialog').open).toBe(true);
    expect($('#onetap-dialog').textContent).toMatch(/I took it|All done/);
  });

  it('the doctor report and emergency card print real data', () => {
    printDoctorReport();
    expect($('#print-area').textContent).toContain('Metformin');
    printEmergencyCard();
    expect($('#print-area').textContent).toContain('B+');
    expect(window.print).toHaveBeenCalledTimes(2);
  });
});

describe('AI client', () => {
  it('sends the session token and re-sanitises what comes back', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ medicines: [{ name: 'Telma', form: 'potion', times: ['8:00'] }, { dosage: 'no name' }] }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const meds = await parseTextWithAi('Telma 40 OD');
    expect(meds).toEqual([expect.objectContaining({ name: 'Telma', form: 'tablet', times: ['08:00'] })]);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('turns server errors into a friendly AiUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'The AI assistant is busy right now.' }), { status: 503 }),
      ),
    );
    await expect(explainWithAi({ name: 'Metformin' }, 'en')).rejects.toThrow(AiUnavailableError);
  });
});

describe('voice', () => {
  it('falls back to the browser voice when the voice service is unreachable', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', function Utterance(text) {
      this.text = text;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await speakReminder(
      { name: 'Dadi', language: 'en' },
      [{ name: 'Metformin', dose_qty: 1, form: 'tablet', meal: 'after' }],
      undefined,
      { force: true },
    );
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toContain('Metformin');
  });
});
