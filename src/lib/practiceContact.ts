/** Central confirmed practice contact (Peter, 07.10.2026). Use for all Infothek drafts/exports/new HTMLs. */
export const PRACTICE_PHONE_DISPLAY = "0821-2621462";
export const PRACTICE_PHONE_TEL = "tel:+498212621462";
export const PRACTICE_EMAIL = "praxis_rauch@icloud.com";
export const PRACTICE_EMAIL_MAILTO = "mailto:praxis_rauch@icloud.com";

/** Known wrong practice numbers. Only these are replaced; other numbers untouched. */
const WRONG: [RegExp, string][] = [
  [/tel:\+49821217726700\b/g, PRACTICE_PHONE_TEL],
  [/tel:\+4982121772670\b/g, PRACTICE_PHONE_TEL],
  [/tel:\+4982126214620\b/g, PRACTICE_PHONE_TEL],
  [/0821 2177 2670/g, PRACTICE_PHONE_DISPLAY],
  [/0821-21772670/g, PRACTICE_PHONE_DISPLAY],
  [/\+49-821-21772670/g, "+49-821-2621462"],
];

/** Authorized contact correction (not a content decision). Returns corrected html and number of replacements. */
export function applyContactCorrection(html: string): { html: string; count: number } {
  let count = 0;
  for (const [re, to] of WRONG) html = html.replace(re, () => { count++; return to; });
  return { html, count };
}
