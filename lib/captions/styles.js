export const MEME_STYLES = /** @type {const} */ ([
  "absurd",
  "corporate",
  "relatable",
  "dramatic",
  "wholesome",
]);

/** @typedef {typeof MEME_STYLES[number]} MemeStyle */

/** @param {string} s */
export function isValidStyle(s) {
  return MEME_STYLES.includes(/** @type {MemeStyle} */ (s));
}

/** @param {string} s @returns {MemeStyle} */
export function normalizeStyle(s) {
  if (s && isValidStyle(s)) return /** @type {MemeStyle} */ (s);
  return "relatable";
}
