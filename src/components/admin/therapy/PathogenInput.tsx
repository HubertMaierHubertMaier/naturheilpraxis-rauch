import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ClipboardPaste, List } from "lucide-react";

export interface PathogenEntry {
  id: string;
  name: string;
  organe: string;
  index: string;
}

interface Props {
  entries: PathogenEntry[];
  onChange: (entries: PathogenEntry[]) => void;
}

const newId = () => Math.random().toString(36).slice(2, 9);
export const emptyEntry = (): PathogenEntry => ({ id: newId(), name: "", organe: "", index: "" });

/**
 * Klassifiziert den Metatron/NLS-Resonanz-Index.
 * Skala (Hospital Metatron HR / NLS): kleiner Wert = hohe Wahrscheinlichkeit
 * für materielles/aktives Vorliegen des Pathogens.
 *   0.000 – 0.250 → sehr hoch (akut/materiell)
 *   0.251 – 0.425 → hoch (klinisch relevant)
 *   0.426 – 0.600 → mittel (Belastung wahrscheinlich)
 *   0.601 – 0.700 → gering (Hintergrundbelastung / Hinweis)
 *   > 0.700      → sehr gering (nur informativ, meist nicht aktiv)
 */
export function classifyPathogenIndex(rawIndex: string): {
  level: "sehr hoch" | "hoch" | "mittel" | "gering" | "sehr gering" | "unbekannt";
  hint: string;
  numeric: number | null;
} {
  const n = parseFloat((rawIndex || "").replace(",", "."));
  if (!isFinite(n)) return { level: "unbekannt", hint: "ohne Index", numeric: null };
  if (n <= 0.25) return { level: "sehr hoch", hint: "akut/materiell vorhanden – PRIORITÄT", numeric: n };
  if (n <= 0.425) return { level: "hoch", hint: "klinisch relevant – behandeln", numeric: n };
  if (n <= 0.6) return { level: "mittel", hint: "Belastung wahrscheinlich – berücksichtigen", numeric: n };
  if (n <= 0.7) return { level: "gering", hint: "Hintergrundbelastung – nur ergänzend", numeric: n };
  return { level: "sehr gering", hint: "nur informativ – meist nicht aktiv", numeric: n };
}

/**
 * Wandelt strukturierte Einträge in einen lesbaren Text für die KI um.
 * Inkl. Interpretation des Metatron/NLS-Index (kleiner Wert = höhere Wahrscheinlichkeit).
 */
export function formatPathogensForAI(entries: PathogenEntry[]): string {
  const filled = entries.filter((e) => e.name.trim());
  if (filled.length === 0) return "";
  const header =
    "Hinweis zur Index-Skala (Hospital Metatron HR / NLS): KLEINER Wert = HOHE Wahrscheinlichkeit für materielles/aktives Vorhandensein. " +
    "0.000–0.250 sehr hoch, 0.251–0.425 hoch, 0.426–0.600 mittel, 0.601–0.700 gering (nur ergänzend), >0.700 sehr gering (nur informativ, NICHT priorisieren).";
  const lines = filled.map((e) => {
    const parts = [e.name.trim()];
    if (e.organe.trim()) parts.push(`Organe: ${e.organe.trim().replace(/\n+/g, ", ")}`);
    if (e.index.trim()) {
      const c = classifyPathogenIndex(e.index);
      parts.push(`Index: ${e.index.trim()} → Wahrscheinlichkeit ${c.level} (${c.hint})`);
    }
    return "- " + parts.join(" | ");
  });
  return header + "\n" + lines.join("\n");
}

/**
 * Wörterbuch häufiger Organ-/Anatomie-Kürzel → Vollform.
 * Wird beim Parsen automatisch expandiert, damit die KI konsistente Begriffe erhält.
 * Schreibweise case-insensitive, Punkte werden ignoriert.
 */
