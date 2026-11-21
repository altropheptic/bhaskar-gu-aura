/**
 * UI helpers: the single place that turns data into DOM.
 *
 * Why: every piece of untrusted text (user input, AI output, database rows) goes
 * through `el()` and `textContent`, so XSS cannot slip in through a stray
 * `innerHTML`. Banners, toasts and loading states also live here, so every async
 * action looks and behaves the same way and nothing fails silently.
 */

/**
 * Create an element safely. Text always goes through `textContent`.
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string | number | boolean>, on?: Record<string, EventListener> }} [options]
 * @param {(Node | string | null | false | undefined)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs, on } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const [type, handler] of Object.entries(on ?? {})) node.addEventListener(type, handler);
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An icon from the inline sprite in index.html (`<symbol id="i-…">`).
 * @param {string} name  e.g. "check", "pill-round"
 * @param {string} [className]
 * @returns {SVGSVGElement}
 */
export function icon(name, className = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/**
 * Pill icon in the medicine's own colour and shape, so elders recognise it on sight.
 * @param {{ color?: string, shape?: string }} med
 */
export function pillIcon(med) {
  const shape = ['round', 'oval', 'capsule', 'liquid', 'other'].includes(med.shape) ? med.shape : 'round';
  const color = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'brown'].includes(med.color)
    ? med.color
    : 'white';
  return icon(`pill-${shape}`, `pill pill--${color}`);
}

/**
 * Show a banner at the top of the page. Errors stay until dismissed.
 * @param {'error' | 'success' | 'info' | 'warn'} type
 * @param {string} message
 * @param {{ sticky?: boolean, id?: string }} [opts]
 */
export function showBanner(type, message, { sticky = false, id } = {}) {
  const region = document.getElementById('banner-region');
  if (!region) return;
  if (id) region.querySelector(`[data-banner-id="${id}"]`)?.remove();
  const close = el('button', {
    className: 'banner__close',
    text: '×',
    attrs: { type: 'button', 'aria-label': 'Dismiss message' },
  });
  const banner = el(
    'div',
    {
      className: `banner banner--${type}`,
      attrs: { role: type === 'error' ? 'alert' : 'status', 'data-banner-id': id ?? false },
    },
    [el('p', { text: message }), close],
  );
  close.addEventListener('click', () => banner.remove());
  region.append(banner);
  if (!sticky && type !== 'error') setTimeout(() => banner.remove(), 7000);
}

/** Remove a banner previously shown with an id. @param {string} id */
export function clearBanner(id) {
  document.querySelector(`#banner-region [data-banner-id="${id}"]`)?.remove();
}

let toastTimer = 0;
/**
 * Short message at the bottom of the screen, optionally with one action (e.g. Undo).
 * @param {string} message
 * @param {{ label: string, onClick: () => void }} [action]
 */
export function toast(message, action) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const node = el('div', { className: 'toast', attrs: { role: 'status' } }, [el('span', { text: message })]);
  if (action) {
    node.append(
      el('button', {
        text: action.label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            node.remove();
            action.onClick();
          },
        },
      }),
    );
  }
  document.body.append(node);
  toastTimer = window.setTimeout(() => node.remove(), action ? 8000 : 4000);
}

/**
 * Put a button into (or out of) a loading state with an accessible spinner.
 * @param {HTMLButtonElement} button
 * @param {boolean} isLoading
 * @param {string} [loadingText]
 */
export function setLoading(button, isLoading, loadingText = 'Working…') {
  if (isLoading) {
    button.dataset.label = button.textContent ?? '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.replaceChildren(
      el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }),
      document.createTextNode(` ${loadingText}`),
    );
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = button.dataset.label ?? button.textContent;
  }
}

/**
 * Standard dialog chrome: title + close button + body. Returns the body to fill.
 * @param {HTMLDialogElement} dialog
 * @param {string} title
 * @param {string} titleId
 * @returns {HTMLElement} body container
 */
export function openDialog(dialog, title, titleId) {
  const close = el(
    'button',
    {
      className: 'dialog__close',
      attrs: { type: 'button', 'aria-label': 'Close' },
      on: { click: () => dialog.close() },
    },
    [icon('cross')],
  );
  const body = el('div');
  dialog.replaceChildren(
    el('div', { className: 'dialog__inner' }, [
      el('div', { className: 'dialog__head' }, [el('h2', { text: title, attrs: { id: titleId } }), close]),
      body,
    ]),
  );
  if (!dialog.open) dialog.showModal();
  return body;
}

/**
 * Friendly empty state with an optional call to action.
 * @param {string} message
 * @param {{ label: string, onClick: () => void }} [action]
 */
export function emptyState(message, action) {
  return el('div', { className: 'empty-state' }, [
    el('p', { text: message }),
    action &&
      el('button', {
        className: 'btn btn--primary',
        text: action.label,
        attrs: { type: 'button' },
        on: { click: action.onClick },
      }),
  ]);
}

/** "8:00 AM" from "08:00" using the user's locale. @param {string} hhmm */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "8:04 AM" from a Date or ISO string. @param {Date | string} value */
export function formatClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Human labels shared by several views. */
export const MEAL_LABEL = { before: 'Before food', after: 'After food', with: 'With food', any: 'Any time' };
export const FORM_UNIT = {
  tablet: 'tablet',
  capsule: 'capsule',
  syrup: 'ml',
  injection: 'injection',
  drops: 'drops',
  inhaler: 'puff',
  other: 'dose',
};

/** "1 tablet", "2 tablets", "5 ml". @param {{ dose_qty: number, form: string }} med */
export function doseLabel(med) {
  const unit = FORM_UNIT[med.form] ?? 'dose';
  const qty = Number(med.dose_qty);
  const plural = qty !== 1 && !['ml', 'drops'].includes(unit) ? 's' : '';
  return `${qty === 0.5 ? '½' : qty} ${unit}${plural}`;
}

/**
 * Split a locale time into the number and the AM/PM part so the number can be
 * shown huge and the period small ("10:25" + "AM"). 24-hour locales get no period.
 * @param {string} hhmm
 */
export function timeParts(hhmm) {
  const text = formatTime(hhmm);
  const m = text.match(/^(\d{1,2}[:.]\d{2})\s*(.*)$/);
  return m ? { main: m[1], period: m[2] } : { main: text, period: '' };
}

/** Element showing a time with a small AM/PM, e.g. <p class="next__time">10:25<small>AM</small></p>. */
export function timeEl(tag, className, hhmm) {
  const { main, period } = timeParts(hhmm);
  return el(tag, { className }, [main, period && el('small', { text: period })]);
}

const TINTS = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'brown'];
/** CSS tint class for a medicine colour (drives pastel card backgrounds). */
export function tintClass(color) {
  return `tint--${TINTS.includes(color) ? color : 'white'}`;
}

/** Stable pastel for a person's avatar, derived from their name. */
export function avatarTint(name = '') {
  const options = ['pink', 'blue', 'yellow', 'green', 'orange', 'brown'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `tint--${options[h % options.length]}`;
}
