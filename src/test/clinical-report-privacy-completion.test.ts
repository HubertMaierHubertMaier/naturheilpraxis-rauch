import { describe, expect, it } from "vitest";
import { prepareClinicalReportHtml } from "@/lib/clinicalReportHtml";
import { parseSourceHistoryReport } from "@/lib/analysisSourceHistory";
import { deidentifyClinicalReportHtml, isBlockedClinicalReportHtml } from "../../supabase/functions/_shared/clinicalDeidentification";

const pid = "SYNTH-UI-74ced0ea-17bf-4540-92b8-cfd1e914d8ea";
const header = `<div><strong>Datum:</strong> 14.09.2099 · <strong>Patient:</strong> ${pid} · <strong>Umfang:</strong> 5.728 Zeichen / 8 Teilpakete</div>`;

describe("clinical report privacy and completion gate", () => {
  it("does not discard encoded pseudo-tags containing a visible name", () => {
    expect(() => deidentifyClinicalReportHtml('<p>Patient: [personenbezogene Angabe entfernt]&lt;Beispiel Person&gt;</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it.each(["&Tab;", "&NewLine;", "&#9", "&#xA"])("blocks identities separated by browser-decoded whitespace %s", separator => {
    expect(() => deidentifyClinicalReportHtml(`<p>Patient:${separator}Beispiel${separator}Person</p>`, pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("does not let encoded field labels or unsupported character references bypass inspection", () => {
    expect(() => deidentifyClinicalReportHtml('<p>Patient&colon;&Tab;Beispiel&Tab;Person</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(() => deidentifyClinicalReportHtml('<p>N&#97me&colon; Beispiel Person</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(() => deidentifyClinicalReportHtml('<p>Ungeprüftes Zeichen &Aopf;</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(deidentifyClinicalReportHtml('<p>Wörtliches Beispiel: &amp;colon;</p>', pid)).toContain("&amp;colon;");
  });
  it("accepts an already redacted quoted field followed only by encoded punctuation", () => {
    const html = deidentifyClinicalReportHtml('<pre>Originaltext (Name: [personenbezogene Angabe entfernt])&quot;,</pre>', pid);
    expect(html).toContain("[personenbezogene Angabe entfernt]");
    expect(html).toContain("&quot;");
  });
  it("inspects adjacent redacted name fields separately without authorizing a real suffix", () => {
    const html = deidentifyClinicalReportHtml('<p>Name: [personenbezogene Angabe entfernt], Vorname: [personenbezogene Angabe entfernt])</p>', pid);
    expect(html).toContain("Vorname");
    expect(() => deidentifyClinicalReportHtml('<p>Name: [personenbezogene Angabe entfernt] Beispiel-Person, Vorname: [personenbezogene Angabe entfernt]</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("preserves the fixed unanswered employment question but does not exempt added identity data", () => {
    const question = '<p>Welche berufliche Tätigkeit hat der Patient [personenbezogene Angabe entfernt], bei welchem Arbeitgeber und in welcher Branche?</p>';
    expect(deidentifyClinicalReportHtml(question, pid)).toContain("bei welchem Arbeitgeber und in welcher Branche?");
    expect(() => deidentifyClinicalReportHtml(question.replace("entfernt],", "entfernt] Beispiel-Person,"), pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(() => deidentifyClinicalReportHtml(question.replace("Branche?", "Branche Beispiel-Person?"), pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("preserves a fixed missing-answer notice without exempting added values", () => {
    const html = '<p>Rückfrage an den Patient [personenbezogene Angabe entfernt], da keine eindeutigen Antworten oder Markierungen erkennbar sind. Bitte prüfen, ob hierzu Angaben vorliegen.</p>';
    expect(deidentifyClinicalReportHtml(html, pid)).toContain("keine eindeutigen Antworten");
    expect(() => deidentifyClinicalReportHtml(html.replace("Angaben vorliegen.", "Angaben Beispiel-Person vorliegen."), pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("still blocks encoded identity suffixes behind a redaction marker", () => {
    expect(() => deidentifyClinicalReportHtml('<p>Patient: [personenbezogene Angabe entfernt]&#32;Beispiel&#45;Person</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(() => deidentifyClinicalReportHtml('<p>Patient: [personenbezogene Angabe entfernt]&#10;Beispiel-Person</p>', pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("decodes entities only for inspection, never into executable returned markup", () => {
    const html = deidentifyClinicalReportHtml('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>', pid);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("neutralizes a free code while preserving adjacent report metadata", () => {
    const html = prepareClinicalReportHtml(`${header}<h2>Strukturierte Anamnese</h2><p>Synthetischer Testinhalt.</p>`, pid);
    expect(html).not.toContain(pid); expect(html).toContain("[personenbezogene Angabe entfernt]"); expect(html).toContain("5.728 Zeichen"); expect(html).toContain("Strukturierte Anamnese");
    expect(isBlockedClinicalReportHtml(html)).toBe(false);
  });
  it("keeps only the selected canonical pseudonym and never reconstructs a foreign code", () => {
    const html = deidentifyClinicalReportHtml("<p>Fall-Nr.: P-9999-0000</p><p>Patient: P-2099-0101</p>", "p-2099-0101");
    expect(html).not.toContain("P-9999-0000"); expect(html).toContain("Patient: P-2099-0101");
  });
  it("does not turn an arbitrary name-shaped request identifier into an exemption", () => {
    const html = deidentifyClinicalReportHtml("<p>Name: Beispiel-Person</p>", "Beispiel-Person");
    expect(html).not.toContain("Beispiel-Person"); expect(html).toContain("entfernt");
    expect(() => deidentifyClinicalReportHtml("<p>Name: Beispiel Person</p>", "Beispiel Person")).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("does not authorize a different custom patient code", () => {
    expect(() => prepareClinicalReportHtml("<p>Patient: OTHER-991</p>", pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("does not authorize a longer identifier merely sharing the selected prefix", () => {
    expect(() => deidentifyClinicalReportHtml(`<p>Patient: ${pid}-OTHER</p>`, pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("keeps custom pseudonym comparisons case-sensitive", () => {
    expect(() => deidentifyClinicalReportHtml("<p>Patient: CUSTOM-991</p>", "custom-991")).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("never reconstructs a removed identifier from the current context", () => {
    const html = prepareClinicalReportHtml("<p>Patient: [personenbezogene Angabe entfernt]</p>", pid);
    expect(html).not.toContain(pid); expect(html).toContain("[personenbezogene Angabe entfernt]");
  });
  it("does not hide an unredacted suffix behind an existing marker or an expected code", () => {
    expect(() => prepareClinicalReportHtml("<p>Patient: [personenbezogene Angabe entfernt] <span>Beispiel-Person</span></p>", pid)).toThrow(/Datenschutz-Sicherheitsstopp/);
    expect(() => prepareClinicalReportHtml("<p>Patient: P-2099-0101 Beispiel-Person</p>", "P-2099-0101")).toThrow(/Datenschutz-Sicherheitsstopp/);
  });
  it("rejects old privacy-stop placeholders instead of returning a success-shaped document", () => {
    expect(() => prepareClinicalReportHtml("<h1>Datenschutz-Sicherheitsstopp</h1><p>Ausgabe gesperrt.</p>", pid)).toThrow(/keine vollständige Auswertung/);
  });
  it("does not count an explicitly rejected old report as completed source history", () => {
    const entry = { sourceId: "anamnese:intro", label: "Anamnese", group: "befund", contentSha256: "a".repeat(64), chars: 42, lines: 1 };
    const meta = { strict_complete: true, source_manifest_v1: [entry] };
    expect(parseSourceHistoryReport({ befund_meta: meta }).entries).toHaveLength(1);
    expect(parseSourceHistoryReport({ befund_meta: { ...meta, analysis_validation_status: "blocked" } }).entries).toEqual([]);
  });
  it("removes executable content before accepting a report", () => {
    const html = prepareClinicalReportHtml(`<script>alert(1)</script><img src="https://invalid.example/x"><p>Patient: ${pid}</p>`, pid);
    expect(html).not.toContain("<script"); expect(html).not.toContain("https://invalid.example"); expect(html).not.toContain(pid);
  });
  it("keeps repeated report preparation stable for saved-report reloads", () => {
    const html = prepareClinicalReportHtml(`${header}<h2>Laborwert-Verlauf</h2><p>Ferritin 30 µg/l.</p>`, pid);
    expect(prepareClinicalReportHtml(html, pid)).toBe(html);
  });
});
