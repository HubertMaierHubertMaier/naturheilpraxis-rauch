import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ENTITY_MATCHES, ENTITY_NO_MATCH, PRAXIS_KEIME, byProfile, GAS_CANDIDATES, GAS_SOURCES, PROFILES, SIBO_GAS_ARTICLE_KEY, statusCounts, uniqueCount, type ProfileKey } from "@/lib/siboGasProfiles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Loaded = { id: string; revId: string | null; title: string | null; status: string | null; srcRevIds: string[]; srcFrom: "revision" | "artikel-fallback" | "keine"; revError: string | null } | "missing" | "loading" | { error: string };

export function SiboGasProfiles() {
  const [art, setArt] = useState<Loaded>("loading");
  const [p, setP] = useState<ProfileKey>("h2");
  useEffect(() => {
    (async () => {
      const { data, error } = await db.from("kb_articles").select("id,current_revision_id,metadata").eq("canonical_key", SIBO_GAS_ARTICLE_KEY).maybeSingle();
      if (error) return setArt({ error: error.message });
      if (!data) return setArt("missing");
      let title: string | null = null, status: string | null = null, revError: string | null = null, revIds: unknown = undefined;
      if (data.current_revision_id) {
        const r = await db.from("kb_article_revisions").select("title,review_status,metadata").eq("id", data.current_revision_id).maybeSingle();
        if (r.error) revError = r.error.message; else if (!r.data) revError = "aktuelle Revision nicht lesbar";
        title = r.data?.title ?? null; status = r.data?.review_status ?? null; revIds = r.data?.metadata?.source_revision_ids;
      }
      const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);
      const fromRev = ids(revIds), fromArt = ids(data.metadata?.source_revision_ids);
      const srcFrom = fromRev ? "revision" : fromArt ? "artikel-fallback" : "keine";
      setArt({ id: data.id, revId: data.current_revision_id, title, status, srcRevIds: fromRev ?? fromArt ?? [], srcFrom, revError });
    })();
  }, []);
  const sc = statusCounts();
  const src = (id: string) => GAS_SOURCES.find((s) => s.id === id)!;
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded border bg-card p-3">
        <p className="font-semibold">Gespeicherter Artikel</p>
        {art === "loading" && <p className="text-muted-foreground">Lädt …</p>}
        {art === "missing" && <p data-testid="gas-missing">Artikel <code>{SIBO_GAS_ARTICLE_KEY}</code> wurde im lesbaren Bestand nicht gefunden. Keine Bestandsdaten angezeigt.</p>}
        {typeof art === "object" && "error" in art && <p>Fehler beim Laden: {art.error}</p>}
        {typeof art === "object" && "id" in art && <ul className="text-xs">{art.revError && <li data-testid="gas-rev-error">Fehler beim Laden der aktuellen Revision: {art.revError}</li>}<li>{art.title ?? (art.revId ? "Titel nicht geladen" : "keine aktuelle Revision gesetzt")} · Status: {art.status ?? "–"}</li><li>Artikel-ID {art.id} · Revision {art.revId ?? "–"}</li><li>Artikelweite Quellenrevisionen ({art.srcRevIds.length}, {art.srcFrom === "revision" ? "aus aktueller Revision" : art.srcFrom === "artikel-fallback" ? "Fallback: Artikel-Metadaten" : "keine"}): {art.srcRevIds.join(", ") || "–"} – gelten für den Artikel insgesamt, nicht als Beleg jeder Einzelaussage.</li></ul>}
      </div>
      <p className="text-xs text-muted-foreground">3 Profile · {uniqueCount(GAS_CANDIDATES)} eindeutige Kandidaten (keine fertigen Relationen): Praxiszuordnung {sc.praxiszuordnung} · Quellenkandidat {sc.kandidat} · abgelehnt {sc.abgelehnt} · dupliziert {sc.dupliziert} · prüfbestätigt {sc.pruefbestaetigt}. Entity-Abgleich: {ENTITY_MATCHES.filter((e) => e.ergebnis === "eindeutig").length} eindeutig, {ENTITY_MATCHES.filter((e) => e.ergebnis === "offen").length} offen, übrige ohne Treffer. Keine Dosen.</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(PROFILES) as ProfileKey[]).map((k) => <Button key={k} size="sm" variant={k === p ? "default" : "outline"} onClick={() => setP(k)}>{PROFILES[k].gas} · {PROFILES[k].label} ({byProfile(k).length})</Button>)}</div>
      <p className="rounded border-l-4 border-primary bg-muted/40 p-2">{PROFILES[p].hinweis}</p>
      <div className="rounded border p-2 text-xs" data-testid="praxis-keime"><p className="font-semibold">Mikroorganismen laut Praxisquelle (Praxiszuordnung, keine Kausalliste, keine Mittelwirkung gegen Einzelspezies)</p>{PRAXIS_KEIME[p].map((g) => <p key={g.gruppe}><b>{g.gruppe}:</b> {g.keime.join(", ")}</p>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left"><th>Mittel/Ansatz</th><th>Mikroorganismen</th><th>Ergebnis / Praxiszuordnung</th><th>Quelle · Belegart</th><th>Prüfbedarf</th></tr></thead>
        <tbody>{byProfile(p).map((c) => { const s = src(c.sourceId); return (
          <tr key={c.id} className="border-t align-top"><td className="py-1 font-medium">{c.mittel}</td><td>{c.mikroorganismen}</td><td>{c.ergebnis} <Badge variant="outline">{c.status}</Badge></td><td>{s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.id}</a> : s.id} · {s.belegart}</td><td>{c.pruefbedarf}</td></tr>); })}</tbody></table></div>
      <details><summary className="cursor-pointer font-semibold">Quellen und Grenzen ({GAS_SOURCES.length})</summary><ul className="list-disc pl-5 text-xs">{GAS_SOURCES.map((s) => <li key={s.id}><b>{s.id}</b> ({s.belegart}): {s.kurz} <i>Grenzen: {s.grenzen}</i></li>)}</ul></details>
      <details><summary className="cursor-pointer font-semibold">Wiki-Begriffsabgleich ({ENTITY_MATCHES.length} geprüft)</summary><ul className="list-disc pl-5 text-xs">{ENTITY_MATCHES.map((e) => <li key={e.begriff}>{e.begriff}: {e.ergebnis}{e.entityId && <> – <a className="underline" href={`/wikidatenbank/ordnung?v=pathogens&id=${e.entityId}`}>vorhandener Begriff</a> (keine bestätigte Therapierelation)</>} · {e.grund}</li>)}<li>Kein Treffer: {ENTITY_NO_MATCH.join(", ")}</li></ul></details>
      <p className="text-xs text-muted-foreground">In der Praxis wird das Gasprofil zusammen mit Beschwerden und Verlauf eingeordnet und daraus die naturheilkundliche Behandlung individuell geplant. Keine Keimtötungs- oder Heilgarantie.</p>
    </div>
  );
}
