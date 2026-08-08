import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const candidates = JSON.parse(readFileSync(
  resolve(process.cwd(), "docs/strunz-public-product-fact-candidates-2026-08-04.json"),
  "utf8",
));

test("keeps public Strunz product facts unpublished and review-gated", () => {
  assert.equal(candidates.schema_version, 1);
  assert.deepEqual(candidates.publication, {
    candidate_status: "unpublished",
    wiki_writes: false,
    database_writes: false,
    medical_approval: false,
    dosage_approval: false,
  });
  assert.equal(candidates.coverage.product_declaration_cards, 9);
  assert.equal(candidates.coverage.condition_or_symptom_cards, 0);
  assert.equal(candidates.source_cards.length, 9);
});

test("binds each factual declaration to a unique archived source", () => {
  const sourceIDs = candidates.source_cards.map((card) => card.source_id);
  const sourceUrls = candidates.source_cards.map((card) => card.source_url);
  const eans = candidates.source_cards.map((card) => card.product.ean);
  assert.equal(new Set(sourceIDs).size, 9);
  assert.equal(new Set(sourceUrls).size, 9);
  assert.equal(new Set(eans).size, 9);

  for (const card of candidates.source_cards) {
    assert.equal(card.candidate_status, "unpublished");
    assert.equal(card.source_type, "manufacturer_product_declaration");
    assert.match(card.source_url, /^https:\/\/www\.strunz\.com\//);
    assert.match(card.snapshot_sha256, /^[a-f0-9]{64}$/);
    assert.equal(card.review.evidence, "unreviewed");
    assert.equal(card.review.safety, "unreviewed");
    assert.equal(card.review.dosage, "manufacturer_declared_not_approved");
    assert.equal(card.review.medical_use, "not_assessed");
    assert.ok(card.nutrients.length > 0);
    for (const nutrient of card.nutrients) {
      assert.ok(Number(nutrient.amount) > 0);
      assert.ok(["mg", "ug"].includes(nutrient.unit));
      assert.ok(Number(nutrient.nrv_percent) >= 0);
    }
  }
});

test("retains the declared vitamin and mineral amounts for representative products", () => {
  const byID = new Map(candidates.source_cards.map((card) => [card.source_id, card]));
  const vitaminD = byID.get("strunz-20260804-vitamin-d3-k2");
  const magnesium = byID.get("strunz-20260804-magnesium-caps");
  const vitaminC = byID.get("strunz-20260804-vitamin-c-komplex");
  const multi = byID.get("strunz-20260804-vitamineral-32-maracuja");

  assert.deepEqual(vitaminD.nutrients, [
    { name: "Vitamin D3", amount: "25", unit: "ug", nrv_percent: 500 },
    { name: "Vitamin K2", form: "MK-7 all-trans", amount: "15", unit: "ug", nrv_percent: 20 },
  ]);
  assert.deepEqual(magnesium.nutrients, [
    { name: "Magnesium", amount: "346", unit: "mg", nrv_percent: 92 },
    { name: "Vitamin B6", form: "pyridoxal-5-phosphate", amount: "1.2", unit: "mg", nrv_percent: 86 },
  ]);
  assert.deepEqual(vitaminC.nutrients, [
    { name: "Vitamin C", amount: "500", unit: "mg", nrv_percent: 625 },
  ]);
  assert.equal(multi.nutrients.length, 23);
  assert.deepEqual(multi.nutrients.find((nutrient) => nutrient.name === "Vitamin C"), {
    name: "Vitamin C", amount: "300", unit: "mg", nrv_percent: 375,
  });
  assert.deepEqual(multi.nutrients.find((nutrient) => nutrient.name === "Selenium"), {
    name: "Selenium", amount: "30", unit: "ug", nrv_percent: 55,
  });
});
