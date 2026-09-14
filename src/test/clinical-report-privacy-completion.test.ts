import { describe, expect, it } from "vitest";
import { prepareClinicalReportHtml } from "@/lib/clinicalReportHtml";
import { parseSourceHistoryReport } from "@/lib/analysisSourceHistory";
import { deidentifyClinicalReportHtml, isBlockedClinicalReportHtml } from "../../supabase/functions/_shared/clinicalDeidentification";

const pid = "SYNTH-UI-74ced0ea-17bf-4540-92b8-cfd1e914d8ea";
const header = `<div><strong>Datum:</strong> 14.09.2099 · <strong>Patient:</strong> ${pid} · <strong>Umfang:</strong> 5.728 Zeichen / 8 Teilpakete</div>`;

describe("clinical report privacy and completion gate", () => {
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
