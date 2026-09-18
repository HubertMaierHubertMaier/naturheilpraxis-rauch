import { deidentifyClinicalText, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";
import { validateManualPdfRedactions, type ManualPdfRedaction } from "./manualPdfRedaction";

export type PositionedManualPdfText = { text: string; x: number; y: number; width: number; height: number };
export type PositionedManualPdfOcrWord = PositionedManualPdfText & { lineText?: string };
export type ManualPdfTextBindingCode = "MANUAL_TEXT_SCOPE" | "MANUAL_TEXT_POSITION" | "MANUAL_TEXT_PAGE" | "MANUAL_TEXT_CONTEXT";
export class ManualPdfTextBindingError extends Error {
  readonly phase = "text-binding" as const;
  constructor(readonly code: ManualPdfTextBindingCode, readonly page: number, message: string) {
    super(message);
    this.name = "ManualPdfTextBindingError";
  }
}
export function manualPdfTextBindingStatus(error: unknown) {
  if (!(error instanceof ManualPdfTextBindingError)) return undefined;
  return {
    phase: error.phase,
    code: error.code,
    page: error.page,
    label: "PDF-Textabgleich",
    message: `Die lokale Bildkopie ist vorbereitet, aber der Textabgleich auf Seite ${error.page} (${error.code}) ist offen. Es wurde nichts übernommen oder übertragen.`,
  };
}
type ManualTextTarget = { text: string; providerBound: boolean; fullyCovered: boolean; sourceLines: string[]; sourceCounts: Map<string,number> };
type ManualPageTextRedaction = { width: number; height: number; scope?: string; targets: ManualTextTarget[]; unresolved: boolean };
const redactions = new WeakMap<Blob, Map<number, ManualPageTextRedaction>>();
// Local-only context: never include the original text in extraction results or drafts.
const originalContexts = new WeakMap<Blob,{text:string;lines:Map<string,string>}>();
let contextMarkerSequence=0;
export function rememberOriginalPdfTextContext(file:Blob,text:string){
  if(originalContexts.get(file)?.text!==text)originalContexts.set(file,{text,lines:new Map()});
}
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

function addTarget(targets: Map<string, ManualTextTarget>, text: string, providerBound: boolean, sourceLine?: string, fullyCovered = false) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return;
  const current = targets.get(normalized);
  const sourceCounts=new Map(current?.sourceCounts);
  if(sourceLine){const key=normalizedLine(sourceLine);sourceCounts.set(key,(sourceCounts.get(key)||0)+1);}
  targets.set(normalized, { text: current?.text || text.trim(), providerBound: Boolean(current?.providerBound) || providerBound, fullyCovered: fullyCovered && (current?.fullyCovered ?? true), sourceCounts,
    sourceLines: Array.from(new Set([...(current?.sourceLines || []), ...(sourceLine ? [sourceLine] : [])])) });
}