export const ORGAN_ABBREVIATIONS: Record<string, string> = {
  // Verdauung
  magen: "Magen", duo: "Duodenum", jej: "Jejunum", ile: "Ileum",
  dd: "Dünndarm", duenndarm: "Dünndarm", dickdarm: "Dickdarm",
  kolon: "Kolon", colon: "Kolon", rektum: "Rektum", rectum: "Rektum",
  app: "Appendix", leb: "Leber", hep: "Leber",
  gb: "Gallenblase", galle: "Gallenblase",
  pank: "Pankreas", pancr: "Pankreas", bspd: "Bauchspeicheldrüse",
  oeso: "Ösophagus", ösophagus: "Ösophagus", speise: "Speiseröhre",
  // Atemwege
  lu: "Lunge", lung: "Lunge", bronch: "Bronchien", trach: "Trachea",
  nnh: "Nasennebenhöhlen", ohr: "Ohren", tonsi: "Tonsillen",
  pharynx: "Pharynx", larynx: "Larynx",
  // Herz/Kreislauf
  hz: "Herz", herz: "Herz", myo: "Myokard", peri: "Perikard", endo: "Endokard",
  ven: "Venen", art: "Arterien",
  // Niere/Harn
  ni: "Nieren", niere: "Nieren", ren: "Nieren",
  hb: "Harnblase", blase: "Harnblase", ureth: "Urethra", ureter: "Ureter",
  prost: "Prostata",
  // Geschlecht
  ute: "Uterus", uterus: "Uterus", ova: "Ovarien", ovar: "Ovarien",
  tube: "Tuben", vag: "Vagina", mam: "Mamma", test: "Hoden", hoden: "Hoden",
  // Endokrin
  sd: "Schilddrüse", schild: "Schilddrüse", thy: "Schilddrüse",
  nnr: "Nebennieren", hyp: "Hypophyse", epi: "Epiphyse", thymus: "Thymus",
  // Nerven
  zns: "Zentrales Nervensystem", pns: "Peripheres Nervensystem", ns: "Nervensystem",
  hirn: "Gehirn", gehirn: "Gehirn", rm: "Rückenmark",
  // Lymph/Immun
  ly: "Lymphsystem", lymph: "Lymphsystem", milz: "Milz", km: "Knochenmark",
  // Bewegung
  gel: "Gelenke", wbs: "Wirbelsäule", hws: "Halswirbelsäule",
  bws: "Brustwirbelsäule", lws: "Lendenwirbelsäule", isg: "Iliosakralgelenk",
  knie: "Knie", hand: "Handgelenke", schulter: "Schulter",
  hüfte: "Hüfte", huefte: "Hüfte",
  // Haut/Sinne/Mund
  haut: "Haut", auge: "Augen",
  zahn: "Zähne", zähne: "Zähne", zaehne: "Zähne",
  ms: "Mundschleimhaut", zb: "Zahnbett", paro: "Parodont",
};

/**
 * Expandiert Organ-Kürzel innerhalb einer Organ-Liste (komma-/slash-/plus-getrennt).
 * Unbekannte Begriffe bleiben unverändert.
 */
export function expandOrganAbbreviations(input: string): string {
  if (!input) return input;
  const parts = input.split(/\s*[,/+]\s*/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase().replace(/\./g, "").trim();
    const expanded = ORGAN_ABBREVIATIONS[key] ?? p;
    const dedupKey = expanded.toLowerCase();
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      out.push(expanded);
    }
  }
  return out.join(", ");
}

/**
 * Parser für Bulk-Paste. Unterstützt mehrere Formate:
 *  1) Inline: "Helicobacter pylori: Ma, Duo" → "Magen, Duodenum"
 *             "Borrelia: Gel, ZNS, Hz | 0.42"
 *             "Candida (DD, MS)"
 *  2) Block (Metatron/NLS): PATHOGEN-NAME, dann Organ-Zeilen, dann Zahl.
 *  Organ-Kürzel werden automatisch über ORGAN_ABBREVIATIONS expandiert.
 */
