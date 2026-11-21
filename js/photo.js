/**
 * Medicine photos: shrink a camera photo into a small JPEG data URL.
 *
 * Why so small: the photo only needs to help an elder recognise the strip or
 * box at reminder time. A ~320px thumbnail (~20–40 KB) fits in the medicine row,
 * works in offline/demo mode, and needs no extra storage service or CSP origin
 * (`img-src data:` is already allowed). The database enforces the format and a
 * 90 KB cap as well.
 */
import { PHOTO_MAX, PHOTO_RE, DEMO_PHOTO_RE } from './medSchema.js';
import { el, pillIcon, tintClass } from './ui.js';

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export async function makeThumbnail(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is too large.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Could not read that photo. Try a JPG or PNG.');
  }
  for (const [side, quality] of [
    [360, 0.75],
    [300, 0.65],
    [240, 0.55],
  ]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= PHOTO_MAX && PHOTO_RE.test(url)) {
      bitmap.close?.();
      return url;
    }
  }
  bitmap.close?.();
  throw new Error('That photo could not be shrunk enough. Try another one.');
}

/**
 * Safe <img> for a stored photo (never innerHTML).
 * @param {string} dataUrl
 * @param {string} alt
 * @param {string} [className]
 */
export function photoImg(dataUrl, alt, className = 'med-photo') {
  const img = document.createElement('img');
  if (PHOTO_RE.test(dataUrl) || DEMO_PHOTO_RE.test(dataUrl)) img.src = dataUrl;
  img.alt = alt;
  img.className = className;
  img.decoding = 'async';
  return img;
}

/**
 * The medicine's face: its photo if there is one, otherwise the pill drawn in its
 * real colour and shape, inside a tinted rounded square.
 * @param {any} med
 * @param {'' | 'med-media--lg' | 'med-media--xl'} [size]
 */
export function medMedia(med, size = '') {
  return el('span', { className: `med-media ${tintClass(med.color)} ${size}`.trim() }, [
    med.photo ? photoImg(med.photo, `Photo of ${med.name}`) : pillIcon(med),
  ]);
}
