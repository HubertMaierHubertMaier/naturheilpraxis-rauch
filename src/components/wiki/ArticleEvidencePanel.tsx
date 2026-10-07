import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { loadArticleEvidence, type EvidenceResult } from "@/lib/wikiAssertionSources";

const status = (s: string) => (s === "draft" ? "nicht geprüft (Entwurf)" : s);

/** Read-only: normalized source evidence per assertion, loaded on demand. */
export function ArticleEvidencePanel({ articleId }: { articleId: string }) {
  const [res, setRes] = useState<EvidenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setRes(await loadArticleEvidence(supabase as never, articleId)); }
    catch (e) { setRes({ state: "error", message: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quellenbelege je Aussage (normalisiert)</p>
        <Button size="sm" variant="outline" onClick={load} disabled={busy}>{busy ? "Lädt …" : res ? "Neu laden" : "Anzeigen"}</Button>
      </div>
      {res?.state === "unavailable" && <p className="mt-2 text-muted-foreground">Normalisierte Quellenbelege sind noch nicht verfügbar. Die Quellen aus den Metadaten oben gelten weiter.</p>}
      {res?.state === "error" && <p role="alert" className="mt-2 text-destructive">Quellenbelege konnten nicht geladen werden: {res.message}</p>}
      {res?.state === "none" && <p className="mt-2 text-muted-foreground">{res.reason === "no-core-link" ? "Dieser Eintrag ist mit keinem Importpaket verknüpft – keine normalisierten Belege vorhanden." : "Zu diesem Eintrag sind keine Aussagen verknüpft."}</p>}
      {res?.state === "ok" && (
        <ul className="mt-2 space-y-2">
          {res.items.map(({ assertion, sources }) => (
            <li key={assertion.id} className="rounded bg-muted/40 p-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{assertion.assertion_kind}</Badge>
                <Badge variant="outline">Version {assertion.version_no}</Badge>
                <Badge variant="outline">Prüfung: {status(assertion.review_status)}</Badge>
              </div>
              <p className="mt-1 break-words">{assertion.claim_text}</p>
              {sources.length === 0
                ? <p className="mt-1 font-semibold text-destructive">Keine Quelle verknüpft.</p>
                : sources.map((s) => (
                  <p key={s.source_revision_id} className="mt-1 text-xs text-muted-foreground">
                    Quelle: {s.revision ? `${s.revision.title || "ohne Titel"} (Revision ${s.revision.revision_no}, ${status(s.revision.review_status)})` : "Quellenrevision nicht lesbar"}
                    {" · "}Rolle: {s.source_role}{s.locator ? ` · Fundstelle: ${s.locator}` : ""}{s.is_primary ? " · primär" : ""}
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
