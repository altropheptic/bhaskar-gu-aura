/**
 * Alarm engine: rings, shows and speaks a reminder when a dose time arrives.
 *
 * How: a light 20-second tick compares today's schedule with the clock. When a
 * dose reaches its time and isn't logged, it opens the alarm dialog, plays a
 * chime (Web Audio, no sound file needed), speaks the reminder and, if the tab
 * is in the background, shows a system notification.
 *
 * Honest limitation (documented in the README): browsers only run this while the
 * page is open. For alarms with the browser closed, users export the schedule to
 * their phone calendar (ics.js), which is reliable even on iPhone.
 */
import { el, icon, pillIcon, formatTime, doseLabel, MEAL_LABEL } from './ui.js';
import { currentProfile, state } from './state.js';
import { todayDoses, takeOrSkip } from './doseActions.js';
import { speakReminder } from './voice.js';
import { MISSED_AFTER_MIN, isoDate } from './schedule.js';
import { medMedia } from './photo.js';

const SNOOZE_MIN = 10;
const firedKey = () => `dawai-dost-fired-${isoDate(new Date())}`;
/** dose keys we've already alarmed for today (survives reloads within the tab) */
let fired = new Set();
/** dose key -> epoch ms when the snooze ends */
const snoozed = new Map();
let audioCtx = null;
let chimeTimer = 0;
let timer = 0;

function loadFired() {
  try { fired = new Set(JSON.parse(sessionStorage.getItem(firedKey()) ?? '[]')); } catch { fired = new Set(); }
}
function saveFired() {
  try { sessionStorage.setItem(firedKey(), JSON.stringify([...fired])); } catch { /* ignore */ }
}

/** Browsers only allow sound after a user gesture, so unlock audio on the first tap. */
function unlockAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx) audioCtx = new Ctx();
}

/** A soft two-note chime (marigold bell), generated in code. */
function chime() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t0 = audioCtx.currentTime;
  [659.25, 880].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t0 + i * 0.35;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 1.2);
  });
}

function stopChime() {
  clearInterval(chimeTimer);
  chimeTimer = 0;
}

/** System notification when the tab is in the background (if the user allowed it). */
async function notify(profile, doses) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const title = `Time for ${doses.map((d) => d.med.name).join(', ')}`;
  const body = `${profile?.name ?? ''} · ${formatTime(doses[0].time)} · ${MEAL_LABEL[doses[0].med.meal] ?? ''}`.trim();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icon-192.png', tag: doses[0].key, requireInteraction: true });
    else new Notification(title, { body, icon: '/icon-192.png', tag: doses[0].key });
  } catch { /* notifications blocked */ }
}

/** Open the alarm dialog for a group of doses that are due at the same time. */
function ring(doses) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('alarm-dialog'));
  const profile = currentProfile();
  const close = () => { stopChime(); dialog.close(); };

  const takeAll = el('button', { className: 'btn btn--primary btn--xl btn--block', attrs: { type: 'button' } }, [icon('check'), doses.length > 1 ? 'I took them all' : 'I took it']);
  takeAll.addEventListener('click', async () => {
    takeAll.disabled = true;
    for (const d of doses) await takeOrSkip(d, 'taken');
    close();
  });
  const snooze = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('clock'), `${SNOOZE_MIN} min`]);
  snooze.addEventListener('click', () => {
    for (const d of doses) { snoozed.set(d.key, Date.now() + SNOOZE_MIN * 60_000); fired.delete(d.key); }
    saveFired();
    close();
  });
  const again = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('speaker'), 'Repeat']);
  again.addEventListener('click', () => speakReminder(profile, doses.map((d) => d.med), again, { force: true }));

  dialog.replaceChildren(el('div', { className: 'dialog__inner' }, [
    el('div', { className: 'alarm__ring' }, [icon('bell')]),
    el('h2', { text: `${profile?.name ?? ''}, it's medicine time`.replace(/^, /, ''), attrs: { id: 'alarm-title' } }),
    el('p', { className: 'muted', text: formatTime(doses[0].time) }),
    el('ul', { className: 'alarm__meds' }, doses.map((d) => el('li', {}, [
      medMedia(d.med, 'med-media--lg'),
      el('div', {}, [
        el('strong', { text: [d.med.name, d.med.dosage].filter(Boolean).join(' ') }),
        el('div', { className: 'muted', text: `${doseLabel(d.med)} · ${MEAL_LABEL[d.med.meal] ?? ''}` }),
        d.med.kept_at && el('div', { className: 'tile__place' }, [icon('pin'), d.med.kept_at]),
      ]),
    ]))),
    takeAll,
    el('div', { className: 'alarm__row' }, [snooze, again]),
  ]));
  dialog.addEventListener('close', stopChime, { once: true });
  if (!dialog.open) dialog.showModal();

  chime();
  stopChime();
  let count = 0;
  chimeTimer = window.setInterval(() => { count += 1; if (count > 5) stopChime(); else chime(); }, 7000);
  speakReminder(profile, doses.map((d) => d.med));
  notify(profile, doses);
}

/** Check the clock against today's schedule. */
function tick() {
  if (!state.profileId || !state.medicines.length) return;
  const alarmOpen = document.getElementById('alarm-dialog')?.open;
  if (alarmOpen) return;
  const now = Date.now();
  const due = todayDoses().filter((d) => {
    if (d.status !== 'due') return false;
    const late = (now - d.at.getTime()) / 60_000;
    if (late < 0 || late > MISSED_AFTER_MIN) return false; // only from the exact time onwards
    if ((snoozed.get(d.key) ?? 0) > now) return false;
    return !fired.has(d.key);
  });
  if (!due.length) return;
  const firstTime = due[0].time;
  const group = due.filter((d) => d.time === firstTime);
  for (const d of group) fired.add(d.key);
  saveFired();
  ring(group);
}

/** Start the alarm engine (idempotent). */
export function startReminders() {
  if (timer) return;
  loadFired();
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  timer = window.setInterval(tick, 20_000);
  setTimeout(tick, 1500);
}

/** Ask permission for system notifications (must be called from a click). */
export async function enableNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  unlockAudio();
  return Notification.requestPermission();
}

/** True once the browser allows the alarm to make sound (after a tap). */
export function isAudioReady() {
  return Boolean(audioCtx && audioCtx.state === 'running');
}

/** Play a test alarm sound (from a click, which also unlocks audio). */
export function testChime() {
  unlockAudio();
  chime();
}