function uniqueOriginalLine(file: Blob, page: number, text: string): string | undefined {
  const original = originalContexts.get(file)?.text;
  if (!original) return undefined;
  const start = original.indexOf(`--- Seite ${page} ---`);
  if (start < 0) return undefined;
  const end = original.indexOf("\n--- Seite ", start + 1);
  const body = original.slice(start, end < 0 ? undefined : end);
  const matches = [...body.matchAll(targetPattern(text))];
  if (matches.length !== 1) return undefined;
  const line = lineAt(body, matches[0].index!);
  return targetPattern(text).test(line) ? line : undefined;
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
    // Prefer the more precise OCR row for a duplicate native word. Counting both
    // representations would falsely require two occurrences in the source text.
    if (ocrWords.some(ocr => normalizedLine(ocr.text) === normalizedLine(word.text) && intersects(ocr, word))) continue;
    addTarget(targets, word.text, false, uniqueOriginalLine(file, page, word.text), fullyCovered);
  }
  for (const word of ocrWords.filter(word => word.text.trim() && checked.some(rectangle => intersects(word, rectangle)))) {
    addTarget(targets, word.text, ocrProviderContext(word, ocrLines), word.lineText, checked.some(rectangle => contains(rectangle, word)));
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

function contextualLine(file:Blob,page:number,line:string){
  const context=originalContexts.get(file);
  if(!context)return deidentifyClinicalText(line);
  const previous=context.lines.get(line);if(previous!==undefined)return previous;
  let marker:string;
  do{marker=`\uE000LOCALREVIEWBOUNDARY${++contextMarkerSequence}\uE001`;}while(context.text.includes(marker)||line.includes(marker));
  // Obtain the same name-discovery context as the original full-document pass.
  // Only its final line is used for matching; the existing safe output is not replaced.
  const safe=deidentifyClinicalText(`${context.text}\n${marker}\n${line}`);
  const at=safe.lastIndexOf(marker);
  if(at<0)throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT",page,"Lokaler Dokumentkontext konnte nicht eindeutig abgeglichen werden.");
  const result=safe.slice(at+marker.length).trim();context.lines.set(line,result);return result;
}

function redactTargetsInPage(file:Blob,page: number, pageText: string, targets: readonly ManualTextTarget[]) {
  const edits: Array<{start:number;end:number}> = [];
  for (const target of targets) {
    const matches = Array.from(pageText.matchAll(targetPattern(target.text)));
    if (!matches.length) {
      if (pageText.split("\n").some(line => providerLabel.test(line) && directIdentifierCategories(line).length)) {
        throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT", page, "Manuelle PDF-Schwärzung konnte nicht eindeutig an den Auswertungstext gebunden werden.");
      }
      continue;
    }
    let selected=matches;
    let selectedContexts=matches.map(match=>lineAt(pageText,match.index!));
    if (target.sourceLines.length) {
      const groups=new Map<string,{variants:Set<string>;count:number;alreadyRemoved:boolean}>();
      for(const line of target.sourceLines){
        const key=normalizedLine(line);
        if(groups.has(key))continue;
        const safe=contextualLine(file,page,line);
        const alreadyRemoved=safe!==line&&!targetPattern(target.text).test(safe)
          &&pageText.split("\n").some(actual=>normalizedLine(actual)===normalizedLine(safe));
        groups.set(key,{variants:new Set([key,normalizedLine(safe)]),count:target.sourceCounts.get(key)||1,alreadyRemoved});
      }
      const expected=new Set([...groups.values()].flatMap(group=>[...group.variants]));
      selected=matches.filter(match=>expected.has(normalizedLine(lineAt(pageText,match.index!))));
      selectedContexts=selected.map(match=>lineAt(pageText,match.index!));
      if(!selected.length){
        // A source line already scrubbed by the document pass must not cause a
        // remaining identical clinical word elsewhere to be erased.
        const alreadyRemoved=[...groups.values()].every(group=>group.alreadyRemoved);
        if(alreadyRemoved)continue;
        throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT",page,"Manuelle PDF-Schwärzung hat keine eindeutig gebundene Quellzeile im Text.");
      }
      for(const group of groups.values()){
        const count=selectedContexts.filter(line=>group.variants.has(normalizedLine(line))).length;
        if(count>group.count)throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT",page,"Identische Quellzeilen sind nicht eindeutig den ausgewählten Textpositionen zugeordnet.");
        if(count!==group.count&&!(count===0&&group.alreadyRemoved))throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT",page,"Nicht alle markierten Quellzeilen konnten eindeutig abgeglichen werden.");
      }
    } else if (matches.length !== 1) {
      throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT", page, "Manuelle PDF-Schwärzung würde klinischen Text ohne eindeutige Quellzeile verändern.");
    }
    const allIdentityBound = selectedContexts.every(identityContext);
    // A fully covered, explicitly reviewed word with an exact source-row binding
    // does not need a name/provider keyword. Unbound or partial spans still stop.
    const confirmedSourceBound = target.fullyCovered && target.sourceLines.length > 0;
    if (!confirmedSourceBound && !allIdentityBound && !target.providerBound) {
      throw new ManualPdfTextBindingError("MANUAL_TEXT_CONTEXT", page, "Manuelle PDF-Schwärzung würde klinischen Text ohne eindeutige Namens-/Behandlerbindung verändern.");
    }
    for (const match of selected) edits.push({start:match.index!,end:match.index!+match[0].length});
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
    if (redaction.scope !== scope) throw new ManualPdfTextBindingError("MANUAL_TEXT_SCOPE", page, "Manuelle PDF-Schwärzung gehört nicht zum aktuellen Patientenfall. Die Übernahme bleibt gesperrt.");
    if (redaction.unresolved) throw new ManualPdfTextBindingError("MANUAL_TEXT_POSITION", page, "Manuelle PDF-Schwärzung enthält keine eindeutig bindbare Textposition. Die Übernahme bleibt gesperrt.");
    const marker = `--- Seite ${page} ---`;
    const start = result.indexOf(marker);
    if (start < 0) throw new ManualPdfTextBindingError("MANUAL_TEXT_PAGE", page, "Manuelle PDF-Schwärzung passt nicht zur ausgelesenen Dokumentseite. Die Übernahme bleibt gesperrt.");
    const contentStart = start + marker.length;
    const nextMarker = result.indexOf("\n--- Seite ", contentStart);
    const pageText = result.slice(contentStart, nextMarker < 0 ? result.length : nextMarker);
    const redacted = redactTargetsInPage(file, page, pageText, redaction.targets);
    result = `${result.slice(0, contentStart)}${redacted}${nextMarker < 0 ? "" : result.slice(nextMarker)}`;
  }
  return result;
}
