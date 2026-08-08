import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const parserName = "build-strunz-application-area-inventory";
const parserVersion = "1.0.0";
const areaLabels = {
  abnehmen: "Abnehmen und Stoffwechsel",
  allergien: "Allergien und Unvertraeglichkeiten",
  augen: "Augen",
  "darm-verdauung": "Darm und Verdauung",
  "energie-mitochondrien": "Energie und Mitochondrien",
  "entgiften-ausleiten": "Leber und Entgiften",
  entzuendungen: "Entzuendungen",
  "frauengesundheit": "Frauengesundheit",
  "gehirn-nerven-psyche": "Gehirn, Nerven und Psyche",
  "haut-haare-naegel": "Haut, Haare und Naegel",
  "herz-und-gefaesse": "Herz und Gefaesse",
  kindergesundheit: "Kindergesundheit",
  "knochen-gelenke-sehnen": "Knochen, Gelenke und Sehnen",
  longevity: "Longevity",
  maennergesundheit: "Maennergesundheit",
  "schlaf-und-entspannung": "Schlaf und Entspannung",
  schilddruese: "Schilddruese",
  "stress-erschoepfung": "Stress und Erschoepfung",
  "training-und-regeneration": "Training und Regeneration",
  "zaehne-mund": "Zaehne und Mund",
  abwehrkraefte: "Immunsystem und Abwehrkraefte",
};

export function buildStrunzApplicationAreaInventory(sitemapText) {
  if (typeof sitemapText !== "string" || !sitemapText.trim()) {
    throw new Error("Die Strunz-Sitemap fehlt.");
  }
  const matches = [...sitemapText.matchAll(
    /<url><loc>(https:\/\/www\.strunz\.com\/nahrungsergaenzung\/anwendungsbereiche\/([a-z0-9-]+)\.html)<\/loc><lastmod>([^<]+)<\/lastmod>/g,
  )];
  const seen = new Set();
  const areas = matches.flatMap((match) => {
    const [, sourceUrl, slug, lastModified] = match;
    if (seen.has(slug)) return [];
    seen.add(slug);
    return [{
      area_key: `strunz-application-area:${slug}`,
      label: areaLabels[slug] || slug,
      source_url: sourceUrl,
      source_last_modified: lastModified,
      source_type: "manufacturer_application_area_index",
      import_status: "discovered_not_imported",
      clinical_assertions: [],
      evidence_status: "not_assessed",
      safety_status: "not_assessed",
      note: "Navigation metadata only. This is not a disease, symptom, treatment, or product recommendation.",
    }];
  });
  if (areas.length === 0) {
    throw new Error("Die Sitemap enthaelt keine Strunz-Anwendungsbereiche.");
  }
  return {
    schema_version: 1,
    source_kind: "sitemap_navigation_metadata",
    source_hash: createHash("sha256").update(sitemapText).digest("hex"),
    parser_name: parserName,
    parser_version: parserVersion,
    publication: "unpublished_internal_inventory",
    wiki_writes: false,
    database_writes: false,
    areas,
  };
}

function argumentValue(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}

async function main() {
  const inputPath = argumentValue(process.argv, "--input");
  const outputPath = argumentValue(process.argv, "--output");
  if (!inputPath || !outputPath) {
    throw new Error("Verwendung: node scripts/build-strunz-application-area-inventory.mjs --input <sitemap.xml> --output <inventar.json>");
  }
  const inventory = buildStrunzApplicationAreaInventory(await readFile(inputPath, "utf8"));
  await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ areas: inventory.areas.length, source_hash: inventory.source_hash }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
