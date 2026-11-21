// @vitest-environment jsdom
/**
 * Automated accessibility audit with axe-core (the engine behind Lighthouse's
 * accessibility score) on the real pages: the home page, the app shell with
 * the Today screen filled in, and the read-only family page.
 *
 * Colour contrast needs real layout, which a simulated browser doesn't have,
 * so that one rule is checked separately (the palette's text pairs are WCAG AA).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import axe from 'axe-core';

const page = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

/** Load a page's HTML into the simulated document. */
function load(file) {
  const html = page(file);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.lang = doc.documentElement.lang;
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

async function audit(context = document) {
  const { violations } = await axe.run(context, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
}

describe('home page', () => {
  beforeAll(() => load('index.html'));
  it('has no axe violations', async () => { expect(await audit()).toEqual([]); });
  it('declares the language, a title, one h1 and a skip link', () => {
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toMatch(/Dawai Dost/);
    expect(document.querySelectorAll('#landing h1')).toHaveLength(1);
    expect(document.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main');
  });
  it('marks Hindi text so screen readers pronounce it correctly', () => {
    for (const node of document.querySelectorAll('#landing *')) {
      if (/[ऀ-ॿ]/.test(node.textContent) && node.children.length === 0 && node.tagName !== 'IMG') {
        expect(node.closest('[lang="hi"]'), node.outerHTML.slice(0, 80)).not.toBeNull();
      }
    }
  });
});

describe('app shell with the Today screen', () => {
  beforeAll(async () => {
    load('index.html');
    const { store } = await import('../js/store.js');
    const { MemoryBackend } = await import('../js/storeLocal.js');
    const { state, loadAll } = await import('../js/state.js');
    const { buildDemoData } = await import('../js/demoData.js');
    const { renderToday } = await import('../js/todayView.js');
    store.backend = new MemoryBackend({ profiles: [], medicines: [], logs: [], links: [] }, null);
    await store.importAll(buildDemoData());
    state.profileId = null;
    await loadAll();
    document.getElementById('landing').hidden = true;
    document.getElementById('app').hidden = false;
    renderToday(document.getElementById('panel-today'));
  });
  it('has no axe violations', async () => { expect(await audit(document.getElementById('app'))).toEqual([]); });
});

describe('family (caregiver) page', () => {
  beforeAll(() => load('caregiver.html'));
  it('has no axe violations', async () => { expect(await audit()).toEqual([]); });
});
