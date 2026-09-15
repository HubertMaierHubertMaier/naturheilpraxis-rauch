// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createLocalBrowserOcrWorker } from "../lib/localBrowserOcr";
const assets = vi.hoisted(() => ({ load: vi.fn(async () => new Uint8Array(64)) }));
vi.mock("../lib/localOcrAssets", () => ({ loadLocalOcrLanguageAsset: assets.load }));
afterEach(() => { vi.unstubAllGlobals(); assets.load.mockClear(); });
it("passes already-fetched language bytes to the worker and initializes by language codes", async () => {
  const jobs: any[] = []; const terminate = vi.fn();
  class WorkerStub {
    onmessage: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    terminate = terminate;
    postMessage(job: any) { jobs.push(job); queueMicrotask(() => this.onmessage?.({ data: { jobId: job.jobId, status: "resolve", data: {} } })); }
  }
  vi.stubGlobal("Worker", WorkerStub);
  const worker = await createLocalBrowserOcrWorker();
  expect(assets.load).toHaveBeenCalledTimes(2);
  const languages = jobs.find(job => job.action === "loadLanguage").payload;
  expect(languages.langs.map((lang: any) => lang.code)).toEqual(["deu", "eng"]);
  expect(languages.langs.every((lang: any) => lang.data instanceof Uint8Array && lang.data.byteLength === 64)).toBe(true);
  expect(jobs.find(job => job.action === "initialize").payload.langs).toEqual(["deu", "eng"]);
  await worker.terminate(); expect(terminate).toHaveBeenCalledOnce();
});
