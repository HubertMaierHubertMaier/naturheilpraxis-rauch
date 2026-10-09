// @vitest-environment node
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { backupFingerprint, verifySavedBackup, writeVerifiedBackup, validateBackupArchive, type BackupDirectory } from "../lib/backupFileSave";

const makeZip = async () => new Blob([await new JSZip().file("db/example.json", '[{"id":"synthetic-only"}]').generateAsync({ type: "arraybuffer" })]);
const notFound = () => Object.assign(new Error("missing"), { name: "NotFoundError" });

describe("ZIP saved-file verification", () => {
  it("writes a real file, closes it, reopens it and verifies every byte and ZIP CRC", async () => {
    const folder = await mkdtemp(join(tmpdir(), "backup-save-test-"));
    try {
      const blob = await makeZip();
      const directory: BackupDirectory = { getFileHandle: async (name, options) => {
        const filePath = join(folder, name);
        if (!options.create) throw notFound();
        return {
          createWritable: async () => ({ write: async (data) => { await writeFile(filePath, Buffer.from(await data.arrayBuffer())); }, close: async () => {}, abort: async () => {} }),
          getFile: async () => new Blob([await readFile(filePath)]),
        };
      } };
      await writeVerifiedBackup(directory, "test.zip", blob);
      const saved = new Blob([await readFile(join(folder, "test.zip"))]);
      await expect(verifySavedBackup(saved, blob.size, await backupFingerprint(blob))).resolves.toBeUndefined();
      const zip = await JSZip.loadAsync(await saved.arrayBuffer(), { checkCRC32: true });
      expect(JSON.parse(await zip.file("db/example.json")!.async("string"))).toEqual([{ id: "synthetic-only" }]);
    } finally { if (!resolve(folder).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"))) throw new Error("Unexpected cleanup target"); await rm(folder, { recursive: true, force: true }); }
  });

  it.each(["write", "close", "read", "mismatch"])("rejects %s failure instead of confirming a backup", async (failure) => {
    const abort = vi.fn(async () => {});
    const original = await makeZip();
    const handle = {
      createWritable: async () => ({ write: async () => { if (failure === "write") throw new Error("disk full"); }, close: async () => { if (failure === "close") throw new Error("flush failed"); }, abort }),
      getFile: async () => { if (failure === "read") throw new Error("read failed"); return new Blob(["truncated"]); },
    };
    const directory: BackupDirectory = { getFileHandle: async (_name, options) => { if (!options.create) throw notFound(); return handle; } };
    await expect(writeVerifiedBackup(directory, "test.zip", original)).rejects.toThrow();
    if (failure === "write" || failure === "close") expect(abort).toHaveBeenCalledOnce();
  });

  it("refuses to overwrite an existing backup", async () => {
    const getFileHandle = vi.fn(async () => ({}));
    await expect(writeVerifiedBackup({ getFileHandle } as unknown as BackupDirectory, "existing.zip", await makeZip())).rejects.toThrow("existiert bereits");
    expect(getFileHandle).toHaveBeenCalledOnce();
  });

  it("rejects HTML and truncated archives, but allows legitimate filenames ending in ERROR.txt", async () => {
    await expect(validateBackupArchive(new Blob(["<html>upstream failure</html>"]))).rejects.toThrow();
    const blob = await makeZip();
    await expect(validateBackupArchive(blob.slice(0, 30))).rejects.toThrow();
    const failed = new Blob([await new JSZip().file("storage/file.ERROR.txt", "failed").generateAsync({ type: "arraybuffer" })]);
    await expect(validateBackupArchive(failed)).resolves.toBeUndefined();
  });
});
