import JSZip from "jszip";
import { escapeIAAFormMarkers } from "./iaaAssessment";

const parseXml = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Die Office-Datei enthält nicht lesbare XML-Daten.");
  return doc;
};
const elements = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS("*", name));
const attr = (element: Element | undefined, name: string) => element ? Array.from(element.attributes).find(a => a.localName === name)?.value || "" : "";
const enabled = (root: Element, name: string) => elements(root, name).some(e => !["0", "false", "off"].includes(attr(e, "val").toLowerCase()));
const trueValue = (value: string) => ["1", "true", "on"].includes(value.toLowerCase());
export const MAX_OFFICE_XML_BYTES = 8 * 1024 * 1024;
const columnNumber = (address: string) => Array.from(address.match(/^[A-Z]+/)?.[0] || "").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

export type OfficeTextResult = { text: string; warnings: string[]; format: "docx" | "xlsx" };
/** Local ZIP/XML parsing only. Never evaluate Office fields, formulas, macros or external links. */
export async function extractClinicalOfficeText(file: Blob & { name: string }): Promise<OfficeTextResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "docx" && extension !== "xlsx") throw new Error("Bitte Word als .docx oder Excel als .xlsx auswählen.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Die Office-Datei ist größer als 50 MB.");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  const declaredTotal = entries.reduce((sum, entry) => sum + Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0), 0);
  if (entries.length > 2000 || declaredTotal > 64 * 1024 * 1024) throw new Error("Die entpackte Office-Datei ist für den sicheren lokalen Import zu groß. Bitte in kleinere Dokumente aufteilen.");
  const warnings: string[] = []; const parts: string[] = []; let totalXmlBytes = 0;
  const load = async (path: string) => {
    const entry = zip.file(path); if (!entry) return null;
    const declared = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0);
    if (declared > MAX_OFFICE_XML_BYTES) throw new Error("Ein Office-XML-Teil ist für den lokalen Import zu groß.");
    const text = await new Promise<string>((resolve, reject) => {
      let value = "", bytes = 0, stopped = false; const decoder = new TextDecoder("utf-8", { fatal: true });
      const stream = (entry as typeof entry & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream("uint8array");
      const fail = (error: unknown) => { if (stopped) return; stopped = true; stream.pause(); reject(error); };
      stream.on("data", (chunk: Uint8Array) => {
        if (stopped) return; bytes += chunk.byteLength; totalXmlBytes += chunk.byteLength;
        if (bytes > MAX_OFFICE_XML_BYTES || totalXmlBytes > 24 * 1024 * 1024) { fail(new Error("Die Office-XML-Daten überschreiten die lokale Speichergrenze.")); return; }
        try { value += decoder.decode(chunk, { stream: true }); } catch { fail(new Error("Die Office-XML-Zeichenkodierung ist nicht sicher lesbar.")); }
      }).on("error", fail).on("end", () => { if (!stopped) { try { resolve(value + decoder.decode()); } catch { fail(new Error("Unvollständige Office-XML-Zeichenkodierung.")); } } }).resume();
    });
    return parseXml(text);
  };
  if (extension === "docx") {
    const doc = await load("word/document.xml");
    if (!doc) throw new Error("Der Word-Dokumentinhalt fehlt.");
    if (["drawing", "pict", "object"].some(name => elements(doc, name).length)) throw new Error("Diese Word-Datei enthält Bilder oder Zeichnungen. Für deren vollständige Prüfung bitte eine sichtbar geschwärzte PDF verwenden; die Originaldatei bleibt unverändert.");
    const styleDocument = await load("word/styles.xml");
    const styleMap = new Map(styleDocument ? elements(styleDocument, "style").map(style => [attr(style, "styleId"), style] as const) : []);
    const checkStyle = (id: string, visited = new Set<string>()) => {
      if (!id || visited.has(id)) return;
      visited.add(id); const style = styleMap.get(id); if (!style) return;
      if (enabled(style, "vanish") || enabled(style, "webHidden") || enabled(style, "specVanish")
        || elements(style, "highlight").some(e => attr(e, "val") === "black")
        || elements(style, "shd").some(e => attr(e, "fill").toUpperCase() === "000000" || !!attr(e, "themeFill") || (attr(e, "val") && !["clear", "nil"].includes(attr(e, "val"))))
        || elements(style, "color").some(e => attr(e, "val").toUpperCase() === "FFFFFF" || !!attr(e, "themeColor"))) {
        throw new Error("Eine Word-Formatvorlage kann Inhalte verdecken. Bitte die sichtbare Originalfassung prüfen; verdeckte Angaben werden nicht wiederhergestellt.");
      }
      checkStyle(attr(elements(style, "basedOn")[0], "val"), visited);
    };
    for (const style of styleMap.values()) if (trueValue(attr(style, "default"))) checkStyle(attr(style, "styleId"));
    const documentRelationships = await load("word/_rels/document.xml.rels");
    const referencedIds = new Map([...elements(doc, "headerReference"), ...elements(doc, "footerReference")].map(e => [attr(e, "id"), e.localName === "headerReference" ? "header" : "footer"]));
    const resolvedIds = new Set<string>(); const resolvedNotes = new Set<string>();
    const paths = ["word/document.xml"];
    const noteIds = new Map<string, Set<string>>();
    for (const [reference, relationshipType] of [["footnoteReference", "footnotes"], ["endnoteReference", "endnotes"]]) {
      const ids = new Set(elements(doc, reference).map(e => attr(e, "id")));
      if (ids.size) noteIds.set(relationshipType, ids);
    }
    for (const relationship of documentRelationships ? elements(documentRelationships, "Relationship") : []) {
      const kind = attr(relationship, "Type").split("/").pop() || "";
      const relationshipId = attr(relationship, "Id");
      if (!referencedIds.has(relationshipId) && !noteIds.has(kind)) continue;
      if (referencedIds.has(relationshipId) && referencedIds.get(relationshipId) !== kind) throw new Error("Word-Referenztyp passt nicht zum Dokumentteil.");
      resolvedIds.add(relationshipId); if (noteIds.has(kind)) resolvedNotes.add(kind);
      const target = attr(relationship, "Target");
      if (attr(relationship, "TargetMode") === "External" || target.split("/").includes("..") || /^[a-z]+:/i.test(target)) throw new Error("Eine Word-Referenz ist nicht sicher lokal zuordenbar.");
      const path = target.startsWith("/word/") ? target.slice(1) : target.startsWith("word/") ? target : `word/${target}`;
      if (!zip.file(path)) throw new Error("Ein referenzierter Word-Dokumentteil fehlt.");
      if (!paths.includes(path)) paths.push(path);
    }
    if ([...referencedIds.keys()].some(id => !resolvedIds.has(id)) || [...noteIds.keys()].some(kind => !resolvedNotes.has(kind))) throw new Error("Eine benötigte Word-Dokumentreferenz fehlt.");
    for (const [section, path] of paths.entries()) {
      const body = path === "word/document.xml" ? doc : await load(path); if (!body) continue;
      if (["drawing", "pict", "object"].some(name => elements(body, name).length)) throw new Error("Word-Kopfzeilen, Fußzeilen oder Anmerkungen enthalten Bilder/Zeichnungen. Bitte die vollständige sichtbare Fassung als PDF prüfen.");
      for (const name of ["pStyle", "rStyle", "tblStyle"]) for (const reference of elements(body, name)) checkStyle(attr(reference, "val"));
      let paragraph = 0;
      const tableRows = new Map(elements(body, "tr").map((row, index) => [row, index + 1] as const));
      for (const p of elements(body, "p")) {
        paragraph++;
        let note: Element | null = p;
        while (note && !["footnote", "endnote"].includes(note.localName)) note = note.parentElement;
        if (note && !noteIds.get(`${note.localName}s`)?.has(attr(note, "id"))) continue;
        const runText = elements(p, "r").map(run => {
          const colorElement = elements(run, "color")[0];
          if (attr(colorElement, "themeColor")) throw new Error("Word-Designfarben können Angaben verdecken; bitte die sichtbare Originalfassung prüfen.");
          const color = attr(colorElement, "val").toUpperCase();
          const highlight = attr(elements(run, "highlight")[0], "val").toLowerCase();
          let hidden = enabled(run, "vanish") || enabled(run, "webHidden") || enabled(run, "specVanish");
          const highlightColors: Record<string, string> = { black: "000000", white: "FFFFFF", blue: "0000FF", cyan: "00FFFF", green: "00FF00", magenta: "FF00FF", red: "FF0000", yellow: "FFFF00", darkblue: "000080", darkcyan: "008080", darkgreen: "008000", darkmagenta: "800080", darkred: "800000", darkyellow: "808000", darkgray: "808080", lightgray: "C0C0C0" };
          let background = highlightColors[highlight] || "";
          for (let parent: Element | null = run; parent; parent = parent.parentElement) {
            if (parent.localName === "del") hidden = true;
            const propertyName = ({ r: "rPr", p: "pPr", tc: "tcPr", tbl: "tblPr" } as Record<string, string>)[parent.localName];
            const properties = Array.from(parent.children).find(e => e.localName === propertyName);
            const shading = properties ? elements(properties, "shd")[0] : undefined;
            if (attr(shading, "themeFill") || (attr(shading, "val") && !["clear", "nil"].includes(attr(shading, "val")))) throw new Error("Word-Designschattierung oder Schattierungsmuster kann Text verdecken; bitte die sichtbare Originalfassung prüfen.");
            const fill = attr(shading, "val") === "nil" ? "" : attr(shading, "fill").toUpperCase();
            if (!background && /^[A-F0-9]{6}$/.test(fill)) background = fill;
          }
          hidden ||= (color || "000000") === (background || "FFFFFF");
          if (hidden) { warnings.push("Visuell verdeckte oder ausgeblendete Word-Angaben wurden nicht wiederhergestellt."); return "[geschwärzte oder ausgeblendete Angabe]"; }
          const text = Array.from(run.children).map(e => e.localName === "t" ? e.textContent || "" : e.localName === "tab" ? "\t" : e.localName === "br" ? "\n" : "").join("");
          return enabled(run, "strike") || enabled(run, "dstrike") ? `[durchgestrichen: ${text}]` : text;
        }).join("");
        if (runText.trim()) {
          const cell = (() => { for (let e: Element | null = p.parentElement; e; e = e.parentElement) if (e.localName === "tc") return e; return null; })();
          const row = cell?.parentElement;
          const cellHint = cell && row ? `, Tabellenzeile ${tableRows.get(row) || 0}, Zelle ${Array.from(row.children).filter(e => e.localName === "tc").indexOf(cell) + 1}` : "";
          parts.push(`[Word-Abschnitt ${section + 1}, Absatz ${paragraph}${cellHint}]\n${runText}`);
        }
      }
    }
    if (elements(doc, "fldChar").length || elements(doc, "sdt").length) warnings.push("Word-Felder/Formularsteuerelemente: gespeicherte Textdarstellung prüfen; Felder wurden nicht ausgeführt.");
  } else {
    const workbook = await load("xl/workbook.xml"); const relationships = await load("xl/_rels/workbook.xml.rels"); const styles = await load("xl/styles.xml"); const strings = await load("xl/sharedStrings.xml");
    if (!workbook || !relationships) throw new Error("Die Excel-Arbeitsmappenstruktur fehlt.");
    if (Object.keys(zip.files).some(p => /^xl\/(?:drawings|media)\//.test(p))) throw new Error("Diese Excel-Datei enthält Bilder oder Zeichnungen. Bitte deren Inhalte und mögliche Schwärzungen in einer PDF prüfen; die Originaldatei bleibt unverändert.");
    const richTextNeedsReview = new Set<number>();
    const shared = strings ? elements(strings, "si").map((e, index) => {
      if (elements(e, "color").length || elements(e, "strike").length) richTextNeedsReview.add(index);
      return elements(e, "t").filter(t => t.parentElement?.localName !== "rPh").map(t => t.textContent || "").join("");
    }) : [];
    const xfs = styles ? Array.from(elements(styles, "cellXfs")[0]?.children || []) : [];
    const fills = styles ? Array.from(elements(styles, "fills")[0]?.children || []) : [];
    const fonts = styles ? Array.from(elements(styles, "fonts")[0]?.children || []) : [];
    const formats = new Map(styles ? elements(styles, "numFmt").map(e => [attr(e, "numFmtId"), attr(e, "formatCode")]) : []);
    const theme = await load("xl/theme/theme1.xml");
    const themeNames = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
    const themeColors = themeNames.map((name, index) => {
      const entry = theme ? elements(theme, name)[0] : undefined;
      return entry ? attr(elements(entry, "srgbClr")[0], "val") || attr(elements(entry, "sysClr")[0], "lastClr") : index === 0 ? "FFFFFF" : index === 1 ? "000000" : "";
    });
    const palette = styles ? elements(styles, "indexedColors")[0] : undefined;
    const indexedColors = palette ? Array.from(palette.children).map(e => attr(e, "rgb").slice(-6)) : [];
    const resolveColor = (color: Element | undefined, fallback: string): string => {
      if (!color) return fallback;
      if (attr(color, "tint") && Number(attr(color, "tint")) !== 0) throw new Error("Abgestufte Excel-Zellfarben müssen am Original auf sichtbare oder verdeckte Angaben geprüft werden.");
      const rgb = attr(color, "rgb").slice(-6);
      const themeIndex = attr(color, "theme"); const indexed = attr(color, "indexed");
      const basic: Record<string, string> = { "0": "000000", "1": "FFFFFF", "8": "000000", "9": "FFFFFF" };
      const value = rgb || (themeIndex ? themeColors[Number(themeIndex)] : indexed ? indexedColors[Number(indexed)] || basic[indexed] || (indexed === "64" ? fallback : "") : fallback);
      if (!/^[a-f0-9]{6}$/i.test(value || "")) throw new Error("Die Excel-Zellfarbe ist nicht eindeutig auflösbar; keine ungeprüfte Klartextübernahme.");
      return value.toUpperCase();
    };
    for (const [index, sheetInfo] of elements(workbook, "sheet").entries()) {
      if (attr(sheetInfo, "state") && attr(sheetInfo, "state") !== "visible") { warnings.push("Ausgeblendete Tabellenblätter wurden nicht als sichtbare Angaben wiederhergestellt."); continue; }
      const relationship = elements(relationships, "Relationship").find(e => attr(e, "Id") === attr(sheetInfo, "id"));
      if (!relationship || attr(relationship, "TargetMode") === "External") throw new Error("Ein Tabellenblatt ist nicht lokal in der Excel-Datei enthalten.");
      const target = attr(relationship, "Target");
      if (target.split("/").includes("..") || /^[a-z]+:/i.test(target)) throw new Error("Ungültiger Tabellenblattpfad.");
      const path = target.startsWith("/xl/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
      const sheet = await load(path); if (!sheet) throw new Error("Ein Tabellenblatt konnte nicht gelesen werden.");
      const cellPosition = (address: string) => ({ col: columnNumber(address), row: Number(address.match(/\d+$/)?.[0] || 0) });
      const mergedRanges = elements(sheet, "mergeCell").map(e => attr(e, "ref").split(":").map(cellPosition));
      const hiddenColumns = elements(sheet, "col").filter(e => trueValue(attr(e, "hidden"))).map(e => [Number(attr(e, "min")), Number(attr(e, "max"))]);
      if (elements(sheet, "conditionalFormatting").length) throw new Error("Diese Excel-Datei nutzt bedingte Formatierungen. Deren Farben und mögliche verdeckte Angaben müssen in der sichtbaren Originalfassung geprüft werden; keine ungeprüfte Klartextübernahme.");
      for (const row of elements(sheet, "row")) {
        if (trueValue(attr(row, "hidden"))) { if (elements(row, "v").length) warnings.push("Ausgeblendete Excel-Zeilen enthalten weitere Angaben; Original lokal prüfen."); continue; }
        const cells: string[] = [];
        for (const cell of Array.from(row.children).filter(e => e.localName === "c")) {
          const address = attr(cell, "r");
          const position = cellPosition(address);
          if (mergedRanges.some(([a, b = a]) => position.col >= a.col && position.col <= b.col && position.row >= a.row && position.row <= b.row && (position.col !== a.col || position.row !== a.row))) continue;
          if (hiddenColumns.some(([a, b]) => columnNumber(address) >= a && columnNumber(address) <= b)) { if (elements(cell, "v").length) warnings.push("Ausgeblendete Excel-Spalten enthalten weitere Angaben; Original lokal prüfen."); continue; }
          const raw = elements(cell, "v")[0]?.textContent || ""; const type = attr(cell, "t");
          if (!raw && type !== "inlineStr") {
            if (elements(cell, "f").length) { cells.push(`${address}: [Formel ohne gespeichertes Ergebnis]`); warnings.push("Mindestens ein Excel-Formelergebnis fehlt; es wurde nicht als Null ersetzt."); }
            continue;
          }
          if (type === "s" && (!/^\d+$/.test(raw) || Number(raw) >= shared.length)) throw new Error("Ungültiger Excel-Textverweis; keine Ersetzung durch andere Inhalte.");
          if ((type === "s" && richTextNeedsReview.has(Number(raw))) || (type === "inlineStr" && (elements(cell, "color").length || elements(cell, "strike").length))) throw new Error("Farbige oder durchgestrichene Excel-Rich-Text-Angaben bitte zunächst am Original prüfen; verdeckte Werte werden nicht wiederhergestellt.");
          let value = type === "s" ? shared[Number(raw)] || "" : type === "inlineStr" ? elements(cell, "t").map(e => e.textContent || "").join("") : raw;
          if (!value.trim()) continue;
          const xf = xfs[Number(attr(cell, "s") || 0)]; const fill = fills[Number(attr(xf, "fillId") || 0)];
          if (fill && elements(fill, "gradientFill").length) throw new Error("Excel-Farbverläufe können Text verdecken; keine ungeprüfte Klartextübernahme.");
          const pattern = fill ? elements(fill, "patternFill")[0] : undefined; const patternType = attr(pattern, "patternType") || "none";
          if (!["none", "solid"].includes(patternType)) throw new Error("Gemusterte Excel-Zellen müssen am Original auf verdeckte Angaben geprüft werden.");
          const rgb = patternType === "solid" ? resolveColor(pattern ? elements(pattern, "fgColor")[0] : undefined, "FFFFFF") : "";
          const font = fonts[Number(attr(xf, "fontId") || 0)]; const fontColor = font ? elements(font, "color")[0] : undefined;
          const foreground = resolveColor(fontColor, "000000");
          if (foreground === (rgb || "FFFFFF")) { value = "[visuell geschwärzte Zelle]"; warnings.push("Visuell verdeckte Zellen wurden nicht als Klartext wiederhergestellt."); }
          const notes: string[] = [];
          if (rgb && rgb !== "000000") notes.push(`Original-Zellfarbe #${rgb}; Bedeutung nur nach Quellenlegende`);
          const formatId = attr(xf, "numFmtId") || "0";
          const formatCode = formats.get(formatId) || "";
          if (/\[(?:black|blue|cyan|green|magenta|red|white|yellow|color\s*\d+)\]/i.test(formatCode)) throw new Error("Excel-Anzeigeformate verändern die Textfarbe. Verdeckte Angaben werden nicht ungeprüft als Klartext übernommen.");
          if (formatCode && !formatCode.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/[;\s]/g, "")) {
            value = "[durch Excel-Anzeigeformat verdeckter Zellinhalt]";
            warnings.push("Durch Anzeigeformate verdeckte Zellwerte wurden nicht wiederhergestellt.");
          } else if (formatCode.includes(";") || /\[(?:[<>]=?|=)/.test(formatCode)) {
            throw new Error("Mehrteilige oder bedingte Excel-Anzeigeformate können Werte verdecken; bitte die sichtbare Originalfassung prüfen.");
          } else if (!["0", "49"].includes(formatId)) { notes.push(`Excel-Rohwert, Zahlenformat ${formatCode || formatId}`); warnings.push("Datums-/Zahlenformate am Original prüfen; Rohwerte und Formatangaben sind erhalten."); }
          if (elements(cell, "f").length) { notes.push("gespeichertes Formelergebnis, nicht neu berechnet"); warnings.push("Excel-Formeln wurden nicht ausgeführt; gespeicherte Ergebnisse auf Aktualität prüfen."); }
          cells.push(`${address}: ${value}${notes.length ? ` [${notes.join("; ")}]` : ""}`);
        }
        if (cells.length) parts.push(`[Excel-Blatt ${index + 1}, Zeile ${attr(row, "r")}]\n${cells.join("\n")}`);
      }
    }
  }
  if (!parts.length) throw new Error("Die Office-Datei enthält keinen sicher übernehmbaren sichtbaren Text.");
  return { text: escapeIAAFormMarkers(parts.join("\n\n")), warnings: [...new Set(warnings)], format: extension };
}
