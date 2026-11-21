/**
 * Spoken reminders: natural ElevenLabs voice (Hindi or English) through our
 * /api/tts, with the browser's built-in speech as an automatic fallback.
 *
 * Why: many elders can't read small text, and a familiar language matters.
 * Why a fallback: the voice must still speak if the network or the voice
 * service is down at dose time.
 */
import { reminderText } from './voiceText.js';
import { getAccessToken } from './supabaseClient.js';
import { getSettings } from './settings.js';
import { setLoading } from './ui.js';

/** text -> object URL of the mp3, so repeat reminders don't cost another API call. */
const audioCache = new Map();
let currentAudio = null;

/** Browser speech fallback. */
function speakWithBrowser(text, lang) {
  if (!('speechSynthesis' in window)) return false;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  utter.rate = 0.9;
  const voices = speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang?.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en-in'))
    ?? voices.find((v) => v.lang?.toLowerCase().startsWith(lang));
  if (match) utter.voice = match;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
  return true;
}

/** Ask our server for ElevenLabs audio. Resolves to an object URL or throws. */
async function fetchVoice(payload, text) {
  if (audioCache.has(text)) return audioCache.get(text);
  const token = await getAccessToken();
  if (!token) throw new Error('No session');
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) throw new Error(`TTS ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  audioCache.set(text, url);
  return url;
}

/**
 * Speak a reminder for one or more medicines.
 * @param {{ name?: string, language?: string } | null} profile
 * @param {{ name: string, dose_qty: number, form: string, meal: string }[]} meds
 * @param {HTMLButtonElement} [button] optional button to show a loading state on
 * @param {{ force?: boolean }} [opts] force: speak even when voice is switched off (manual test)
 */
export async function speakReminder(profile, meds, button, { force = false } = {}) {
  if (!force && !getSettings().voice) return;
  const lang = profile?.language === 'hi' ? 'hi' : 'en';
  const payload = {
    lang,
    person: (profile?.name ?? '').slice(0, 40),
    medicines: meds.slice(0, 3).map((m) => ({
      name: m.name.slice(0, 60), qty: Number(m.dose_qty) || 1, form: m.form, meal: m.meal,
      ...(m.kept_at ? { place: m.kept_at.slice(0, 60) } : {}),
    })),
  };
  const text = reminderText(payload);
  if (button) setLoading(button, true, 'Speaking…');
  try {
    const url = await fetchVoice(payload, text);
    currentAudio?.pause();
    currentAudio = new Audio(url);
    await currentAudio.play();
  } catch (err) {
    console.info('[voice] using browser voice:', err?.message);
    speakWithBrowser(text, lang);
  } finally {
    if (button) setLoading(button, false);
  }
}
