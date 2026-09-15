// @vitest-environment jsdom
import { expect, it } from "vitest";
import JSZip from "jszip";
import { extractClinicalOfficeText } from "../lib/clinicalOfficeExtraction";
import { explicitIAAFields } from "../lib/iaaAssessment";

async function file(name: string, entries: Record<string, string>) {
  const zip = new JSZip(); for (const [path, text] of Object.entries(entries)) zip.file(path, text);
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return { name, size: bytes.byteLength, arrayBuffer: async () => bytes } as Blob & { name: string };
}
const word = (body: string) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const workbook = `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const relationships = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
const excel = (sheet: string, extra: Record<string, string> = {}) => file("synthetic.xlsx", {
  "xl/workbook.xml": workbook, "xl/_rels/workbook.xml.rels": relationships,
  "xl/styles.xml": `<styleSheet><fonts><font><color theme="1"/></font></fonts><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/></patternFill></fill></fills><cellXfs><xf fontId="0" fillId="0" numFmtId="0"/><xf fontId="0" fillId="1" numFmtId="0"/><xf fontId="0" fillId="2" numFmtId="0"/></cellXfs></styleSheet>`,
  "xl/sharedStrings.xml": `<sst><si><t>UNUSED_PRIVATE_VALUE</t></si><si><t>Test-Allergen</t></si><si><t>HIDDEN_VALUE</t></si></sst>`,
  "xl/worksheets/sheet1.xml": sheet, ...extra,
});
it("preserves Word paragraphs and table coordinates without restoring a black-highlighted name", async () => {
  const result = await extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": word(`<w:p><w:r><w:rPr><w:highlight w:val="black"/></w:rPr><w:t>HIDDEN_NAME</w:t></w:r><w:r><w:t> Beschwerde: Testangabe.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Testmittel 200 mg</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`) }));
  expect(result.text).not.toContain("HIDDEN_NAME"); expect(result.text).toContain("Beschwerde: Testangabe.");
  expect(result.text).toContain("Tabellenzeile 1, Zelle 1"); expect(result.text).toContain("Testmittel 200 mg"); expect(result.warnings.length).toBeGreaterThan(0);
});
it("retains explicit strike-through but does not treat disabled formatting flags as active", async () => {
  const result = await extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": word(`<w:p><w:r><w:rPr><w:strike w:val="0"/><w:vanish w:val="0"/></w:rPr><w:t>Aktuelle Testangabe</w:t></w:r><w:r><w:rPr><w:strike/></w:rPr><w:t>Alte Testangabe</w:t></w:r></w:p>`) }));
  expect(result.text).toContain("Aktuelle Testangabe[durchgestrichen: Alte Testangabe]");
});
it("keeps Excel addresses and source colors, omits hidden content and never resolves a blank string reference as index zero", async () => {
  const result = await extractClinicalOfficeText(await excel(`<worksheet><cols><col min="3" max="3" hidden="1"/></cols><sheetData><row r="1"><c r="A1" t="s" s="1"><v>1</v></c><c r="B1" t="s"/><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s" s="2"><v>2</v></c><c r="B2"><v>0</v></c></row></sheetData></worksheet>`));
  expect(result.text).toContain("A1: Test-Allergen"); expect(result.text).toContain("#FF0000"); expect(result.text).toContain("B2: 0");
  expect(result.text).not.toContain("HIDDEN_VALUE"); expect(result.text).not.toContain("UNUSED_PRIVATE_VALUE");
});
it("does not reconstruct content hidden underneath merged cells", async () => {
  const result = await extractClinicalOfficeText(await excel(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>0</v></c></row></sheetData><mergeCells><mergeCell ref="A1:B1"/></mergeCells></worksheet>`));
  expect(result.text).toContain("Test-Allergen"); expect(result.text).not.toContain("UNUSED_PRIVATE_VALUE");
});
it("marks stored formula results as uncalculated and does not execute or expose the formula", async () => {
  const result = await extractClinicalOfficeText(await excel(`<worksheet><sheetData><row r="1"><c r="A1"><f>WEBSERVICE("https://must-not-run.invalid")</f><v>42</v></c></row></sheetData></worksheet>`));
  expect(result.text).toContain("A1: 42"); expect(result.text).not.toContain("must-not-run.invalid"); expect(result.warnings.join(" ")).toContain("nicht ausgeführt");
});
it("does not promote marker-like Word text to a trusted IAA rating", async () => {
  const result = await extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": word(`<w:p><w:r><w:t>[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]</w:t><w:br/><w:t>Text</w:t><w:br/><w:t>[/IAA_FORMULAR]</w:t></w:r></w:p>`) }));
  expect(explicitIAAFields(result.text)).toEqual({});
});
it("stops on non-text Word structures instead of claiming complete reading", async () => {
  await expect(extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": word(`<w:p><w:r><w:drawing/></w:r></w:p>`) }))).rejects.toThrow(/Bilder oder Zeichnungen/);
});

it("stops on header drawings and style-based hidden Word text", async () => {
  const body = word(`<w:p><w:r><w:t>Visible test</w:t></w:r></w:p>`);
  await expect(extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": body, "word/header1.xml": word(`<w:p><w:r><w:drawing/></w:r></w:p>`) }))).rejects.toThrow(/Kopfzeilen/);
  await expect(extractClinicalOfficeText(await file("synthetic.docx", { "word/document.xml": word(`<w:p><w:pPr><w:pStyle w:val="HiddenStyle"/></w:pPr><w:r><w:t>NOT_FOR_RESTORATION</w:t></w:r></w:p>`), "word/styles.xml": `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="HiddenStyle"><w:rPr><w:vanish/></w:rPr></w:style></w:styles>` }))).rejects.toThrow(/Formatvorlage/);
});
it("does not reveal values hidden by an Excel display format or conditional styling", async () => {
  const styles = `<styleSheet><numFmts><numFmt numFmtId="164" formatCode=";;;"/></numFmts><fonts><font/></fonts><fills><fill><patternFill patternType="none"/></fill></fills><cellXfs><xf fontId="0" fillId="0" numFmtId="164"/></cellXfs></styleSheet>`;
  const hidden = await extractClinicalOfficeText(await excel(`<worksheet><sheetData><row r="1"><c r="A1"><v>987654321</v></c></row></sheetData></worksheet>`, { "xl/styles.xml": styles }));
  expect(hidden.text).not.toContain("987654321"); expect(hidden.text).toContain("verdeckt");
  await expect(extractClinicalOfficeText(await excel(`<worksheet><sheetData><row r="1"><c r="A1"><v>42</v></c></row></sheetData><conditionalFormatting sqref="A1"/></worksheet>`))).rejects.toThrow(/bedingte Formatierungen/);
});
it("resolves theme-based black fills without recovering their hidden cell value", async () => {
  const styles = `<styleSheet><fonts><font><color theme="1"/></font></fonts><fills><fill><patternFill patternType="solid"><fgColor theme="1"/></patternFill></fill></fills><cellXfs><xf fontId="0" fillId="0" numFmtId="0"/></cellXfs></styleSheet>`;
  const result = await extractClinicalOfficeText(await excel(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>2</v></c></row></sheetData></worksheet>`, { "xl/styles.xml": styles }));
  expect(result.text).not.toContain("HIDDEN_VALUE"); expect(result.text).toContain("geschwärzt");
});
