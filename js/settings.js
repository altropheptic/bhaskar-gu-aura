/**
 * Per-device preferences: theme, senior XL text, voice on/off.
 *
 * Why localStorage: these are conveniences for the person holding this phone,
 * not health data, so they never need to leave the device.
 */
const KEY = 'dawai-dost-settings';
const DEFAULTS = { theme: 'system', size: 'normal', voice: true };

/** @returns {{ theme: 'system' | 'light' | 'dark', size: 'normal' | 'xl', voice: boolean }} */
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

/** Reflect settings on <html> so CSS tokens switch instantly. */
export function applySettings(s = getSettings()) {
  const root = document.documentElement;
  if (s.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = s.theme;
  if (s.size === 'xl') root.dataset.size = 'xl';
  else root.removeAttribute('data-size');
}
