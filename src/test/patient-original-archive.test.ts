// @vitest-environment node
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { archivePatientOriginal, verifyArchivedPatientOriginal, originalArchiveInputPatch } from "@/lib/patientOriginalArchive";
import { deidentifyClinicalData, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";
import { patientOriginalArchivePath } from "../../supabase/functions/_shared/patientOriginalReference";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
const pid = "P-2099-0601";
const file = () => Object.assign(new Blob(["%PDF-1.7\nsynthetic original bytes\n"], { type: "application/pdf" }), { name: "synthetic-private-filename.pdf" });
function setup() {
  const objects = new Map<string, Blob>();
  const upload = vi.fn(async (path: string, body: Blob, _options: unknown) => { objects.set(path, body); return { error: null }; });
  const download = vi.fn(async (path: string) => ({ data: objects.get(path) || null, error: null }));
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
    const path = `${args._pseudonym_id}/${args._document_date || "undatiert"}/${args._document_type}-${args._sha256}.${args._extension}`;
    return { data: { bucket: "therapy-documents", path, pseudonym_id: args._pseudonym_id,
      sha256: args._sha256, bytes: args._size_bytes, exists: objects.has(path) }, error: null };
  });
  return { objects, upload, download, rpc, client: { rpc, storage: { from: () => ({ upload, download }) } } };
}
describe("private original-file receipts", () => {
  it("can verify a restored archive receipt without a new upload and rejects a foreign case", async () => {
    const t = setup(); const receipt = await archivePatientOriginal(t.client, pid, file(), "anamnese");
    expect((await verifyArchivedPatientOriginal(t.client, pid, receipt)).reused).toBe(true);
    expect(t.upload).toHaveBeenCalledOnce();
    await expect(verifyArchivedPatientOriginal(t.client, "P-2099-0602", receipt)).rejects.toThrow(/aktuellen Fall/);
    expect(t.download).toHaveBeenCalledTimes(2);
  });
  it("keeps byte-proof links intact through text deidentification and deduplicates only the same field link", async () => {
    const t = setup(); const receipt = await archivePatientOriginal(t.client, pid, file(), "labor", "2099-01-01");
    const base = { _pseudonym_id: pid, pseudonymId: pid };
    const first = { ...base, ...originalArchiveInputPatch(base, [receipt], "laborKomplett") };
    const second = { ...first, ...originalArchiveInputPatch(first, [receipt], "laborKomplett") };
    expect((second as any).originalArchiveReceiptsV1).toHaveLength(1);
    const safe = deidentifyClinicalData(second);
    expect(safe).toEqual(second);
    expect(directIdentifierCategories(JSON.stringify(safe))).toEqual([]);
    expect(patientOriginalArchivePath((safe as any).originalArchiveReceiptsV1[0], pid)).toBe(receipt.archivePath);
    expect(patientOriginalArchivePath((safe as any).originalArchiveReceiptsV1[0], "P-2099-0602")).toBeNull();
    const third = originalArchiveInputPatch(second, [receipt], "sonstigeUntersuchungen");
    expect(third.originalArchiveReceiptsV1).toHaveLength(2);
  });
  it("keeps the original bytes, uses a neutral filename and verifies the downloaded copy", async () => {
    const t = setup(); const original = file();
    const receipt = await archivePatientOriginal(t.client, pid.toLowerCase(), original, "anamnese", "2099-01-01");
    expect(receipt.archivePath).toMatch(/^P-2099-0601\/2099-01-01\/anamnese-[0-9a-f]{64}\.pdf$/);
    expect(t.upload).toHaveBeenCalledWith(receipt.archivePath, original, { upsert: false, contentType: "application/pdf" });
    expect(t.download).toHaveBeenCalledWith(receipt.archivePath);
    expect(JSON.stringify(t.rpc.mock.calls)).not.toContain(original.name);
  });
  it("verifies and reuses an existing identical original without another upload", async () => {
    const t = setup(); const original = file();
    const first = await archivePatientOriginal(t.client, pid, original, "labor");
    const second = await archivePatientOriginal(t.client, pid, original, "labor");
    expect(second.archivePath).toBe(first.archivePath); expect(second.reused).toBe(true);
    expect(t.upload).toHaveBeenCalledOnce(); expect(t.download).toHaveBeenCalledTimes(2);
  });
  it("rejects a different destination before sending the file", async () => {
    const t = setup(); t.rpc.mockResolvedValueOnce({ data: { bucket: "therapy-documents", path: "another-case" } as any, error: null });
    await expect(archivePatientOriginal(t.client, pid, file(), "arzt")).rejects.toThrow(/Archivzuordnung/);
    expect(t.upload).not.toHaveBeenCalled();
  });
  it("does not confirm an incomplete or altered archive copy", async () => {
    const t = setup(); t.download.mockResolvedValueOnce({ data: new Blob(["altered"]), error: null });
    await expect(archivePatientOriginal(t.client, pid, file(), "arzt")).rejects.toThrow(/zurückgelesen/);
    expect(t.objects.size).toBe(1); // Never delete a potentially recoverable original on a verification failure.
  });
  it("recovers a lost upload response through byte-exact readback", async () => {
    const t = setup(); t.upload.mockImplementationOnce(async (path, body) => { t.objects.set(path, body); throw new Error("synthetic connection lost"); });
    const receipt = await archivePatientOriginal(t.client, pid, file(), "sonstige");
    expect(receipt.bytes).toBe(file().size);
  });
  it("does not upload when the private archive cannot be confirmed", async () => {
    const t = setup(); t.rpc.mockResolvedValueOnce({ data: null, error: { message: "synthetic forbidden" } } as any);
    await expect(archivePatientOriginal(t.client, pid, file(), "dokument")).rejects.toThrow(/private Originalarchiv/);
    expect(t.upload).not.toHaveBeenCalled();
  });
});
