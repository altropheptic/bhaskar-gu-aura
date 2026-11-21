/**
 * Per-device preferences: senior XL text and voice on/off (the app is light-only).
 *
 * Why localStorage: these are conveniences for the person holding this phone,
 * not health data, so they never need to leave the device.
 */
const KEY = 'dawai-dost-settings';
const DEFAULTS = { size: 'normal', voice: true };

/** @returns {{ size: 'normal' | 'xl', voice: boolean }} */
export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

/** @param {Partial<ReturnType<typeof getSettings>>} patch */
export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  applySettings(next);
  return next;
}

/** Reflect settings on <html> so CSS tokens switch instantly. The app is light-only by design. */
export function applySettings(s = getSettings()) {
  const root = document.documentElement;
  if (s.size === 'xl') root.dataset.size = 'xl';
  else root.removeAttribute('data-size');
}
