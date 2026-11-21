/**
 * Spoken reminder text, shared by the browser (fallback voice) and /api/tts.
 *
 * Why shared and template-based: the server only ever speaks sentences built
 * from this template with validated fields, so nobody can use our ElevenLabs key
 * to synthesise arbitrary text. The browser fallback says exactly the same words.
 */

export const VOICE_LANGS = ['en', 'hi'];
export const VOICE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'inhaler', 'other'];
export const VOICE_MEALS = ['before', 'after', 'with', 'any'];

const UNIT = {
  en: {
    tablet: ['tablet', 'tablets'],
    capsule: ['capsule', 'capsules'],
    syrup: ['ml', 'ml'],
    injection: ['injection', 'injections'],
    drops: ['drop', 'drops'],
    inhaler: ['puff', 'puffs'],
    other: ['dose', 'doses'],
  },
  hi: {
    tablet: ['गोली', 'गोलियाँ'],
    capsule: ['कैप्सूल', 'कैप्सूल'],
    syrup: ['मिलीलीटर', 'मिलीलीटर'],
    injection: ['इंजेक्शन', 'इंजेक्शन'],
    drops: ['बूंद', 'बूंदें'],
    inhaler: ['पफ़', 'पफ़'],
    other: ['खुराक', 'खुराक'],
  },
};
const MEAL = {
  en: { before: 'before food', after: 'after food', with: 'with food', any: '' },
  hi: { before: 'खाने से पहले', after: 'खाने के बाद', with: 'खाने के साथ', any: '' },
};

/** "½" reads badly in TTS; say "half". */
function qtyWords(qty, lang) {
  if (qty === 0.5) return lang === 'hi' ? 'आधी' : 'half a';
  return String(qty);
}

/**
 * Build the reminder sentence.
 * @param {{ lang: 'en' | 'hi', person: string, medicines: { name: string, qty: number, form: string, meal: string, place?: string }[] }} input
 * @returns {string}
 */
export function reminderText({ lang, person, medicines }) {
  const L = VOICE_LANGS.includes(lang) ? lang : 'en';
  const parts = medicines
    .map((m) => {
      const forms = UNIT[L][m.form] ?? UNIT[L].other;
      const unit = m.qty === 1 || m.qty === 0.5 ? forms[0] : forms[1];
      const meal = MEAL[L][m.meal] ?? '';
      return L === 'hi'
        ? [m.name, `${qtyWords(m.qty, L)} ${unit}`, meal].filter(Boolean).join(', ')
        : `${qtyWords(m.qty, L)} ${unit} of ${m.name}${meal ? `, ${meal}` : ''}`;
    })
    .map((text, i) => {
      const place = medicines[i].place;
      if (!place) return text;
      return L === 'hi' ? `${text}। यह ${place} में रखी है` : `${text}. It is kept at ${place}`;
    });
  if (L === 'hi') {
    return `${person ? `${person}, ` : ''}दवाई का समय हो गया है। ${parts.join('। फिर, ')}।`;
  }
  return `${person ? `${person}, ` : ''}it is time for your medicine. ${parts.join('. Then, ')}.`;
}
