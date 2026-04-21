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
 * Wandelt strukturierte Einträge in einen lesbaren Text für die KI um.
 */
export function formatPathogensForAI(entries: PathogenEntry[]): string {
  return entries
    .filter((e) => e.name.trim())
    .map((e) => {
      const parts = [e.name.trim()];
      if (e.organe.trim()) parts.push(`Organe: ${e.organe.trim().replace(/\n+/g, ", ")}`);
      if (e.index.trim()) parts.push(`Index: ${e.index.trim()}`);
      return "- " + parts.join(" | ");
    })
    .join("\n");
}

/**
 * Parser für Bulk-Paste. Unterstützt mehrere Formate:
 *
 * 1) Inline (eine Zeile pro Pathogen) – schnellster Modus:
 *    "Helicobacter pylori: Magen, Duodenum"
 *    "Borrelia burgdorferi - Gelenke, Nervensystem | 0.42"
 *    "Candida albicans (Darm, Mundschleimhaut)"
 *    "Yersinia enterocolitica = Dünndarm; Gelenke ~ 0,18"
 *
 * 2) Block-Format (Metatron/NLS): PATHOGEN-NAME, dann Organ-Zeilen, dann Zahl.
 */
export function parseBulkPaste(text: string): PathogenEntry[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: PathogenEntry[] = [];

  const isNumeric = (s: string) => /^[0-9]+([.,][0-9]+)?$/.test(s);
  const isCategoryHeader = (s: string) =>
    /^(BAKTERIEN|VIREN|PARASITEN|PILZE|TOXINE|SCHWERMETALLE|MYKOSEN|PATHOGENE)$/i.test(s);

  // Inline-Separator: : | - – — = → tab
  const INLINE_SEP = /\s*[:\|=→]\s*|\s+[-–—]\s+|\t+/;
  // Index-Separator am Ende: | 0.42  oder  ~ 0,18  oder  = 0.5
  const INDEX_SEP = /\s*[\|~=]\s*([0-9]+([.,][0-9]+)?)\s*$/;

  const looksLikeInline = (s: string): boolean => {
    // Hat einen Inline-Separator ODER Klammer-Format "Name (Organe)"
    if (/\([^)]+\)\s*$/.test(s)) return true;
    return INLINE_SEP.test(s);
  };

  // Block-Modus Helper
  let current: PathogenEntry | null = null;
  const flush = () => {
    if (current) {
      entries.push(current);
      current = null;
    }
  };
  const isPathogenNameUpper = (s: string) =>
    s.length > 2 && s === s.toUpperCase() && /[A-ZÄÖÜ]/.test(s) && !isNumeric(s) && !isCategoryHeader(s);

  for (const line of rawLines) {
    if (isCategoryHeader(line)) {
      flush();
      continue;
    }

    // --- Inline-Format zuerst versuchen ---
    if (looksLikeInline(line)) {
      flush();
      let rest = line;
      let index = "";

      // Index am Ende abtrennen
      const idxMatch = rest.match(INDEX_SEP);
      if (idxMatch) {
        index = idxMatch[1].replace(",", ".");
        rest = rest.slice(0, idxMatch.index).trim();
      }

      let name = "";
      let organe = "";

      // Klammer-Format "Name (Organe)"
      const parenMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        organe = parenMatch[2].trim();
      } else {
        // Trennzeichen-Format
        const sepMatch = rest.match(INLINE_SEP);
        if (sepMatch && sepMatch.index !== undefined) {
          name = rest.slice(0, sepMatch.index).trim();
          organe = rest.slice(sepMatch.index + sepMatch[0].length).trim();
        } else {
          name = rest.trim();
        }
      }

      // Organe normalisieren: Semikolons → Kommas
      organe = organe.replace(/\s*;\s*/g, ", ").replace(/\s{2,}/g, " ");

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
      // Zeile ohne Separator und nicht UPPERCASE → als reiner Pathogen-Name übernehmen
      entries.push({ id: newId(), name: line, organe: "", index: "" });
      continue;
    }
    if (isNumeric(line)) {
      current.index = line.replace(",", ".");
      flush();
      continue;
    }
    current.organe = current.organe ? current.organe + ", " + line : line;
  }
  flush();
  return entries;
}

export function PathogenInput({ entries, onChange }: Props) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const update = (id: string, patch: Partial<PathogenEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const remove = (id: string) => {
    const filtered = entries.filter((e) => e.id !== id);
    onChange(filtered.length ? filtered : [emptyEntry()]);
  };

  const add = () => onChange([...entries, emptyEntry()]);

  const applyBulk = () => {
    const parsed = parseBulkPaste(bulkText);
    if (parsed.length === 0) return;
    // Merge with existing non-empty entries
    const existing = entries.filter((e) => e.name.trim());
    onChange([...existing, ...parsed]);
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {entries.filter((e) => e.name.trim()).length} Pathogen(e)
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setBulkOpen((v) => !v)}
          >
            <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
            Bulk-Paste
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Eintrag
          </Button>
        </div>
      </div>

      {bulkOpen && (
        <div className="rounded-md border bg-muted/30 p-2 space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <List className="h-3 w-3" />
            Befund einfügen (z.B. aus Metatron). Der Parser erkennt Pathogen-Name (Großbuchstaben),
            Organe und Index-Wert automatisch.
          </p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            className="text-xs font-mono"
            placeholder="HELICOBACTER PYLORI&#10;Magen&#10;Duodenum&#10;0,018"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" size="sm" onClick={applyBulk}>
              Übernehmen
            </Button>
          </div>
        </div>
      )}

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
    </div>
  );
}
