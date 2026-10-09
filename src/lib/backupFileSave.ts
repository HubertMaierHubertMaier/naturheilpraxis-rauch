import JSZip from "jszip";

export type BackupDirectory = {
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
    getFile(): Promise<Blob>;
  }>;
};

/** Call directly from the button gesture, before fetching any backup data. */
export function chooseBackupDirectory(): Promise<BackupDirectory | null> {
  const picker = (window as Window & {
    showDirectoryPicker?: (options: { mode: "readwrite"; id: string }) => Promise<BackupDirectory>;
  }).showDirectoryPicker;
  return picker ? picker.call(window, { mode: "readwrite", id: "praxis-backup" }).catch((error: unknown) => {
    // Embedded previews may forbid the picker. The download path still requires file verification.
    if (error instanceof Error && ["SecurityError", "NotSupportedError"].includes(error.name)) return null;
    throw error;
  }) : Promise.resolve(null);
}

export async function backupFingerprint(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateBackupArchive(blob: Blob): Promise<void> {
  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    if (!files.length) throw new Error();
  } catch {
    throw new Error("Das ZIP ist beschädigt oder leer. Die Sicherung wird nicht bestätigt.");
  }
}

export async function verifySavedBackup(file: Blob, expectedSize: number, expectedHash: string): Promise<void> {
  if (file.size !== expectedSize || await backupFingerprint(file) !== expectedHash) {
    throw new Error("Die gespeicherte Datei stimmt nicht vollständig mit der erzeugten Sicherung überein.");
  }
  await validateBackupArchive(file);
}

export async function writeVerifiedBackup(directory: BackupDirectory, filename: string, blob: Blob): Promise<void> {
  await validateBackupArchive(blob);
  const digest = await backupFingerprint(blob);
  // Never silently overwrite an existing backup selected by the timestamp name.
  try {
    await directory.getFileHandle(filename, { create: false });
    throw new Error("Eine gleichnamige Sicherung existiert bereits. Bitte den Vorgang mit einem neuen Dateinamen wiederholen.");
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "NotFoundError") throw error;
  }
  const handle = await directory.getFileHandle(filename, { create: true });
  const stream = await handle.createWritable();
  try {
    await stream.write(blob);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => undefined);
    throw error;
  }
  await verifySavedBackup(await handle.getFile(), blob.size, digest);
}
