import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "BNI-Claudius");
const targetRoot = path.join(projectRoot, "public", "bni-claudius");
const presentationFile = "gesundheitsrunde-beispiel-fuer-die-gruppe.html";
const imageDirectory = "bni-claudius-profilbilder";

await mkdir(targetRoot, { recursive: true });
await copyFile(
  path.join(sourceRoot, presentationFile),
  path.join(targetRoot, presentationFile),
);

const targetImages = path.join(targetRoot, imageDirectory);
await rm(targetImages, { recursive: true, force: true });
await cp(path.join(sourceRoot, imageDirectory), targetImages, { recursive: true });

console.log(`BNI-Präsentation für Vite/Lovable synchronisiert: public/bni-claudius/${presentationFile}`);
