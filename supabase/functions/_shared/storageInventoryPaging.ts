type Entry = { name: string; id?: string | null; metadata?: Record<string, unknown> | null; created_at?: string };
type StorageList = { list: (prefix: string, options: { limit: number; offset: number; sortBy: { column: "name"; order: "asc" } }) => PromiseLike<{ data: Entry[] | null; error: unknown }> };

export async function listCompleteStoragePrefix(storage: StorageList, prefix: string, pageSize = 200): Promise<Entry[]> {
  const result: Entry[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await storage.list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !Array.isArray(data)) throw new Error("Originalarchiv konnte nicht vollständig aufgelistet werden.");
    const before = seen.size;
    for (const entry of data) {
      if (!entry?.name || /[/\\]/.test(entry.name) || entry.name === "." || entry.name === "..") throw new Error("Ungültiger Eintrag im Originalarchiv.");
      if (!seen.has(entry.name)) { seen.add(entry.name); result.push(entry); }
    }
    if (data.length < pageSize) return result;
    if (seen.size === before) throw new Error("Die Auflistung des Originalarchivs macht keinen Fortschritt.");
  }
}
