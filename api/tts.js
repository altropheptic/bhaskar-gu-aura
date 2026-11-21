/**
 * POST /api/tts: natural-voice reminders through ElevenLabs.
 *
 * Request: { lang: 'en'|'hi', person: string, medicines: [{ name, qty, form, meal }] }
 * Response: audio/mpeg
 *
 * Why the server builds the sentence: the browser never sends free text to speak.
 * We validate each field and fill a fixed template (js/voiceText.js), so our
 * ElevenLabs key can't be abused to synthesise arbitrary audio.
 */
import { json, rateLimited, readJson, requireUser, overDailyQuota } from './_lib.js';
import { reminderText, VOICE_LANGS, VOICE_FORMS, VOICE_MEALS } from '../js/voiceText.js';

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const SAFE_NAME = /^[\p{L}\p{M}\p{N} .,+\-()/%']{1,60}$/u;
/** About 25 reminders a day for a dozen medicines, with room for replays. */
const TTS_PER_DAY = 300;
const SAFE_PERSON = /^[\p{L}\p{M}\p{N} .'-]{0,40}$/u;

/** Validate the payload; returns a clean copy or null. */
function validate(body) {
  if (!VOICE_LANGS.includes(body.lang)) return null;
  const person = typeof body.person === 'string' ? body.person.trim() : '';
  if (!SAFE_PERSON.test(person)) return null;
  if (!Array.isArray(body.medicines) || body.medicines.length < 1 || body.medicines.length > 3) return null;
  const medicines = [];
  for (const m of body.medicines) {
    const name = typeof m?.name === 'string' ? m.name.trim() : '';
    const qty = Number(m?.qty);
    if (
      !SAFE_NAME.test(name) ||
      !(qty >= 0.5 && qty <= 20) ||
      !VOICE_FORMS.includes(m.form) ||
      !VOICE_MEALS.includes(m.meal)
    )
      return null;
    const place = typeof m.place === 'string' ? m.place.trim() : '';
    if (place && !SAFE_NAME.test(place)) return null;
    medicines.push({ name, qty, form: m.form, meal: m.meal, ...(place ? { place } : {}) });
  }
  return { lang: body.lang, person, medicines };
}

export async function POST(request) {
  if (rateLimited(request, 'tts', 20)) return json({ error: 'Too many requests.' }, 429);
  const body = await readJson(request, 4000);
  const clean = body && validate(body);
  if (!clean) return json({ error: 'Invalid request.' }, 400);
  const userId = await requireUser(request);
  if (!userId) return json({ error: 'Please reload the page.' }, 401);
  if (overDailyQuota(userId, 'tts', TTS_PER_DAY)) return json({ error: 'Voice limit reached for today.' }, 429);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: 'Voice is not available.' }, 503);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID)}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: reminderText(clean),
          model_id: MODEL_ID,
          voice_settings: { stability: 0.6, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      console.error('[api/tts] ElevenLabs HTTP', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return json({ error: 'Voice is not available.' }, 503);
    }
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' },
    });
  } catch (err) {
    console.error('[api/tts]', err?.message);
    return json({ error: 'Voice is not available.' }, 503);
  }
}
