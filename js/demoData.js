/**
 * Demo dataset for the "Try Instant Demo" button.
 *
 * Why: judges and automated graders must be able to try every feature in one click,
 * without signing up and even if Supabase or the AI is unreachable. This file is the
 * offline source of truth for that experience.
 *
 * TODO(hackathon): replace these placeholder records with realistic data for the
 * problem statement once it is announced.
 */

/** @typedef {{ id: string, title: string, summary: string, tag: string }} DemoItem */

/** @type {DemoItem[]} */
export const DEMO_ITEMS = [
  {
    id: 'demo-1',
    title: 'Sample record one',
    summary: 'Placeholder data. Replaced with real demo content once the problem statement is known.',
    tag: 'demo',
  },
  {
    id: 'demo-2',
    title: 'Sample record two',
    summary: 'Shows how a populated list looks, including longer text that wraps across lines on small screens.',
    tag: 'demo',
  },
  {
    id: 'demo-3',
    title: 'Sample record three',
    summary: 'Every feature should be testable from this data in a single click.',
    tag: 'demo',
  },
];

/** Shown when the live AI is unavailable, so the AI flow never dead-ends. */
export const DEMO_AI_FALLBACK =
  'Demo answer: the live AI model is unavailable right now, so this is a cached example response. ' +
  'Try again in a moment for a real answer.';
