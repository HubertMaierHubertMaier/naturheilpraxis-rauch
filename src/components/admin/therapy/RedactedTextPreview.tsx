import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const redactionMarkerPattern = /(\[[^\]\n]*(?:entfernt|geschwaerzt|geschwärzt)\])/giu;
const redactionMarkerPartPattern = /^\[[^\]\n]*(?:entfernt|geschwaerzt|geschwärzt)\]$/iu;

type Props = {
  text: string;
  className?: string;
  onChange?: (text: string) => void;
  disabled?: boolean;
};

export function RedactedTextPreview({ text, className = "", onChange, disabled = false }: Props) {
  const selectionRef = useRef<HTMLTextAreaElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { setHasSelection(false); setNotice(""); }, [text]);
  const redactSelection = () => {
    const field = selectionRef.current;
    if (!field || disabled || !onChange || field.value !== text) return;
    const start = field.selectionStart; const end = field.selectionEnd;
    if (start >= end) return;
    const protectedMarkers = text.matchAll(/---\s*Seite\s+\d+(?:\s*\|[^\n]*?)?\s*---|===\s*[📄📎]|\[IAA_FORMULAR:\d+(?:\.\d+)*;SEITE:\d+;MARKIERT:[1-6,]*\]|\[\/IAA_FORMULAR\]|\[IAA_ERFASSUNG:(?:NATIVE_FELDER|MANUELL_PRUEFEN)\]/gu);
    if ([...protectedMarkers].some(marker => start < marker.index! + marker[0].length && end > marker.index!)) {
      setNotice("Bitte nur die personenbezogene Angabe markieren. Seiten- und Dokumentgrenzen sowie IAA-Bewertungen bleiben erhalten."); return;
    }
    onChange(`${text.slice(0, start)}[manuell geschwärzt]${text.slice(end)}`);
  };
  return (
    <>
    <pre className={`whitespace-pre-wrap break-words ${className}`}>
      {text.split(redactionMarkerPattern).map((part, index) => redactionMarkerPartPattern.test(part) ? (
        <span
          key={`${index}-${part}`}
          aria-label={part.includes("manuell") ? "Manuell geschwärzte personenbezogene Angabe" : "Automatisch geschwaerzte personenbezogene Angabe"}
          title={part.includes("manuell") ? "Manuell lokal entfernt" : "Automatisch lokal entfernt"}
          className="mx-0.5 inline-block select-none rounded-sm bg-black px-2 text-black"
        >
          Geschwaerzt
        </span>
      ) : <Fragment key={`${index}-${part}`}>{part}</Fragment>)}
    </pre>
    {onChange && <details className="mt-2 rounded-md border bg-background p-3">
      <summary className="cursor-pointer text-sm font-medium">Manuell nachschwärzen</summary>
      <p className="my-2 text-xs text-muted-foreground">Die zu entfernende Angabe im Text markieren und schwärzen. Das betrifft den ausgelesenen Text; die Original-PDF bleibt geschützt unverändert. Danach die Datenschutzvorschau erneut bestätigen.</p>
      <Textarea ref={selectionRef} readOnly value={text} aria-label="Text zum manuellen Nachschwärzen" className="min-h-48 font-mono text-xs" onSelect={event => setHasSelection(event.currentTarget.selectionEnd > event.currentTarget.selectionStart)} />
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={disabled || !hasSelection} onClick={redactSelection}>Markierte Angabe schwärzen</Button>
      {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
    </details>}
    </>
  );
}