export function parseBulkPaste(text: string): PathogenEntry[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: PathogenEntry[] = [];

  const isNumeric = (s: string) => /^[0-9]+([.,][0-9]+)?$/.test(s);
  const isCategoryHeader = (s: string) =>
    /^(BAKTERIEN|VIREN|PARASITEN|PILZE|TOXINE|SCHWERMETALLE|MYKOSEN|PATHOGENE)$/i.test(s);

  // Inline-Separator: : | = → tab    (Bindestriche sind unzuverlässig wegen Pathogen-Namen)
  const INLINE_SEP = /\s*[:\|=→]\s*|\t+/;
  // "Index: 0.42" / "Idx 0,42" am Zeilenende (mit oder ohne Pipe davor)
  const INDEX_LABEL_TAIL = /\s*[\|~]?\s*(?:index|idx)\s*[:=]?\s*([0-9]+([.,][0-9]+)?)\s*$/i;
  // Reine Zahl mit Trenner am Ende: " | 0.42"
  const INDEX_PLAIN_TAIL = /\s*[\|~=]\s*([0-9]+([.,][0-9]+)?)\s*$/;
  // "Organe:" / "Organ:" Label vor der Organ-Liste
  const ORGAN_LABEL = /^\s*(?:organe?|organs?)\s*[:=]\s*/i;

  const looksLikeInline = (s: string): boolean => {
    if (/\([^)]+\)\s*$/.test(s)) return true;
    return INLINE_SEP.test(s);
  };

  // Führenden Listen-Marker entfernen ("- ", "* ", "• ", "1. ", "1) ")
  const stripBullet = (s: string) => s.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "");

  let current: PathogenEntry | null = null;
  const flush = () => {
    if (current) {
      entries.push(current);
      current = null;
    }
  };
  const isPathogenNameUpper = (s: string) =>
    s.length > 2 && s === s.toUpperCase() && /[A-ZÄÖÜ]/.test(s) && !isNumeric(s) && !isCategoryHeader(s);

  for (const raw of rawLines) {
    const line = stripBullet(raw);
    if (!line) continue;
    if (isCategoryHeader(line)) {
      flush();
      continue;
    }

    // --- Inline-Format zuerst versuchen ---
    if (looksLikeInline(line)) {
      flush();
      let rest = line;
      let index = "";

      // Index am Ende abtrennen – zuerst "Index: 0.42", dann " | 0.42"
      let idxMatch = rest.match(INDEX_LABEL_TAIL);
      if (idxMatch && idxMatch.index !== undefined) {
        index = idxMatch[1].replace(",", ".");
        rest = rest.slice(0, idxMatch.index).trim().replace(/[\|~=,;]\s*$/, "").trim();
      } else {
        idxMatch = rest.match(INDEX_PLAIN_TAIL);
        if (idxMatch && idxMatch.index !== undefined) {
          index = idxMatch[1].replace(",", ".");
          rest = rest.slice(0, idxMatch.index).trim();
        }
      }

      let name = "";
      let organe = "";

      // Klammer-Format "Name (Organe)"
      const parenMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        organe = parenMatch[2].trim();
      } else {
        // Ersten Inline-Separator als Grenze Name/Organe nehmen
        const sepMatch = rest.match(INLINE_SEP);
        if (sepMatch && sepMatch.index !== undefined) {
          name = rest.slice(0, sepMatch.index).trim();
          organe = rest.slice(sepMatch.index + sepMatch[0].length).trim();
        } else {
          name = rest.trim();
        }
      }

      // "Organe:" Label aus Organe-Feld entfernen
      organe = organe.replace(ORGAN_LABEL, "");
      // Restliche Pipes (|) in Organe → Komma; "Organe:" Reste entfernen
      organe = organe.replace(/\s*\|\s*(?:organe?\s*[:=]\s*)?/gi, ", ");
      organe = organe.replace(/\s*;\s*/g, ", ").replace(/\s{2,}/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
      organe = expandOrganAbbreviations(organe);

      // Trailing Punctuation aus Name entfernen
      name = name.replace(/[\s:|,;]+$/, "").trim();

      if (name) {
        entries.push({ id: newId(), name, organe, index });
      }
      continue;
    }

    // --- Block-Format (Metatron) ---
    if (isPathogenNameUpper(line)) {
      flush();
      current = { id: newId(), name: line, organe: "", index: "" };
      continue;
    }
    if (!current) {
      entries.push({ id: newId(), name: line, organe: "", index: "" });
      continue;
    }
    if (isNumeric(line)) {
      current.index = line.replace(",", ".");
      current.organe = expandOrganAbbreviations(current.organe);
      flush();
      continue;
    }
    current.organe = current.organe ? current.organe + ", " + line : line;
  }
  if (current) current.organe = expandOrganAbbreviations(current.organe);
  flush();
  return entries;
}

