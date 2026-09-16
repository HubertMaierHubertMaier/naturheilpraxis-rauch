const VIEVA_PASSWORD_KEY = "praxis-vieva-pdf-password";

// This is a user-entered local PDF setting, never a bundled password or server field.
export function readVievaPdfPassword(): string {
  try { return localStorage.getItem(VIEVA_PASSWORD_KEY) || ""; } catch { return ""; }
}
export function rememberVievaPdfPassword(value: string): void {
  try {
    if (value) localStorage.setItem(VIEVA_PASSWORD_KEY, value);
    else localStorage.removeItem(VIEVA_PASSWORD_KEY);
  } catch { /* A disabled local store must not prevent the current import. */ }
}

export function inferDocumentDateFromFilename(filename: string): string {
  const source = filename.replace(/P-\d{4}-\d{4}/gi, "");
  const dates = new Set<string>();
  const add = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year >= 1900 && year <= 2099 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      dates.add(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  };
  // Remove the ISO matches before checking German dates to avoid overlapping guesses.
  const remainder = source.replace(/(?<!\d)((?:19|20)\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/g, (match, y, m, d) => {
    add(Number(y), Number(m), Number(d)); return " ".repeat(match.length);
  });
  for (const match of remainder.matchAll(/(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.]((?:19|20)\d{2}|\d{2})(?!\d)/g)) {
    // Four-digit dates are unambiguous; two-digit years use the current/previous century.
    const shortYear = Number(match[3]);
    const year = match[3].length === 4 ? shortYear : shortYear <= new Date().getFullYear() % 100 ? 2000 + shortYear : 1900 + shortYear;
    add(year, Number(match[2]), Number(match[1]));
  }
  return dates.size === 1 ? [...dates][0] : "";
}
