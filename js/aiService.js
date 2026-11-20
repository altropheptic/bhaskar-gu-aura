/**
 * AI service: the browser's only route to AI.
 *
 * Why: the browser never holds AI credentials. It calls our /api/ai function, which talks
 * to Vercel AI Gateway server-side. If the AI is slow, rate-limited or down, we return a
 * clearly labelled fallback answer so the demo keeps working.
 */
import { DEMO_AI_FALLBACK } from './demoData.js';

export const MAX_PROMPT_CHARS = 2_000;
const TIMEOUT_MS = 75_000; // slightly above the server's 60 s limit

/**
 * @typedef {{ text: string, source: 'ai' | 'fallback', notice?: string }} AIResult
 */

/**
 * Ask the AI a question.
 * @param {string} prompt
 * @returns {Promise<AIResult>}
 * @throws {Error} only for invalid input (shown to the user as a validation message)
 */
export async function askAI(prompt) {
  const clean = String(prompt ?? '').trim();
  if (!clean) throw new Error('Please type a question first.');
  if (clean.length > MAX_PROMPT_CHARS) throw new Error(`Please keep it under ${MAX_PROMPT_CHARS} characters.`);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: clean }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.text === 'string') return { text: data.text, source: 'ai' };
    return { text: DEMO_AI_FALLBACK, source: 'fallback', notice: data.error ?? `AI request failed (HTTP ${res.status}).` };
  } catch {
    return { text: DEMO_AI_FALLBACK, source: 'fallback', notice: 'Could not reach the AI service.' };
  }
}
