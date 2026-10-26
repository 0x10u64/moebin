/**
 * @template {Element} T
 * @param {string} selector
 * @param {new() => T} type
 * @returns {T}
 */
export function queryElement(selector, type) {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) {
    throw new Error(`Expected ${type} for ${el?.nodeName} "${selector}"`);
  }
  return el;
}
