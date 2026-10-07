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

describe("Strunz Produktquellen Teil 4 (73–96)", () => {
  const a = STRUNZ_AREA as any;
  it("Reihenfolge, wörtliche Fundstellen je positiver Angabe, Hersteller offen", () => {
    const r = a.produktquellen_teil4.ergebnisse;
    const order = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen").slice(72, 96).map((x: any) => x.url);
    expect(r.map((x: any) => x.url)).toEqual(order);
    r.forEach((x: any) => {
      expect(x.abgerufen).toMatch(/Z$/); expect(x.hersteller).toBeNull(); expect(x.hersteller_status).toContain("offen");
      if (x.ean.length) expect(x.ean_fundstelle.wortlaut).toContain(x.ean[0]); else expect(x.ean_fundstelle).toBe("nicht angegeben");
      if (x.marke_laut_seite) expect(x.marke_fundstelle.wortlaut.toLowerCase()).toContain(x.marke_laut_seite.toLowerCase());
      expect(x.produktname_fundstelle.feld).toBe("H1");
    });
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
    expect(a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung === "variante_offen").length).toBe(13);
  });
});

describe("Strunz Listeneinträge Teil 5 (97–120)", () => {
  const a = STRUNZ_AREA as any;
  it("Reihenfolge, wörtliche Fundstellen, Hersteller offen, Gutschein gesondert, doppelte EAN markiert", () => {
    const r = a.produktquellen_teil5.ergebnisse;
    const order = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen").slice(96, 120).map((x: any) => x.url);
    expect(r.map((x: any) => x.url)).toEqual(order);
    const seen: Record<string, number> = {}; r.forEach((x: any) => x.ean.forEach((e: string) => (seen[e] = (seen[e] ?? 0) + 1)));
    r.forEach((x: any) => {
      expect(x.hersteller).toBeNull();
      if (x.ean.length) expect(x.ean_fundstelle.wortlaut).toContain(x.ean[0]); else expect(x.ean_fundstelle).toBe("nicht angegeben");
      if (x.marke_laut_seite) expect(x.marke_fundstelle.wortlaut.toLowerCase()).toContain(x.marke_laut_seite.toLowerCase());
      if (x.ean.some((e: string) => seen[e] > 1)) expect(x.ean_hinweis).toContain("uneindeutig");
    });
    expect(a.produktquellen_teil4.ergebnisse.filter((x: any) => x.seitentyp === "gutschein_kein_produkt").length).toBe(1);
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
    expect(a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung === "variante_offen").length).toBe(13);
  });
});

describe("Strunz Listeneinträge Teil 6 (121–136)", () => {
  const a = STRUNZ_AREA as any;
  it("Reihenfolge, Fundstellen, Hersteller offen, alle 136 abgedeckt", () => {
    const r = a.produktquellen_teil6.ergebnisse;
    const nv = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung !== "variante_offen");
    expect(nv.length).toBe(136);
    expect(r.map((x: any) => x.url)).toEqual(nv.slice(120, 136).map((x: any) => x.url));
    r.forEach((x: any) => {
      expect(x.http).toBe(200);
      expect(x.hersteller).toBeNull();
      if (x.ean.length) expect(x.ean_fundstelle.wortlaut).toContain(x.ean[0]); else expect(x.ean_fundstelle).toBe("nicht angegeben");
      if (x.marke_laut_seite) expect(x.marke_fundstelle.wortlaut.toLowerCase()).toContain(x.marke_laut_seite.toLowerCase());
      else expect(x.marke_status).toContain("offen");
    });
    expect(r.filter((x: any) => x.ean.length).length).toBe(8);
    const all = [1, 2, 3, 4, 5, 6].flatMap((i) => a[`produktquellen_teil${i}`].ergebnisse.map((x: any) => x.url));
    expect(new Set(all).size).toBe(136);
    expect(all.sort()).toEqual(nv.map((x: any) => x.url).sort());
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
  });
});

describe("Strunz mögliche Varianten (13)", () => {
  const a = STRUNZ_AREA as any;
  it("13 Seiten, Gruppen als Hypothese, nichts zusammengeführt", () => {
    const r = a.produktquellen_varianten.ergebnisse;
    const v = a.produkte_ohne_karte_liste.filter((x: any) => x.einordnung === "variante_offen");
    expect(r.map((x: any) => x.url)).toEqual(v.map((x: any) => x.url));
    expect(v.reduce((n: number, x: any) => n + x.fundstellen.length, 0)).toBe(56);
    expect(new Set(r.map((x: any) => x.variantengruppe_hypothese)).size).toBe(6);
    r.forEach((x: any) => {
      expect(x.http).toBe(200); expect(x.hersteller).toBeNull();
      expect(x.ean_fundstelle.wortlaut).toContain(x.ean[0]);
      if (x.auswahloptionen.length < 2) expect(x.gruppenbeleg).toContain("Namenshypothese"); else expect(x.gruppenbeleg).toContain("keine bestätigte Produktidentität");
    });
    expect(new Set(r.flatMap((x: any) => x.ean)).size).toBe(13);
    const nv = [1, 2, 3, 4, 5, 6].flatMap((i) => a[`produktquellen_teil${i}`].ergebnisse.map((x: any) => x.url));
    expect(nv.some((u: string) => r.some((x: any) => x.url === u))).toBe(false);
    expect(a.produkte_ohne_karte_liste.length).toBe(149);
    expect(a.produktquellen_teil4.ergebnisse.filter((x: any) => x.seitentyp === "gutschein_kein_produkt").length).toBe(1);
  });
});
