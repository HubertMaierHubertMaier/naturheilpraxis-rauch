// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { loadLocalOcrLanguageAsset } from "../lib/localOcrAssets";
const response = (status: number, contentType = "application/gzip") => ({ ok: status === 200, status, headers: { get: () => contentType }, arrayBuffer: async () => new Uint8Array(64).buffer });
afterEach(() => vi.unstubAllGlobals());
it("retries a transient hosting error and reuses only a successful asset", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(500)).mockResolvedValueOnce(response(200)); vi.stubGlobal("fetch", fetcher);
  const first = await loadLocalOcrLanguageAsset("/assets/local-ocr/test-retry.gz");
  expect(first.byteLength).toBe(64); expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls[1][0]).toContain("ocr_retry=");
  expect(await loadLocalOcrLanguageAsset("/assets/local-ocr/test-retry.gz")).toBe(first); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("bounds repeated failures and never accepts an HTML fallback as language data", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(200, "text/html")); vi.stubGlobal("fetch", fetcher);
  await expect(loadLocalOcrLanguageAsset("/assets/local-ocr/test-html.gz")).rejects.toThrow(/drei Versuchen/); expect(fetcher).toHaveBeenCalledTimes(3);
});
it("does not fetch external assets or start after cancellation", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(loadLocalOcrLanguageAsset("https://unapproved.invalid/model.gz")).rejects.toThrow(/derselben Anwendung/);
  const controller = new AbortController(); controller.abort();
  await expect(loadLocalOcrLanguageAsset("/assets/local-ocr/test-cancel.gz", controller.signal)).rejects.toThrow(/abgebrochen/); expect(fetcher).not.toHaveBeenCalled();
});
