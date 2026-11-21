/**
 * Screens and features that load on demand.
 *
 * Why: the first screen only needs Today. The medicine form, profile dialog,
 * one-tap mode, print views and the AI explainer are opened occasionally, so
 * they are split into separate chunks and fetched the first time they are used.
 * prefetchScreens() then warms them while the browser is idle, so they open
 * instantly and the service worker has them cached for offline use.
 */
import { showBanner } from './ui.js';

const failed = () => showBanner('error', 'Could not open that. Please check your connection and try again.');

/**
 * Wrap a module export so calling it loads the module first.
 * @param {() => Promise<any>} load
 * @param {string} name  export to call
 */
const onDemand = (load, name) => (...args) => load().then((m) => m[name](...args), failed);

const medForm = () => import('./medForm.js');
const profileDialog = () => import('./profileDialog.js');
const oneTap = () => import('./oneTap.js');
const reports = () => import('./reports.js');
const ai = () => import('./ai.js');

export const openMedicineDialog = onDemand(medForm, 'openMedicineDialog');
export const openProfileDialog = onDemand(profileDialog, 'openProfileDialog');
export const openOneTap = onDemand(oneTap, 'openOneTap');
export const printDoctorReport = onDemand(reports, 'printDoctorReport');
export const printEmergencyCard = onDemand(reports, 'printEmergencyCard');

/** AI explainer: errors are passed to the caller, which shows its own message. */
export const explainWithAi = (...args) => ai().then((m) => m.explainWithAi(...args));

/** The sample family, needed only the first time a new account opens the app. */
export const loadDemoData = () => import('./demoData.js').then((m) => m.buildDemoData());

/** Warm every on-demand chunk once the browser is idle. Safe to call more than once. */
let warmed = false;
export function prefetchScreens() {
  if (warmed) return;
  warmed = true;
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  idle(() => { [medForm, profileDialog, oneTap, reports, ai].forEach((load) => load().catch(() => {})); });
}
