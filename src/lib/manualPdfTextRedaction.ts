import { deidentifyClinicalText, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";
import { validateManualPdfRedactions, type ManualPdfRedaction } from "./manualPdfRedaction";

export type PositionedManualPdfText = { text: string; x: number; y: number; width: number; height: number };
export type PositionedManualPdfOcrWord = PositionedManualPdfText & { lineText?: string };
type ManualTextTarget = { text: string; providerBound: boolean; sourceLines: string[] };
type ManualPageTextRedaction = { width: number; height: number; scope?: string; targets: ManualTextTarget[]; unresolved: boolean };
const redactions = new WeakMap<Blob, Map<number, ManualPageTextRedaction>>();
const providerLabel = /\b(?:empfohlen\s+von|hausarzt|facharzt|fachärzte|name\s*\/\s*ort|physiotherapeut(?:in)?|psychotherapeut(?:in)?|behandler(?:in)?|arzt|ärztin|therapeut(?:in|en)?|verordnet\s+von|unterschrift|stempel)\b/iu;
const clinicalValue = /(?:\d|\b(?:mg|µg|ug|ng|mmol|mol|ml|l|iu|ie|rmssd|hrv|iaa)\b)/iu;
const intersects = (left: PositionedManualPdfText, right: ManualPdfRedaction) => (
  left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
);
const contains = (outer: ManualPdfRedaction, inner: PositionedManualPdfText) => (
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height
);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const targetPattern = (target: string) => new RegExp(`(?<![\\p{L}\\p{N}'’−-])${escape(target.trim()).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}'’−-])`, "giu");
const normalizedLine = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

function lineAt(text: string, index: number) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end < 0 ? text.length : end);
}

function identityContext(line: string) {
  return directIdentifierCategories(line).includes("Name") || providerLabel.test(line);
}

function ocrProviderContext(word: PositionedManualPdfOcrWord, lines: readonly PositionedManualPdfText[]) {
  if (word.lineText && identityContext(word.lineText)) return true;
  return lines.some(line => providerLabel.test(line.text)
    && line.y <= word.y + word.height
    && word.y - (line.y + line.height) <= Math.max(80, word.height * 5));
}

function addTarget(targets: Map<string, ManualTextTarget>, text: string, providerBound: boolean, sourceLine?: string) {
  const normalized = text.trim();
  if (!normalized) return;
  const current = targets.get(normalized);
  targets.set(normalized, { text: normalized, providerBound: Boolean(current?.providerBound) || providerBound,
    sourceLines: Array.from(new Set([...(current?.sourceLines || []), ...(sourceLine ? [sourceLine] : [])])) });
}

/** Records only minimal native/OCR word boxes intersected by a confirmed local page mask. */
export function rememberManualPdfTextRedactions(
  file: Blob,
  page: number,
  rectangles: unknown,
  width: number,
  height: number,
  nativeWords: readonly PositionedManualPdfText[],
  scope?: string,
  ocrWords: readonly PositionedManualPdfOcrWord[] = [],
  ocrLines: readonly PositionedManualPdfText[] = [],
) {
  if (!Number.isInteger(page) || page < 1) throw new Error("Manuelle PDF-Textschwärzung hat keine gültige Seite.");
  const checked = validateManualPdfRedactions(rectangles, width, height);
  const targets = new Map<string, ManualTextTarget>();
  let unresolved = false;
  for (const word of nativeWords.filter(word => word.text.trim() && checked.some(rectangle => intersects(word, rectangle)))) {
    const tokenCount = word.text.trim().split(/\s+/).length;
    const fullyCovered = checked.some(rectangle => contains(rectangle, word));
    // PDF.js can combine a name and a measurement into one text item. A partial
    // hit has no trustworthy character geometry, so it must never remove the run.
    if ((tokenCount > 1 && !fullyCovered) || (tokenCount > 1 && clinicalValue.test(word.text))) {
      unresolved = true;
      continue;
    }
    addTarget(targets, word.text, false);
  }
  for (const word of ocrWords.filter(word => word.text.trim() && checked.some(rectangle => intersects(word, rectangle)))) {
    addTarget(targets, word.text, ocrProviderContext(word, ocrLines), word.lineText);
  }
  let pages = redactions.get(file);
  if (!pages) { pages = new Map(); redactions.set(file, pages); }
  pages.set(page, {
    width,
    height,
    scope,
    targets: Array.from(targets.values()),
    unresolved: unresolved || targets.size === 0,
  });
}

