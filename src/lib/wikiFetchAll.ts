/** Loads every row page by page (server caps single responses, typically at 1000 rows). */
export const WIKI_PAGE_SIZE = 1000;

export interface PageResult { data: unknown[] | null; error: { message: string } | null }

export async function fetchAllPages(page: (from: number, to: number) => PromiseLike<PageResult>, size = WIKI_PAGE_SIZE): Promise<PageResult> {
  const data: unknown[] = [];
  for (let from = 0; ; from += size) {
    const r = await page(from, from + size - 1);
    if (r.error) return { data: null, error: r.error };
    const rows = r.data ?? [];
    data.push(...rows);
    if (rows.length < size) return { data, error: null };
  }
}

/** Distinguishes a missing table from a permission problem; never exposes raw server details. */
export function classifyWikiError(message: string): "missing" | "forbidden" | "other" {
  if (/does not exist|schema cache|could not find/i.test(message)) return "missing";
  if (/permission denied|not allowed|row-level security|42501|jwt|unauthori[sz]ed/i.test(message)) return "forbidden";
  return "other";
}

export const wikiErrorText = (message: string) => ({
  missing: "Diese Datentabelle ist noch nicht verfügbar.",
  forbidden: "Keine Berechtigung – nur Admins können diese Wissensdaten lesen.",
  other: "Die Daten konnten nicht geladen werden. Bitte später erneut versuchen.",
})[classifyWikiError(message)];
