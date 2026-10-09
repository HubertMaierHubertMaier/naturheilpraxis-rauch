import JSZip from "jszip";

export async function validateCodeBackupZip(bytes: ArrayBuffer): Promise<void> {
  if (bytes.byteLength === 0) throw new Error("Das empfangene Code-ZIP ist leer.");
  try {
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    const files = Object.values(zip.files).filter((file) => !file.dir);
    if (!files.length) {
      throw new Error("Keine Dateien im Archiv");
    }
    const roots = new Set(files.map((file) => file.name.split("/")[0]));
    if (roots.size !== 1) throw new Error("Kein eindeutiges Projektverzeichnis");
    const root = `${[...roots][0]}/`;
    const names = files.map((file) => file.name.slice(root.length));
    const required = ["package.json", "index.html", "src/", "public/", "supabase/functions/", "supabase/migrations/"];
    if (required.some((path) => !names.some((name) => path.endsWith("/") ? name.startsWith(path) : name === path))) {
      throw new Error("Wichtige Projektbestandteile fehlen");
    }
    JSON.parse(await zip.file(`${root}package.json`)!.async("string"));
  } catch {
    throw new Error("Das empfangene Code-ZIP ist beschädigt, enthält keine Dateien oder wichtige Projektbestandteile fehlen. Das Backup wurde nicht abgeschlossen.");
  }
}
