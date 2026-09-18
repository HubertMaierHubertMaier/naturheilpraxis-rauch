// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const correction = migration("20260918170000_preserve_form_rows_in_postal_redaction.sql");
const form = "Manuell prüfen (keine sichere Frage-Antwort-Zuordnung, Testabschnitt, Seite 7): 00000\nManuell prüfen (keine sichere Frage-Antwort-Zuordnung, Testabschnitt, Seite 7): ooooo |";
let db: PGlite;
let originalResult: string;
let originalMeasurementResult: string;
const redact = async (value: string) => (await db.query<{ value: string }>(
  "select public.redact_therapy_pii_text($1) as value", [value],
)).rows[0].value;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create table public.therapy_sessions (id integer primary key, eingabe_daten jsonb, befund_meta jsonb, befund_html text, empfehlung text, notiz text)");
  await db.exec(migration("20260713140639_754e440c-7624-42da-8455-86bab78b2b6b.sql"));
  await db.exec(migration("20260713144620_ac17a174-dc61-4468-85a9-2eca8ae8ce11.sql"));
  originalResult = await redact(form);
  await db.query("insert into public.therapy_sessions (id, eingabe_daten) values (1, $1::jsonb)", [JSON.stringify({ anamnese: form })]);
  await db.exec(correction);
  originalMeasurementResult = await redact("Hering 0,245");
  await db.exec(migration("20260918193000_preserve_device_measurement_rows.sql"));
}, 20000);
afterAll(async () => { await db?.close(); });

describe("postal redaction does not consume form rows", () => {
  it("reproduces the original loss in PostgreSQL and preserves the complete form after correction", async () => {
    expect(originalResult).toBe(form.replace("00000\nManuell", "[Ort entfernt]"));
    expect(await redact(form)).toBe(form);
  });
  it.each(["\n", "\r\n", "\r", "\n\n"])("preserves arbitrary section/page labels and line ending %j", async (newline) => {
    const text = `Testabschnitt, Seite 18: 48271${newline}Manuell prüfen (Zuordnung offen)`;
    expect(await redact(text)).toBe(text);
    const wrapped = form.split("\n").join(newline);
    expect(await redact(wrapped)).toBe(wrapped);
  });
  it("does not treat zero placeholders as postal codes even on the same line", async () => {
    const text = "Antworten: 00000 Manuell prüfen";
    expect(await redact(text)).toBe(text);
  });
  it.each(["10115 Berlin", "01067 Dresden", "61348 Bad Homburg", "10115\tBerlin"])("continues to protect an inline address: %s", async (address) => {
    expect(await redact(address)).toBe("[Ort entfernt]");
  });
  it.each(["PLZ/Ort: 10115\nBerlin", "Wohnort: 01067\r\nDresden", "10115\nBerlin", "01067\r\nDresden"])("protects wrapped addresses with address context: %s", async (address) => {
    const result = await redact(address);
    expect(result).toContain("[Ort entfernt]");
    expect(result).not.toMatch(/10115|01067|Berlin|Dresden/);
  });
  it("redacts a postal line without consuming the next clinical heading", async () => {
    expect(await redact("10115 Berlin\nAllergien\nKeine bekannt")).toBe("[Ort entfernt]\nAllergien\nKeine bekannt");
  });
  it("preserves medication doses, negatives and clinical measurements", async () => {
    const text = "Keine Allergien. Vitamin D3 1000 IE täglich. Magnesium 200 mg. CRP 12,5 mg/l. Blutdruck 120/80 mmHg.";
    expect(await redact(text)).toBe(text);
  });
  it("preserves device rows previously misclassified as street addresses", async () => {
    expect(originalMeasurementResult).toContain("[Anschrift entfernt]");
    const text = "Metatron\nAal 0,350\nHering 0,245\nLachs 0,128\n";
    expect(await redact(text)).toBe(text);
    expect(await redact(text.split("\n").join("\r\n"))).toBe(text.split("\n").join("\r\n"));
  });
  it("retains literal token-like text and multiple protected rows exactly", async () => {
    const text = "__CLINICAL_DEVICE_ROW_1__\nHering 0,245\nHering 0.125";
    expect(await redact(text)).toBe(text);
  });
  it("does not protect explicit name/address fields or ordinary addresses as measurements", async () => {
    expect(await redact("Name: Erika Beispiel\nTeststraße 12, 10115 Berlin")).not.toMatch(/Erika|Beispiel|Teststraße|10115|Berlin/);
    expect(await redact("Anschrift: Testweg 12,14")).toContain("[Anschrift entfernt]");
    expect(await redact("Hering 12")).toContain("[Anschrift entfernt]");
  });
  it("preserves empty text and exact trailing line endings", async () => {
    for (const text of ["", "\n", "\r\n", "Hering 0,245\n\n"]) expect(await redact(text)).toBe(text);
  });
  it("retains the other privacy protections", async () => {
    const result = await redact("E-Mail: beispiel@example.invalid\nTelefon: +49 30 12345678\nGeburtsdatum: 01.01.1970\nTeststraße 12, 10115 Berlin");
    expect(result).toContain("[E-Mail entfernt]");
    expect(result).toContain("[Kontaktdaten entfernt]");
    expect(result).toContain("[Geburtsdatum entfernt]");
    expect(result).toContain("[Anschrift entfernt]");
    expect(result).not.toMatch(/example|12345678|1970|Teststraße|10115|Berlin/);
  });
  it("does not rewrite existing records when deploying the correction", async () => {
    const result = await db.query<{ value: string }>("select eingabe_daten->>'anamnese' as value from public.therapy_sessions where id=1");
    expect(result.rows[0].value).toBe(originalResult);
  });
  it("preserves complete nested clinical input through the actual database trigger and readback", async () => {
    const input = { pseudonymId: "SYNTH-POSTAL", anamnese: form.repeat(1000), anamneseDatum: "2026-09-18", anamnesisIntakeV1: { unresolved: [form] }, medikamente: "Vitamin D3 1000 IE täglich", anamneseZusatz: { allergies: "Keine sichere Zuordnung" } };
    await db.query("insert into public.therapy_sessions (id, eingabe_daten, befund_meta, befund_html, empfehlung, notiz) values (2, $1::jsonb, $2::jsonb, $3, $3, $3)", [JSON.stringify(input), JSON.stringify({ source: form }), form]);
    const result = await db.query<{ eingabe_daten: unknown; befund_meta: unknown; befund_html: string; empfehlung: string; notiz: string }>("select * from public.therapy_sessions where id=2");
    expect(result.rows[0].eingabe_daten).toEqual(input);
    expect(result.rows[0].befund_meta).toEqual({ source: form });
    for (const key of ["befund_html", "empfehlung", "notiz"] as const) expect(result.rows[0][key]).toBe(form);
    await db.query("update public.therapy_sessions set eingabe_daten=$1::jsonb where id=2", [JSON.stringify({ ...input, anamnese: form })]);
    const reread = await db.query<{ value: string }>("select eingabe_daten->>'anamnese' as value from public.therapy_sessions where id=2");
    expect(reread.rows[0].value).toBe(form);
  });
  it("fails closed rather than overwriting an unexpected database function", async () => {
    await expect(db.exec(correction)).rejects.toThrow(/baseline differs/);
    expect(await redact(form)).toBe(form);
  });
});
