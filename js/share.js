/**
 * Keeping family in the loop: WhatsApp summary + private caregiver links.
 *
 * Why: about half of older adults on several medicines miss doses, and family
 * help is a key support. Many caregivers live in another city, so we make
 * checking in easy.
 *
 * Caregiver link security: the token is 24 random bytes from the browser's
 * crypto RNG. Only its SHA-256 hash is stored in the database, so even a
 * database leak doesn't reveal working links. Links expire and can be revoked.
 */
import { formatTime } from './ui.js';
import { store } from './store.js';

/** WhatsApp-friendly text for today's status. */
export function todaySummaryText(profile, doses) {
  const taken = doses.filter((d) => d.status === 'taken');
  const missed = doses.filter((d) => d.status === 'missed');
  const skipped = doses.filter((d) => d.status === 'skipped');
  const left = doses.filter((d) => d.status === 'due' || d.status === 'upcoming');
  const date = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const lines = [`Dawai Dost update for ${profile.name} (${date})`, `Taken: ${taken.length} of ${doses.length}`];
  if (missed.length) lines.push(`Missed: ${missed.map((d) => `${d.med.name} ${formatTime(d.time)}`).join(', ')}`);
  if (skipped.length) lines.push(`Skipped: ${skipped.map((d) => d.med.name).join(', ')}`);
  if (left.length) lines.push(`Still to come: ${left.map((d) => `${d.med.name} ${formatTime(d.time)}`).join(', ')}`);
  if (!missed.length && !left.length) lines.push('All medicines done for today.');
  return lines.join('\n');
}

/** Open WhatsApp (app or web) with the summary ready to send. */
export function shareOnWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function base64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 hex digest. @param {string} text */
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a caregiver link for a profile. The raw URL is returned once and never stored.
 * @param {string} profileId
 * @param {string} label  e.g. "Priya"
 * @returns {Promise<{ url: string, link: any }>}
 */
export async function createCaregiverLink(profileId, label) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const link = await store.createLink({ profile_id: profileId, token_hash: await sha256Hex(token), label: label.slice(0, 40) });
  return { url: `${location.origin}/caregiver.html?t=${token}`, link };
}
