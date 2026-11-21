/**
 * Reminder health check.
 *
 * Why: the most common complaint about medication apps is that reminders
 * silently stop (after an update, a permission change, or the phone's battery
 * saver). Users only find out when a dose is missed. This check shows every
 * reminder channel with a plain status and a one-tap fix, so problems are
 * visible before they cost a dose.
 */
import { el, icon, toast } from './ui.js';
import { state, currentProfile, emit } from './state.js';
import { getSettings, setSettings } from './settings.js';
import { isAudioReady, testChime, enableNotifications } from './reminders.js';
import { downloadIcs, icsIsCurrent } from './ics.js';
import { speakReminder } from './voice.js';

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * Current status of each channel.
 * @returns {{ id: string, title: string, ok: boolean, optional?: boolean, detail: string, action?: { label: string, run: () => void | Promise<void> } }[]}
 */
export function healthChecks() {
  const profile = currentProfile();
  const s = getSettings();
  const notifSupported = 'Notification' in window;
  const perm = notifSupported ? Notification.permission : 'unsupported';
  const hasMeds = state.medicines.some((m) => m.active);

  return [
    {
      id: 'sound',
      title: 'Alarm sound',
      ok: isAudioReady(),
      detail: isAudioReady() ? 'Ready to ring' : 'Needs one tap after opening',
      action: { label: 'Test sound', run: () => { testChime(); setTimeout(emit, 300); } },
    },
    {
      id: 'voice',
      title: 'Spoken reminder',
      ok: s.voice,
      detail: s.voice ? `On · ${profile?.language === 'hi' ? 'Hindi' : 'English'}` : 'Off',
      action: s.voice
        ? { label: 'Play', run: () => speakReminder(profile, [state.medicines.find((m) => m.active) ?? { name: 'Metformin', dose_qty: 1, form: 'tablet', meal: 'after' }], undefined, { force: true }) }
        : { label: 'Turn on', run: () => { setSettings({ voice: true }); emit(); } },
    },
    {
      id: 'notify',
      title: 'Notifications',
      ok: perm === 'granted',
      optional: perm === 'unsupported',
      detail: { granted: 'Allowed', default: 'Not allowed yet', denied: 'Blocked in browser settings', unsupported: 'Not supported here' }[perm],
      action: perm === 'default' ? { label: 'Allow', run: async () => { await enableNotifications(); emit(); } } : undefined,
    },
    {
      id: 'calendar',
      title: 'Calendar alarms',
      ok: hasMeds && icsIsCurrent(profile, state.medicines),
      detail: !hasMeds ? 'Add a medicine first' : icsIsCurrent(profile, state.medicines) ? 'Up to date · rings even if closed' : 'Not added or out of date',
      action: hasMeds ? { label: 'Download', run: () => { downloadIcs(profile, state.medicines); toast('Open the file to add the alarms'); emit(); } } : undefined,
    },
    {
      id: 'install',
      title: 'Home-screen app',
      ok: isInstalled(),
      optional: true,
      detail: isInstalled() ? 'Installed' : installPrompt ? 'Opens in one tap, like an app' : 'Browser menu → Add to Home screen',
      action: !isInstalled() && installPrompt
        ? { label: 'Install', run: async () => { installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; emit(); } }
        : undefined,
    },
  ];
}

/** Counts used by the Today chip (optional channels don't count against you). */
export function healthSummary() {
  const core = healthChecks().filter((c) => !c.optional);
  return { ready: core.filter((c) => c.ok).length, total: core.length };
}

/** The full card for the Family & safety screen. */
export function healthCard() {
  const { ready, total } = healthSummary();
  return el('section', { className: 'card', attrs: { id: 'health-card' } }, [
    el('div', { className: 'card__head' }, [icon('bell'), el('h3', { text: 'Reminder check' }), el('span', { className: `chip ${ready === total ? 'chip--ok' : 'chip--due'}`, text: `${ready}/${total}` })]),
    el('ul', { className: 'checks' }, healthChecks().map((c) => {
      const btn = c.action && el('button', { className: 'btn btn--outline btn--sm', text: c.action.label, attrs: { type: 'button' } });
      btn?.addEventListener('click', () => c.action.run());
      return el('li', { className: `check ${c.ok ? 'check--ok' : c.optional ? 'check--opt' : 'check--bad'}` }, [
        el('span', { className: 'check__dot', attrs: { 'aria-hidden': 'true' } }, [icon(c.ok ? 'check' : c.optional ? 'skip' : 'warn')]),
        el('div', { className: 'check__text' }, [el('strong', { text: c.title }), el('span', { text: c.detail })]),
        btn || '',
      ]);
    })),
  ]);
}