export function PathogenInput({ entries, onChange }: Props) {
  // Schnell-Eingabe ist STANDARD und immer sichtbar.
  // Manuelle Einzelfeld-Liste ist optional ausklappbar.
  const [bulkText, setBulkText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const filledCount = entries.filter((e) => e.name.trim()).length;

  const update = (id: string, patch: Partial<PathogenEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const remove = (id: string) => {
    const filtered = entries.filter((e) => e.id !== id);
    onChange(filtered.length ? filtered : [emptyEntry()]);
  };

  const add = () => {
    onChange([...entries, emptyEntry()]);
    setManualOpen(true);
  };

  const applyBulk = () => {
    const parsed = parseBulkPaste(bulkText);
    if (parsed.length === 0) return;
    const existing = entries.filter((e) => e.name.trim());
    onChange([...existing, ...parsed]);
    setBulkText("");
    setManualOpen(true); // Liste automatisch öffnen, damit der Nutzer das Ergebnis sieht
  };

  const clearAll = () => {
    onChange([emptyEntry()]);
    setBulkText("");
  };

  return (
    <div className="space-y-2">
      {/* Schnell-Eingabe – immer sichtbar, prominent */}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
            <span>⚡ Schnell-Eingabe</span>
            <span className="text-muted-foreground font-normal">– eine Zeile pro Pathogen</span>
          </p>
          <span className="text-[11px] text-muted-foreground">{filledCount} erfasst</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Erkannte Formate: <code>Name: Organe</code> · <code>Name - Organe | Index</code> ·{" "}
          <code>Name (Organe)</code> · <code>Name = Organe ~ 0,18</code>
        </p>
        <p className="text-[11px] text-muted-foreground">
          <strong>Organ-Kürzel</strong> werden automatisch expandiert, z.B.{" "}
          <code>SD</code>=Schilddrüse, <code>NNR</code>=Nebennieren, <code>ZNS</code>,{" "}
          <code>HWS/BWS/LWS</code>, <code>DD</code>=Dünndarm, <code>GB</code>=Gallenblase,{" "}
          <code>NNH</code>, <code>Hz</code>, <code>Ni</code>, <code>Lu</code>, <code>Ly</code>,{" "}
          <code>MS</code>=Mundschleimhaut, <code>Gel</code>=Gelenke …
        </p>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={6}
          className="text-xs font-mono bg-background"
          placeholder={
            "Helicobacter pylori: Magen, Duo\n" +
            "Epstein-Barr-Virus: Ly, Leber | 0.35\n" +
            "Candida albicans (DD, MS)\n" +
            "Borrelia burgdorferi - Gel, ZNS, Hz"
          }
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            Alles leeren
          </Button>
          <Button type="button" size="sm" onClick={applyBulk} disabled={!bulkText.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Zur Liste hinzufügen
          </Button>
        </div>
      </div>

      {/* Manuelle Einzelfeld-Bearbeitung – optional aufklappbar */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setManualOpen((v) => !v)}
        >
          <List className="h-3.5 w-3.5 mr-1" />
          {manualOpen ? "Liste ausblenden" : `Liste bearbeiten (${filledCount})`}
        </Button>
        {manualOpen && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Zeile
          </Button>
        )}
      </div>

      {manualOpen && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {entries.map((e) => (
            <div key={e.id} className="grid grid-cols-12 gap-1.5 items-start">
              <Input
                className="col-span-5 h-8 text-xs"
                placeholder="Pathogen (z.B. Helicobacter pylori)"
                value={e.name}
                onChange={(ev) => update(e.id, { name: ev.target.value })}
              />
              <Input
                className="col-span-5 h-8 text-xs"
                placeholder="Organe (z.B. Magen, Duodenum)"
                value={e.organe}
                onChange={(ev) => update(e.id, { organe: ev.target.value })}
              />
              <Input
                className="col-span-1 h-8 text-xs"
                placeholder="Idx"
                value={e.index}
                onChange={(ev) => update(e.id, { index: ev.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(e.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
