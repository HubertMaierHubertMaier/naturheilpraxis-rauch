import { describe, it, expect } from "vitest";
import { STRUNZ_SOURCES, sourcesByProduct } from "@/lib/strunzSourceCandidates";
import { STRUNZ_AREA } from "@/lib/strunzAreaCandidates";

describe("Strunz 53 source candidates", () => {
  const c = STRUNZ_SOURCES.kandidaten;
  it("has 53 unique real IDs with revision", () => {
    expect(c.length).toBe(53);
    expect(new Set(c.map((x) => x.candidate_id)).size).toBe(53);
    c.forEach((x) => expect(x.core_source_revision_id).toMatch(/^[0-9a-f-]{36}$/));
  });
  it("maps only to the 9 existing cards, 3 each, never by nutrient alone", () => {
    const cards = new Set(STRUNZ_AREA.kandidaten.map((k) => k.product_key));
    const m = sourcesByProduct(c);
    expect(m.size).toBe(9);
    m.forEach((xs, k) => { expect(cards.has(k)).toBe(true); expect(xs.length).toBe(3); });
    c.filter((x) => x.typ === "einzelstoff_referenz").forEach((x) => expect(x.product_key).toBeNull());
  });
  it("records pagination check and variant split", () => {
    const a = STRUNZ_AREA as any;
    expect(a.pagination_pruefung.seiten.length).toBe(21);
    expect(a.ungemappt_aufteilung.eindeutig + a.ungemappt_aufteilung.varianten).toBe(149);
  });
});

describe("149 unmapped Strunz products", () => {
  const a = STRUNZ_AREA as any;
  const L = a.produkte_ohne_karte_liste as any[];
  it("every product has area/position provenance and a match status", () => {
    expect(L.length).toBe(149);
    expect(new Set(L.map((x) => x.url)).size).toBe(149);
    L.forEach((x) => { expect(x.fundstellen.length).toBeGreaterThan(0); expect(x.abgleich.status).toMatch(/^(kein_treffer|moeglicher_treffer_name|treffer_url)$/); });
  });
  it("name-only hits never claim product identity", () => {
    L.filter((x) => x.abgleich.status === "moeglicher_treffer_name").forEach((x) => {
      expect(x.abgleich.grund).toContain("nicht bestätigt");
      x.abgleich.entitaeten.forEach((e: any) => expect(e.typ).not.toBe("product"));
    });
    expect(a.ungemappt_abgleich.vollstaendigkeit).toContain("keine Aussage über das gesamte");
  });
});

describe("Strunz Produktquellen Teil 1 und Beleg 69", () => {
  const a = STRUNZ_AREA as any;
  it("24 Produktseiten, nur explizite EAN, Hersteller nie aus Marke", () => {
    const r = a.produktquellen_teil1.ergebnisse;
    expect(r.length).toBe(24);
    const order = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen").slice(0, 24).map((x: any) => x.url);
    expect(r.map((x: any) => x.url)).toEqual(order);
    r.forEach((x: any) => {
      expect(x.abgerufen).toMatch(/Z$/);
      if (!x.ean) expect(x.ean_fundstelle).toBe("nicht angegeben");
      if (!x.hersteller) expect(x.hersteller_status).toContain("offen");
    });
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
  });
  it("69 Treffer per Abfrage belegt", () => {
    expect(a.beleg_69.ergebnis.url_identisch_mit_kandidat).toBe(69);
    expect(a.beleg_69.abweichungen).toEqual([]);
    expect(a.methode).toContain("alle 21 Seiten");
  });
});

describe("Strunz Produktquellen Teil 2 (25–48)", () => {
  const a = STRUNZ_AREA as any;
  it("24 Produktseiten in Listenreihenfolge, Hersteller nie gesetzt, Varianten erhalten", () => {
    const r = a.produktquellen_teil2.ergebnisse;
    const order = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen").slice(24, 48).map((x: any) => x.url);
    expect(r.map((x: any) => x.url)).toEqual(order);
    r.forEach((x: any) => { expect(x.abgerufen).toMatch(/Z$/); expect(x.hersteller).toBeNull(); expect(x.hersteller_status).toContain("offen"); if (!x.ean.length) expect(x.ean_fundstelle).toBe("nicht angegeben"); });
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
    expect(a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung === "variante_offen").length).toBe(13);
  });
});

describe("Strunz Produktquellen Teil 3 (49–72)", () => {
  const a = STRUNZ_AREA as any;
  it("24 Seiten in Listenreihenfolge, Hersteller offen, Marke nie als Hersteller", () => {
    const r = a.produktquellen_teil3.ergebnisse;
    const order = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen").slice(48, 72).map((x: any) => x.url);
    expect(r.map((x: any) => x.url)).toEqual(order);
    r.forEach((x: any) => { expect(x.hersteller).toBeNull(); expect(x.hersteller_status).toContain("offen"); expect(x.marke_laut_seite).toBeTruthy(); });
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
  });
});
