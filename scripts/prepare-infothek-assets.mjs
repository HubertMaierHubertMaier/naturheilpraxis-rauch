import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(projectRoot, "public");
const vendorRoot = join(publicRoot, "vendor");
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

// Lovable retains removed static paths between deployments. Replace the old
// public documents with noindex redirects to routes that enforce app access.
const manifest = JSON.parse(
  await readFile(join(projectRoot, "website-content", "infothek", "manifest.json"), "utf8"),
);
const redirectFiles = [
  ...manifest.pages.map((page) => page.file),
  "datenschutz-fahrplan.html",
];

for (const fileName of redirectFiles) {
  if (!/^[a-z0-9-]+\.html$/.test(fileName)) {
    throw new Error(`Invalid Infothek redirect filename: ${fileName}`);
  }

  const appPath = `/infothek-dokument/${fileName.replace(/\.html$/, "")}`;
  const redirectHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="0; url=${appPath}">
  <title>Weiterleitung</title>
</head>
<body><a href="${appPath}">Sicher oeffnen</a></body>
</html>
`;
  await writeFile(join(publicRoot, fileName), redirectHtml, "utf8");
}
