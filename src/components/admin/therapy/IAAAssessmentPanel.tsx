import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkedIAAQuestions, iaaQuestionCatalog, setIAAAnswer } from "@/lib/iaaAssessment";
import { iaaCategories } from "@/lib/iaaQuestions";

type Props = { pseudonymId: string; values: Record<string, string>; onChange: (values: Record<string, string>) => void; disabled: boolean; hasUnstructuredIAA?: boolean };
export function IAAAssessmentPanel({ pseudonymId, values, onChange, disabled, hasUnstructuredIAA = false }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(iaaCategories[0].id);
  const [visibleCount, setVisibleCount] = useState(20);
  useEffect(() => { setOpen(false); setEditing(false); setSearch(""); setCategoryId(iaaCategories[0].id); setVisibleCount(20); }, [pseudonymId]);
  const entries = useMemo(() => checkedIAAQuestions(values), [values]);
  const matchingQuestions = useMemo(() => iaaQuestionCatalog.filter(question => search.trim()
    ? `${question.id} ${question.textDe} ${question.category}`.toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE").trim())
    : question.categoryId === categoryId), [search, categoryId]);
  const shownQuestions = matchingQuestions.slice(0, visibleCount);
  const change = (next: Record<string, string>) => { if (!disabled) onChange(next); };
  return <section className="mb-4 rounded-xl border-2 border-teal-400/60 bg-teal-50/50 p-4 dark:bg-teal-950/20" aria-label="IAA-Auswertung für Trikombin">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">IAA – Trikombin-Auswertung</h3><p className="text-sm text-muted-foreground">{entries.length} angekreuzte Fragen · Reihenfolge 6 → 1</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!pseudonymId} onClick={() => { setEditing(false); setOpen(true); }}>IAA – angekreuzte Fragen anzeigen</Button>
        <Button type="button" variant="outline" disabled={!pseudonymId || disabled} onClick={() => { setEditing(true); setOpen(true); }}>IAA erfassen / prüfen</Button>
      </div>
    </div>
    {values.iaaReviewRequired === "true" && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p>IAA-Prüfung offen: Mindestens eine Quelle hat keine sicheren elektronischen IAA-Kästchen oder enthält bildbasierte Seiten. Enthaltene IAA-Markierungen und Bewertungen bitte vollständig am Original prüfen.</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={disabled} onClick={() => change({ ...values, iaaReviewRequired: "false", iaaReviewConfirmedAt: new Date().toISOString() })}>IAA vollständig am Original geprüft</Button>
    </div>}
    {!entries.length && <p className="mt-2 text-sm">{hasUnstructuredIAA || values.iaaReviewRequired === "true" ? "Die einzelnen IAA-Bewertungen bitte hier anhand des Originalbogens erfassen oder prüfen." : "Für diesen Fall sind noch keine angekreuzten IAA-Fragen strukturiert erfasst."}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{editing ? "IAA erfassen / prüfen" : "IAA – angekreuzte Fragen"}</DialogTitle>
          <DialogDescription>Fall {pseudonymId} · {editing ? "Nur die tatsächlich angekreuzten Fragen und Bewertungen aus dem Originalbogen übernehmen." : "Bewertung absteigend: 6, 5, 4, 3, 2, 1. Bei Gleichstand gilt die Fragebogenreihenfolge."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2"><Button type="button" variant={editing ? "outline" : "default"} onClick={() => setEditing(false)}>Sortierte Auswertung</Button><Button type="button" variant={editing ? "default" : "outline"} disabled={disabled} onClick={() => setEditing(true)}>Eingaben prüfen</Button></div>
        {editing ? <>
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="IAA-Bereich" value={categoryId} onChange={event => { setCategoryId(event.target.value); setSearch(""); setVisibleCount(20); }} className="rounded-md border bg-background p-2 text-sm">
              {iaaCategories.map(category => <option key={category.id} value={category.id}>{category.titleDe}</option>)}
            </select>
            <Input aria-label="IAA-Frage suchen" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(20); }} placeholder="In allen Bereichen suchen" />
          </div>
          <p className="text-xs text-muted-foreground">{shownQuestions.length} von {matchingQuestions.length} passenden Fragen angezeigt</p>
          <div className="min-h-0 overflow-y-auto space-y-3 pr-2">
            {shownQuestions.map(question => <div key={question.id} className="rounded-lg border p-3 space-y-2">
              <label htmlFor={`iaa-rating-${question.id}`} className="block text-sm font-medium">{question.id} · {question.textDe}</label>
              <div className="flex flex-wrap items-center gap-3"><select id={`iaa-rating-${question.id}`} value={values[`iaa.${question.id}`] || ""} disabled={disabled} onChange={event => change(setIAAAnswer(values, question.id, event.target.value))} className="rounded-md border bg-background p-2 text-sm">
                <option value="">Nicht angekreuzt / keine Angabe</option><option value="checked">Angekreuzt – Bewertung offen</option>
                {[1, 2, 3, 4, 5, 6].map(rating => <option key={rating} value={String(rating)}>{rating} / 6</option>)}
              </select><span className="text-xs text-muted-foreground">{question.category}</span></div>
              {(values[`iaa.${question.id}`] || values[`iaaNote.${question.id}`]) && <label className="block text-xs">Bemerkung / Auslöser zu {question.id}<Textarea value={values[`iaaNote.${question.id}`] || ""} disabled={disabled} onChange={event => change({ ...values, [`iaaNote.${question.id}`]: event.target.value })} rows={2} className="mt-1" /></label>}
            </div>)}
            {shownQuestions.length < matchingQuestions.length && <Button type="button" variant="outline" onClick={() => setVisibleCount(count => count + 20)}>Weitere Fragen anzeigen</Button>}
          </div>
        </> : <div className="min-h-0 overflow-y-auto pr-2">
          {!entries.length ? <p className="py-8 text-center text-muted-foreground">Keine angekreuzten IAA-Fragen erfasst.</p> : <ol aria-label="Angekreuzte IAA-Fragen nach Bewertung" className="space-y-3">
            {entries.map(entry => <li key={entry.id} data-iaa-question={entry.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start gap-3"><span className="shrink-0 rounded-md bg-teal-100 px-3 py-2 font-bold text-teal-950">{entry.rating === null ? "Offen" : `${entry.rating} / 6`}</span><div><p className="font-medium">{entry.id} · {entry.question}</p><p className="text-xs text-muted-foreground">{entry.category}</p></div></div>
              {entry.note && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Bemerkung / Auslöser:</strong> {entry.note}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{entry.source}</p>
              {entry.needsReview && <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{entry.reviewNote || "Bewertung oder Fragenzuordnung anhand des Originals prüfen."}</p>}
            </li>)}
          </ol>}
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
