import assert from "node:assert/strict";
import test from "node:test";

import { buildStrunzApplicationAreaInventory } from "../scripts/build-strunz-application-area-inventory.mjs";

const sitemap = `<?xml version="1.0"?>
<urlset>
<url><loc>https://www.strunz.com/nahrungsergaenzung/anwendungsbereiche/schilddruese.html</loc><lastmod>2026-05-11T11:50:56+00:00</lastmod></url>
<url><loc>https://www.strunz.com/nahrungsergaenzung/anwendungsbereiche/entzuendungen.html</loc><lastmod>2026-07-20T13:33:04+00:00</lastmod></url>
<url><loc>https://www.strunz.com/nahrungsergaenzung/anwendungsbereiche/schilddruese.html</loc><lastmod>2026-05-11T11:50:56+00:00</lastmod></url>
</urlset>`;

test("builds a non-clinical Strunz application-area inventory", () => {
  const inventory = buildStrunzApplicationAreaInventory(sitemap);
  assert.equal(inventory.publication, "unpublished_internal_inventory");
  assert.equal(inventory.wiki_writes, false);
  assert.equal(inventory.database_writes, false);
  assert.equal(inventory.areas.length, 2);
  assert.deepEqual(inventory.areas[0], {
    area_key: "strunz-application-area:schilddruese",
    label: "Schilddruese",
    source_url: "https://www.strunz.com/nahrungsergaenzung/anwendungsbereiche/schilddruese.html",
    source_last_modified: "2026-05-11T11:50:56+00:00",
    source_type: "manufacturer_application_area_index",
    import_status: "discovered_not_imported",
    clinical_assertions: [],
    evidence_status: "not_assessed",
    safety_status: "not_assessed",
    note: "Navigation metadata only. This is not a disease, symptom, treatment, or product recommendation.",
  });
});

test("rejects a sitemap without Strunz application areas", () => {
  assert.throws(
    () => buildStrunzApplicationAreaInventory("<urlset><url><loc>https://example.invalid/</loc></url></urlset>"),
    /keine Strunz-Anwendungsbereiche/,
  );
});
