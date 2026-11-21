/**
 * Browser client for /api/ai (Google Gemini runs on our server, never here).
 *
 * Why through /api: the Gemini key must never reach the browser. Requests carry
 * the visitor's Supabase session token, so only real app sessions can use the
 * AI. Every caller has a non-AI fallback, so the app keeps working if AI is down.
 */
import { getAccessToken } from './supabaseClient.js';
import { sanitizeAiMedicine } from './medSchema.js';

export class AiUnavailableError extends Error {
  constructor(message = 'The AI assistant is not available right now.') { super(message); this.name = 'AiUnavailableError'; }
}

/** POST to /api/ai with the session token. */
async function callAi(body, timeoutMs = 30000) {
  const token = await getAccessToken();
  if (!token) throw new AiUnavailableError('AI needs an internet connection.');
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AiUnavailableError('Could not reach the AI. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiUnavailableError(typeof data.error === 'string' ? data.error : undefined);
  return data;
}

/**
 * Prescription text -> medicines (validated again here, never trusted blindly).
 * @param {string} text
 */
export async function parseTextWithAi(text) {
  const data = await callAi({ action: 'parseText', text: String(text).slice(0, 1000) });
  return (Array.isArray(data.medicines) ? data.medicines : []).map(sanitizeAiMedicine).filter(Boolean);
}

/** Shrink a photo before upload: faster on mobile data and keeps us under the size cap. */
async function downscale(file, maxSide = 1400) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Photo of a prescription or medicine strip -> medicines.
 * @param {File} file
 */
export async function parsePhotoWithAi(file) {
  if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) {
    throw new AiUnavailableError('Please choose a photo (JPG, PNG or WebP).');
  }
  if (file.size > 15 * 1024 * 1024) throw new AiUnavailableError('That photo is too large.');
  let image;
  try { image = await downscale(file); } catch { throw new AiUnavailableError('Could not read that photo. Try another one.'); }
  const data = await callAi({ action: 'parsePhoto', image, mime: 'image/jpeg' }, 45000);
  return (Array.isArray(data.medicines) ? data.medicines : []).map(sanitizeAiMedicine).filter(Boolean);
}

/**
 * Plain-language explanation of what a medicine is commonly used for.
 * @param {{ name: string, generic_name?: string, dosage?: string }} med
 * @param {'en' | 'hi'} lang
 * @returns {Promise<string>}
 */
export async function explainWithAi(med, lang) {
  const data = await callAi({ action: 'explain', name: med.name, generic_name: med.generic_name ?? '', dosage: med.dosage ?? '', lang });
  if (typeof data.text !== 'string' || !data.text.trim()) throw new AiUnavailableError();
  return data.text.slice(0, 1500);
}