function redactTargetsInPage(pageText: string, targets: readonly ManualTextTarget[]) {
  const edits: Array<{start:number;end:number}> = [];
  for (const target of targets) {
    const matches = Array.from(pageText.matchAll(targetPattern(target.text)));
    if (!matches.length) {
      if (pageText.split("\n").some(line => providerLabel.test(line) && directIdentifierCategories(line).length)) {
        throw new Error("Manuelle PDF-Schwärzung konnte nicht eindeutig an den Auswertungstext gebunden werden.");
      }
      continue;
    }
    const contexts = matches.map(match => match.index === undefined ? "" : lineAt(pageText, match.index));
    if (target.sourceLines.length) {
      const expected = new Set(target.sourceLines.flatMap(line => [normalizedLine(line), normalizedLine(deidentifyClinicalText(line))]));
      if (contexts.some(line => !expected.has(normalizedLine(line)))) {
        throw new Error("Manuelle PDF-Schwärzung würde klinischen Text außerhalb der gebundenen Quellzeile verändern.");
      }
    } else if (matches.length !== 1) {
      throw new Error("Manuelle PDF-Schwärzung würde klinischen Text ohne eindeutige Quellzeile verändern.");
    }
    const allIdentityBound = contexts.every(identityContext);
    // A word on its own below a provider label is valid only when its OCR geometry
    // bound it to that label and it occurs exactly once on this source page.
    if (!allIdentityBound && (!target.providerBound || matches.length !== 1)) {
      throw new Error("Manuelle PDF-Schwärzung würde klinischen Text ohne eindeutige Namens-/Behandlerbindung verändern.");
    }
    for (const match of matches) edits.push({start:match.index!,end:match.index!+match[0].length});
  }
  // Match all words against the unchanged page, so a first masked name word does
  // not invalidate the source-line evidence for the next word in that same name.
  const merged: Array<{start:number;end:number}> = [];
  for (const edit of edits.sort((a,b)=>a.start-b.start||b.end-a.end)) {
    const previous=merged.at(-1);
    if(previous&&edit.start<previous.end)previous.end=Math.max(previous.end,edit.end);
    else merged.push({...edit});
  }
  let output=pageText;
  for(const edit of merged.reverse())output=output.slice(0,edit.start)+"[personenbezogene Angabe entfernt]"+output.slice(edit.end);
  return output;
}

export function clearManualPdfTextRedactions(file: Blob) { redactions.delete(file); }

/** Applies only page-/blob-/case-bound manual spans; uncertain mappings fail closed. */
export function applyManualPdfTextRedactions(file: Blob, text: string, scope?: string) {
  const pages = redactions.get(file);
  if (!pages?.size) return text;
  let result = text;
  for (const [page, redaction] of pages) {
    if (redaction.scope !== scope) throw new Error("Manuelle PDF-Schwärzung gehört nicht zum aktuellen Patientenfall. Die Übernahme bleibt gesperrt.");
    if (redaction.unresolved) throw new Error("Manuelle PDF-Schwärzung enthält keine eindeutig bindbare Textposition. Die Übernahme bleibt gesperrt.");
    const marker = `--- Seite ${page} ---`;
    const start = result.indexOf(marker);
    if (start < 0) throw new Error("Manuelle PDF-Schwärzung passt nicht zur ausgelesenen Dokumentseite. Die Übernahme bleibt gesperrt.");
    const contentStart = start + marker.length;
    const nextMarker = result.indexOf("\n--- Seite ", contentStart);
    const pageText = result.slice(contentStart, nextMarker < 0 ? result.length : nextMarker);
    const redacted = redactTargetsInPage(pageText, redaction.targets);
    result = `${result.slice(0, contentStart)}${redacted}${nextMarker < 0 ? "" : result.slice(nextMarker)}`;
  }
  return result;
}
