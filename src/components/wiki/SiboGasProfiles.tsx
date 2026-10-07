import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { byProfile, GAS_CANDIDATES, GAS_SOURCES, PROFILES, SIBO_GAS_ARTICLE_KEY, statusCounts, uniqueCount, type ProfileKey } from "@/lib/siboGasProfiles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Loaded = { id: string; revId: string | null; title: string | null; status: string | null; srcRevIds: string[] } | "missing" | "loading" | { error: string };

export function SiboGasProfiles() {
  const [art, setArt] = useState<Loaded>("loading");
  const [p, setP] = useState<ProfileKey>("h2");
  useEffect(() => {
    (async () => {
      const { data, error } = await db.from("kb_articles").select("id,current_revision_id,metadata").eq("canonical_key", SIBO_GAS_ARTICLE_KEY).maybeSingle();
      if (error) return setArt({ error: error.message });
      if (!data) return setArt("missing");
      let title = null, status = null;
      if (data.current_revision_id) {
        const r = await db.from("kb_article_revisions").select("title,review_status").eq("id", data.current_revision_id).maybeSingle();
        title = r.data?.title ?? null; status = r.data?.review_status ?? null;
      }
      setArt({ id: data.id, revId: data.current_revision_id, title, status, srcRevIds: (data.metadata?.source_revision_ids ?? []) as string[] });
    })();
  }, []);
  const sc = statusCounts();
  const src = (id: string) => GAS_SOURCES.find((s) => s.id === id)!;
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded border bg-card p-3">
        <p className="font-semibold">Gespeicherter Artikel</p>
        {art === "loading" && <p className="text-muted-foreground">Lädt …</p>}
        {art === "missing" && <p data-testid="gas-missing">Artikel <code>{SIBO_GAS_ARTICLE_KEY}</code> ist im Bestand nicht vorhanden (Migration nicht angewendet). Keine Bestandsdaten angezeigt.</p>}
        {typeof art === "object" && "error" in art && <p>Fehler beim Laden: {art.error}</p>}
        {typeof art === "object" && "id" in art && <ul className="text-xs"><li>{art.title ?? "ohne aktuelle Revision"} · Status: {art.status ?? "–"}</li><li>Artikel-ID {art.id} · Revision {art.revId ?? "–"}</li><li>Artikelweite Quellenrevisionen ({art.srcRevIds.length}): {art.srcRevIds.join(", ") || "–"} – gelten für den Artikel insgesamt, nicht als Beleg jeder Einzelaussage.</li></ul>}
      </div>
      <p className="text-xs text-muted-foreground">Kandidaten (eindeutig {uniqueCount(GAS_CANDIDATES)}): Praxiszuordnung {sc.praxiszuordnung} · Quellenkandidat {sc.kandidat} · abgelehnt {sc.abgelehnt} · dupliziert {sc.dupliziert} · prüfbestätigt {sc.pruefbestaetigt}. Keine Entity-Verlinkung ohne exakten ID-Treffer – alle Einträge mit Prüfbedarf. Keine Dosen.</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(PROFILES) as ProfileKey[]).map((k) => <Button key={k} size="sm" variant={k === p ? "default" : "outline"} onClick={() => setP(k)}>{PROFILES[k].gas} · {PROFILES[k].label} ({byProfile(k).length})</Button>)}</div>
      <p className="rounded border-l-4 border-primary bg-muted/40 p-2">{PROFILES[p].hinweis}</p>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left"><th>Mittel/Ansatz</th><th>Mikroorganismen</th><th>Ergebnis / Praxiszuordnung</th><th>Quelle · Belegart</th><th>Prüfbedarf</th></tr></thead>
        <tbody>{byProfile(p).map((c) => { const s = src(c.sourceId); return (
          <tr key={c.id} className="border-t align-top"><td className="py-1 font-medium">{c.mittel}</td><td>{c.mikroorganismen}</td><td>{c.ergebnis} <Badge variant="outline">{c.status}</Badge></td><td>{s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.id}</a> : s.id} · {s.belegart}</td><td>{c.pruefbedarf}</td></tr>); })}</tbody></table></div>
      <details><summary className="cursor-pointer font-semibold">Quellen und Grenzen ({GAS_SOURCES.length})</summary><ul className="list-disc pl-5 text-xs">{GAS_SOURCES.map((s) => <li key={s.id}><b>{s.id}</b> ({s.belegart}): {s.kurz} <i>Grenzen: {s.grenzen}</i></li>)}</ul></details>
      <p className="text-xs text-muted-foreground">In der Praxis wird das Gasprofil zusammen mit Beschwerden und Verlauf eingeordnet und daraus die naturheilkundliche Behandlung individuell geplant. Keine Keimtötungs- oder Heilgarantie.</p>
    </div>
  );
}
