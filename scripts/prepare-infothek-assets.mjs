import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = join(projectRoot, "public", "vendor");
const revealSource = join(projectRoot, "node_modules", "reveal.js", "dist");
const revealTarget = join(vendorRoot, "reveal");
const fontsTarget = join(vendorRoot, "fonts");

await mkdir(revealTarget, { recursive: true });
await mkdir(fontsTarget, { recursive: true });

for (const [source, target] of [
  ["reveal.css", "reveal.css"],
  ["reveal.js", "reveal.js"],
  [join("theme", "simple.css"), "simple.css"],
  [join("theme", "white.css"), "white.css"],
]) {
  await copyFile(join(revealSource, source), join(revealTarget, target));
}

const fontFaces = [
  { family: "Playfair Display", packageName: "playfair-display", weights: [400, 500, 600, 700, 800] },
  { family: "Source Sans 3", packageName: "source-sans-3", weights: [300, 400, 500, 600, 700] },
];

const fontCss = [];
for (const { family, packageName, weights } of fontFaces) {
  for (const weight of weights) {
    const fileName = `${packageName}-latin-${weight}-normal.woff2`;
    const source = join(projectRoot, "node_modules", "@fontsource", packageName, "files", fileName);
    await copyFile(source, join(fontsTarget, fileName));
    fontCss.push(`@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url('/vendor/fonts/${fileName}') format('woff2');
}`);
  }
}

await writeFile(join(vendorRoot, "infothek-fonts.css"), `${fontCss.join("\n\n")}\n`, "utf8");
