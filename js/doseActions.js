/**
 * Dose actions shared by the Today screen, the alarm and one-tap mode.
 *
 * Why its own module: three different screens let an elder confirm a dose, and
 * they must all behave identically (same Undo, same double-dose message).
 */
import { toast, showBanner, formatTime, formatClock } from './ui.js';
import { state, logDose, undoDose } from './state.js';
import { DuplicateDoseError } from './store.js';
import { dosesForDay, doseStatus } from './schedule.js';

/** Today's doses for the selected person, each with its live status. */
export function todayDoses(now = new Date()) {
  return dosesForDay(state.medicines, now).map((d) => ({ ...d, status: doseStatus(d, state.logIndex, now) }));
}

/**
 * Log a dose as taken or skipped and offer Undo.
 * @param {{ med: any, iso: string, time: string }} dose
 * @param {'taken' | 'skipped'} status
 * @param {HTMLButtonElement} [button]
 * @returns {Promise<boolean>} true when saved
 */
export async function takeOrSkip(dose, status, button) {
  if (button) button.disabled = true;
  try {
    const log = await logDose(dose, status);
    toast(status === 'taken' ? `${dose.med.name} marked as taken at ${formatClock(log.logged_at)}.` : `${dose.med.name} skipped.`, {
      label: 'Undo',
      onClick: () => undoDose(log).catch((e) => showBanner('error', e.message)),
    });
    return true;
  } catch (err) {
    if (err instanceof DuplicateDoseError) {
      showBanner('warn', `${dose.med.name} for ${formatTime(dose.time)} was already logged. No need to take it again.`);
    } else {
      showBanner('error', err.message || 'Something went wrong. Please try again.');
    }
    return false;
  } finally {
    if (button && button.isConnected) button.disabled = false;
  }
}
