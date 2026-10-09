import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Blob as NativeBlob, File as NativeFile } from "node:buffer";
import { webcrypto } from "node:crypto";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { BackupCenter } from "@/components/admin/BackupCenter";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
const stats = { generatedAt: "2026-10-09T12:00:00Z", tables: [{ name: "synthetic", rows: 1 }], buckets: [], authUserCount: 0, secrets: [], discovery: { tableSource: "openapi", bucketSource: "api" } };
let created: Blob[];

beforeEach(async () => {
  stats.tables[0].rows = 1;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  localStorage.clear();
  created = [];
  vi.stubGlobal("ArrayBuffer", (await new NativeBlob([]).arrayBuffer()).constructor);
  vi.stubGlobal("Blob", NativeBlob);
  vi.stubGlobal("crypto", webcrypto);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => { created.push(blob); return "blob:synthetic-only"; }) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: "synthetic-only" } }, error: null } as never);
  vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: stats, error: null });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let payload: unknown;
    if (url.includes("mode=stats")) payload = stats;
    else if (url.includes("mode=table-page")) payload = { table: "synthetic", from: 0, rows: [{ id: "synthetic-only" }], total: 1, nextFrom: null };
    else if (url.includes("mode=auth-page")) payload = { page: 1, users: [], total: 0, nextPage: null };
    else if (url.includes("mode=storage-list")) payload = {};
    else throw new Error("Unexpected test request");
    return new Response(JSON.stringify(payload));
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker; });

describe("BackupCenter confirmed saving", () => {
  it("does not count a browser download as saved; confirms the exact downloaded ZIP only after reading it", async () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
    const { container } = render(<BackupCenter />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Schnell-Backup/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Schnell-Backup/ }));
    await screen.findByText("Download gestartet — Dateiprüfung ausstehend", {}, { timeout: 10000 });
    expect(localStorage.getItem("backup:verified:lastDb")).toBeNull();
    expect(created).toHaveLength(1);
    const bytes = await created[0].arrayBuffer();
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    expect(JSON.parse(await zip.file("db/synthetic.json")!.async("string"))).toEqual([{ id: "synthetic-only" }]);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new NativeFile([Buffer.from(bytes)], "renamed-download.zip")] } });
    await screen.findByText("ZIP gespeichert und geprüft", {}, { timeout: 10000 });
    expect(localStorage.getItem("backup:verified:lastDb")).not.toBeNull();
  });

  it("stops before data export when folder selection is cancelled", async () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")) });
    render(<BackupCenter />);
    fireEvent.click(screen.getByRole("button", { name: /Jetzt komplett sichern/ }));
    await waitFor(() => expect((window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker).toHaveBeenCalledOnce());
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem("backup:verified:lastFull")).toBeNull();
    expect(localStorage.getItem("backup:lastFull")).toBeNull();
  });

  it("does not turn old unverified download timestamps into a green backup status", async () => {
    localStorage.setItem("backup:lastFull", new Date().toISOString());
    localStorage.setItem("backup:lastGithub", new Date().toISOString());
    render(<BackupCenter />);
    await screen.findByText("Sicherung überfällig!");
    expect(localStorage.getItem("backup:verified:lastFull")).toBeNull();
  });

  it("rejects overlapping rows even if the returned row count is correct", async () => {
    stats.tables[0].rows = 2;
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      const payload = url.includes("mode=stats") ? stats : { table: "synthetic", from: 0, rows: [{ id: "same" }, { id: "same" }], total: 2, nextFrom: null };
      return new Response(JSON.stringify(payload));
    });
    render(<BackupCenter />);
    fireEvent.click(screen.getByRole("button", { name: /Schnell-Backup/ }));
    await screen.findByText("Backup fehlgeschlagen", {}, { timeout: 10000 });
    expect(created).toHaveLength(0);
    expect(localStorage.getItem("backup:verified:lastDb")).toBeNull();
  });
});
