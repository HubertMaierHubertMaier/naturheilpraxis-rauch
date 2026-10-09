import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { fetchGithubCodeArchive } from "../../supabase/functions/_shared/githubCodeArchive";
import { validateCodeBackupZip } from "../lib/validateCodeBackupZip";

const archiveResponse = () => new Response("archive", { headers: { "Content-Type": "application/zip" } });

describe("GitHub archive access", () => {
  it.each([401, 403])("recovers HTTP %i using a separate credential-free public request", async (status) => {
    const request = vi.fn().mockResolvedValueOnce(new Response("denied", { status })).mockResolvedValueOnce(archiveResponse());
    const result = await fetchGithubCodeArchive("owner/repo", "codex/test", "test-only-token", request);
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe("https://api.github.com/repos/owner/repo/zipball/codex%2Ftest");
    const [url, options] = request.mock.calls[1];
    expect(url).toBe("https://codeload.github.com/owner/repo/zip/refs/heads/codex%2Ftest");
    expect(new Headers(options.headers).has("Authorization")).toBe(false);
  });

  it("does not report inaccessible private or missing branches as success", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("denied", { status: 401 })).mockResolvedValueOnce(new Response("missing", { status: 404 }));
    await expect(fetchGithubCodeArchive("owner/repo", "missing", "test-only-token", request)).rejects.toThrow("HTTP 404 (erster Abruf HTTP 401)");
  });

  it("retains successful authenticated downloads without making a public request", async () => {
    const request = vi.fn().mockResolvedValueOnce(archiveResponse());
    await fetchGithubCodeArchive("owner/private", "main", "test-only-token", request);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects HTTP 200 error pages", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("<html>Error</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(fetchGithubCodeArchive("owner/repo", "main", "", request)).rejects.toThrow("kein ZIP-Archiv");
  });

  it("does not hide an authenticated upstream outage with an anonymous retry", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("outage", { status: 503 }));
    await expect(fetchGithubCodeArchive("owner/repo", "main", "test-only-token", request)).rejects.toThrow("HTTP 503");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("Code backup integrity", () => {
  it("accepts a complete archive with regular files", async () => {
    const bytes = await new JSZip().file("repo/package.json", "{}").file("repo/index.html", "<html></html>").file("repo/src/main.ts", "// synthetic").file("repo/public/example.txt", "synthetic").file("repo/supabase/functions/example/index.ts", "// synthetic").file("repo/supabase/migrations/example.sql", "-- synthetic").generateAsync({ type: "arraybuffer" });
    await expect(validateCodeBackupZip(bytes)).resolves.toBeUndefined();
  });

  it("rejects directory-only archives", async () => {
    const bytes = await new JSZip().folder("repo")!.generateAsync({ type: "arraybuffer" });
    await expect(validateCodeBackupZip(bytes)).rejects.toThrow("keine Dateien");
  });

  it("rejects an intact ZIP when required application source and restore files are absent", async () => {
    const bytes = await new JSZip().file("repo/package.json", "{}").generateAsync({ type: "arraybuffer" });
    await expect(validateCodeBackupZip(bytes)).rejects.toThrow("Projektbestandteile fehlen");
  });

  it("rejects truncated archives and HTTP 200 HTML payloads", async () => {
    const bytes = await new JSZip().file("file", "data").generateAsync({ type: "arraybuffer" });
    await expect(validateCodeBackupZip(bytes.slice(0, 30))).rejects.toThrow("beschädigt");
    await expect(validateCodeBackupZip(new TextEncoder().encode("<html>Error</html>").buffer)).rejects.toThrow("beschädigt");
  });

  it("rejects corrupted file contents even when ZIP structure remains readable", async () => {
    const bytes = await new JSZip().file("file", "integrity-payload").generateAsync({ type: "arraybuffer", compression: "STORE" });
    const view = new Uint8Array(bytes);
    const header = new DataView(bytes);
    const offset = 30 + header.getUint16(26, true) + header.getUint16(28, true);
    expect(new TextDecoder().decode(view.slice(offset, offset + 17))).toBe("integrity-payload");
    view[offset] ^= 1;
    await expect(validateCodeBackupZip(bytes)).rejects.toThrow("beschädigt");
  });

  it("keeps administrator authorization before any GitHub archive request", () => {
    const edge = readFileSync(resolve("supabase/functions/backup-export/index.ts"), "utf8");
    const handler = edge.slice(edge.indexOf("Deno.serve"));
    expect(handler.indexOf("if (!isAdmin)")).toBeLessThan(handler.indexOf("await fetchGithubCodeArchive"));
    expect(handler).toContain('_role: "admin"');
    expect(handler).toContain("status: 401");
  });

  it("never marks the unverified manual fallback as a completed backup", () => {
    const ui = readFileSync(resolve("src/components/admin/BackupCenter.tsx"), "utf8");
    const download = ui.slice(ui.indexOf("const downloadGithubZip"), ui.indexOf("useEffect(()", ui.indexOf("const downloadGithubZip")));
    const failure = download.slice(download.indexOf("} catch (e)"));
    expect(failure).not.toContain('markDone("lastGithub")');
    expect(failure).toContain("ok: false");
  });
});
