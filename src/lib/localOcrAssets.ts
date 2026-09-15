const cachedAssets = new Map<string, Uint8Array>();

/** Fetch public, same-origin OCR program data with bounded retries; never accepts patient data. */
export async function loadLocalOcrLanguageAsset(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const asset = new URL(url, location.href);
  if (asset.origin !== location.origin) throw new Error("OCR-Sprachdaten müssen aus derselben Anwendung stammen.");
  if (signal?.aborted) throw new DOMException("Lokale OCR wurde abgebrochen.", "AbortError");
  const cached = cachedAssets.get(asset.href); if (cached) return cached;
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new DOMException("Lokale OCR wurde abgebrochen.", "AbortError");
    const request = new URL(asset.href);
    if (attempt) request.searchParams.set("ocr_retry", `${Date.now()}-${attempt}`);
    const controller = new AbortController(); const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(request.href, { signal: controller.signal, cache: "reload" });
      lastStatus = response.status;
      if (!response.ok) throw new Error("OCR asset request failed");
      const contentType = response.headers.get("content-type") || "";
      if (/text\/html|application\/json/i.test(contentType)) throw new Error("Unexpected OCR asset content");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 32 || bytes.byteLength > 32 * 1024 * 1024) throw new Error("Unexpected OCR asset size");
      cachedAssets.set(asset.href, bytes); return bytes;
    } catch {
      if (signal?.aborted) throw new DOMException("Lokale OCR wurde abgebrochen.", "AbortError");
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
  }
  throw new Error(`OCR-Sprachdaten konnten nach drei Versuchen nicht geladen werden${lastStatus ? ` (HTTP ${lastStatus})` : ""}. Die Originaldatei wurde nicht verändert.`);
}
