/**
 * UI helpers: the single place that turns data into DOM.
 *
 * Why: every piece of untrusted text (user input, AI output, database rows) is rendered
 * through these helpers with `textContent`, so XSS cannot slip in through a stray
 * `innerHTML`. They also give every async action the same loading / empty / error states.
 */

/**
 * Escape a string for the rare case it must go into HTML markup.
 * Prefer `el()` / `textContent`; use this only when a template string is unavoidable.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Create an element safely: text always goes through `textContent`.
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string> }} [options]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs ?? {})) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

/**
 * Show a dismissible banner at the top of the page.
 * @param {'error' | 'success' | 'info'} type
 * @param {string} message
 */
export function showBanner(type, message) {
  const region = document.getElementById('banner-region');
  if (!region) return;
  const close = el('button', { className: 'banner__close', text: '×', attrs: { type: 'button', 'aria-label': 'Dismiss message' } });
  const banner = el('div', { className: `banner banner--${type}`, attrs: { role: type === 'error' ? 'alert' : 'status' } }, [
    el('p', { text: message }),
    close,
  ]);
  close.addEventListener('click', () => banner.remove());
  region.replaceChildren(banner);
  if (type !== 'error') setTimeout(() => banner.remove(), 6_000);
}

/**
 * Put a button into (or out of) a loading state with an accessible spinner.
 * @param {HTMLButtonElement} button
 * @param {boolean} isLoading
 * @param {string} [loadingText]
 */
export function setLoading(button, isLoading, loadingText = 'Working…') {
  if (isLoading) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.replaceChildren(el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), document.createTextNode(` ${loadingText}`));
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = button.dataset.label ?? button.textContent;
  }
}

/**
 * Replace a container's content with a friendly empty state.
 * @param {HTMLElement} container
 * @param {string} message
 */
export function renderEmptyState(container, message) {
  container.replaceChildren(el('p', { className: 'empty-state', text: message }));
}
