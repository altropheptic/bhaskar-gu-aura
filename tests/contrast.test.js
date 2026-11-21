/**
 * Colour contrast, read straight from the design tokens in css/styles.css.
 * axe can't measure contrast without real layout, so this checks every
 * text/background pair the UI uses against WCAG 2.2 AA:
 * 4.5:1 for normal text, 3:1 for large text and UI parts (borders, icons).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const token = (name) => {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};

/** WCAG relative luminance and contrast ratio. */
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['on-primary', 'primary'],
  ['on-lime', 'lime'],
  ['on-lime', 'lime-soft'],
  ['on-accent', 'accent'],
  ['ink', 'accent-soft'],
  ['ok', 'ok-soft'],
  ['ok', 'surface'],
  ['danger', 'danger-soft'],
  ['danger', 'surface'],
  ['brand', 'surface'],
];
const UI_PAIRS = [
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['accent-line', 'surface'],
  ['accent-line', 'accent-soft'],
  ['accent-line', 'bg'],
];

describe('WCAG AA contrast of the palette', () => {
  it.each(TEXT_PAIRS)('text --%s on --%s is at least 4.5:1', (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(UI_PAIRS)('UI part --%s on --%s is at least 3:1', (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });
});
