import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { KRANKHEIT_IST_MESSBAR_CHANGES as CHANGES, UNMARKED_NOTES, type ComparisonChange } from "@/lib/infothekComparisonChanges";
import draftHtml from "../../website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html?raw";

const ROUTE = "/krankheit-ist-messbar.html";
type Side = "orig" | "draft";

/** Colours used inside the article frames (legend below mirrors them). */
const MARK = {
  orig: { bg: "#fde2e2", border: "#b91c1c", label: "Original" },
  draft: { bg: "#dcfce7", border: "#15803d", label: "Entwurf" },
  active: "#1d4ed8",
};

const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,blockquote";

function markChange(doc: Document, change: ComparisonChange, side: Side): boolean {
  const snippet = side === "orig" ? change.orig : change.draft;
  if (!snippet) return false;
  const nth = (side === "orig" ? change.origNth : change.draftNth) ?? 0;
  let target: Element | undefined;
  if (change.img) {
    target = Array.from(doc.images).filter((img) => img.alt.includes(snippet))[nth];
  } else {
    const hits = Array.from(doc.body.querySelectorAll(TEXT_TAGS)).filter((el) => el.textContent?.includes(snippet));
    target = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))[nth];
  }
  if (!target) return false;
  const badge = doc.createElement("span");
  badge.className = `cmp-badge ${side}`;
  badge.textContent = `Ä${change.id} · ${MARK[side].label}${change.img ? " (Alt-Text)" : ""}`;
  target.classList.add("cmp-mark", side);
  target.setAttribute("data-change", String(change.id));
  if (change.img) target.parentElement?.insertBefore(badge, target);
  else target.prepend(badge);
  return true;
}

/** Static, script-free rendering with change markers. */
export function toStaticPreview(html: string, side: Side): { html: string; found: Set<number>; sectionOf: Map<number, number> } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, meta[http-equiv]").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("bilder/")) img.setAttribute("src", `/${src}`);
    img.removeAttribute("loading");
  });
  const found = new Set<number>();
  for (const change of CHANGES) if (markChange(doc, change, side)) found.add(change.id);
  // Shared section numbers (same slide order in original and draft).
  const sectionOf = new Map<number, number>();
  doc.querySelectorAll(".reveal .slides > section").forEach((sec, i) => {
    sec.setAttribute("data-sec", String(i + 1));
    const tag = doc.createElement("div");
    tag.className = "cmp-sec";
    tag.textContent = `Abschnitt ${i + 1}`;
    sec.prepend(tag);
    sec.querySelectorAll("[data-change]").forEach((el) => sectionOf.set(Number(el.getAttribute("data-change")), i + 1));
  });
  const base = doc.createElement("base");
  base.href = `${window.location.origin}/`;
  doc.head.prepend(base);
  const c = MARK[side];
  const style = doc.createElement("style");
  style.textContent = `
    html, body { overflow: auto !important; height: auto !important; }
    .reveal, .reveal .slides { position: static !important; height: auto !important; width: auto !important; transform: none !important; overflow: visible !important; }
    .reveal .slides > section, .reveal .slides > section > section {
      display: block !important; position: relative !important; top: auto !important; left: auto !important;
      opacity: 1 !important; visibility: visible !important; transform: none !important; height: auto !important;
      width: auto !important; min-height: 0 !important; margin: 0 0 24px !important; padding: 24px !important;
      border-bottom: 2px dashed #b7c3ae; overflow: visible !important;
    }
    .reveal h2, .reveal h3 { position: static !important; }
    .reveal .controls, .reveal .progress, .protected-overlay { display: none !important; }
    .reveal { font-size: 18px !important; }
    .reveal h1 { font-size: 2.2em !important; } .reveal h2 { font-size: 1.5em !important; } .reveal h3 { font-size: 1.2em !important; }
    img { max-width: 100%; height: auto; }
    .cmp-mark { background: ${c.bg} !important; box-shadow: inset 6px 0 0 ${c.border}; padding: 4px 8px 4px 14px !important; border-radius: 4px; color: #1f2937 !important; scroll-margin: 40px; }
    img.cmp-mark { border: 6px solid ${c.border}; padding: 0 !important; box-shadow: none; }
    .cmp-mark[data-active] { outline: 4px solid ${MARK.active}; outline-offset: 3px; }
    .reveal .slides > section { box-sizing: border-box !important; }
    .cmp-sec { display: block; margin: -12px 0 10px; font: 700 12px/1.4 Arial, sans-serif !important; color: #475569 !important; letter-spacing: .04em; text-transform: uppercase; }
    .cmp-badge { display: inline-block; margin: 0 8px 4px 0; padding: 2px 8px; border-radius: 999px; background: ${c.border}; color: #fff !important;
      font: 700 13px/1.4 Arial, sans-serif !important; letter-spacing: 0; text-transform: none; vertical-align: middle; }`;
  doc.head.appendChild(style);
  return { html: `<!doctype html>${doc.documentElement.outerHTML}`, found, sectionOf };
}

function Pane({ label, html, error, frameRef, onLoad }: {
  label: string; html?: string; error?: string;
  frameRef: React.RefObject<HTMLIFrameElement>; onLoad: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-md border border-border bg-card">
      <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">{label}</h2>
      {error ? (
        <p className="p-4 text-sm text-destructive">{error}</p>
      ) : html ? (
        // allow-same-origin only (no allow-scripts): article scripts are removed and cannot run;
        // the parent may scroll to markers.
        <iframe ref={frameRef} onLoad={onLoad} title={label} srcDoc={html} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[70vh] w-full border-0 bg-background" />
      ) : (
        <Skeleton className="m-3 h-[65vh]" />
      )}
    </section>
  );
}

export default function InfothekHtmlVergleich() {
  const { user, loading, isAdmin, roleChecked } = useAuth();
  const [original, setOriginal] = useState<ReturnType<typeof toStaticPreview>>();
  const [synced, setSynced] = useState(true);
  const syncedRef = useRef(true);
  syncedRef.current = synced;
  const ignoreScroll = useRef<Record<Side, boolean>>({ orig: false, draft: false });
  const [error, setError] = useState<string>();
  const [active, setActive] = useState<number>();
  const origRef = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef<HTMLIFrameElement>(null);
  const draft = useMemo(() => toStaticPreview(draftHtml, "draft"), []);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    (async () => {
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = { Accept: "text/html", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-infothek-html?path=${encodeURIComponent(ROUTE)}`,
          { headers, signal: controller.signal },
        );
        if (!res.ok) return setError(`Original nicht verfügbar (Status ${res.status}).`);
        setOriginal(toStaticPreview(await res.text(), "orig"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Original konnte nicht geladen werden.");
      }
    })();
    return () => controller.abort();
  }, [isAdmin]);

  const jumpable = CHANGES.filter((c) => !c.headOnly);

  const docOf = (side: Side) => (side === "orig" ? origRef : draftRef).current?.contentDocument ?? null;
  const absTop = (el: Element) => el.getBoundingClientRect().top + (el.ownerDocument.defaultView?.scrollY ?? 0);
  const setScroll = (side: Side, y: number) => {
    const win = docOf(side)?.defaultView;
    if (!win || Math.abs(win.scrollY - y) < 1) return;
    ignoreScroll.current[side] = true;
    win.scrollTo(0, y);
  };

  /** Make each section pair equally tall so shared section numbers sit at the same height. */
  const equalize = useCallback(() => {
    const a = docOf("orig"), b = docOf("draft");
    if (!a || !b) return;
    const sa = Array.from(a.querySelectorAll<HTMLElement>("[data-sec]"));
    const sb = Array.from(b.querySelectorAll<HTMLElement>("[data-sec]"));
    [...sa, ...sb].forEach((el) => (el.style.minHeight = ""));
    sa.forEach((el, i) => {
      const other = sb[i];
      if (!other) return;
      const h = Math.max(el.offsetHeight, other.offsetHeight);
      el.style.minHeight = other.style.minHeight = `${h}px`;
    });
  }, []);

  /** Map the source viewport top to the same section + relative position in the other frame. */
  const syncFrom = useCallback((from: Side) => {
    const to: Side = from === "orig" ? "draft" : "orig";
    const src = docOf(from), dst = docOf(to);
    if (!src || !dst) return;
    const y = src.defaultView!.scrollY;
    const secs = Array.from(src.querySelectorAll<HTMLElement>("[data-sec]"));
    let cur = secs[0];
    for (const sec of secs) if (absTop(sec) <= y + 1) cur = sec;
    if (!cur) return;
    const top = absTop(cur);
    const frac = Math.min(1, Math.max(0, (y - top) / Math.max(1, cur.offsetHeight)));
    const target = dst.querySelector<HTMLElement>(`[data-sec="${cur.getAttribute("data-sec")}"]`);
    if (!target) return;
    setScroll(to, y < top ? y : absTop(target) + frac * target.offsetHeight);
  }, []);

  const applyActive = useCallback((id?: number) => {
    let anchorY: number | undefined;
    for (const side of ["orig", "draft"] as Side[]) {
      const doc = docOf(side);
      if (!doc) continue;
      doc.querySelectorAll("[data-active]").forEach((el) => el.removeAttribute("data-active"));
      if (id === undefined) continue;
      const el = doc.querySelector(`[data-change="${id}"]`);
      if (!el) continue;
      el.setAttribute("data-active", "");
      const win = doc.defaultView!;
      // Place both markers at the same viewport height (first one centred, second aligned to it).
      if (anchorY === undefined) anchorY = Math.max(40, win.innerHeight / 2 - el.getBoundingClientRect().height / 2);
      setScroll(side, Math.max(0, absTop(el) - anchorY));
    }
  }, []);

  const [loaded, setLoaded] = useState(0);
  const onFrameLoad = useCallback(() => setLoaded((n) => n + 1), []);
  useEffect(() => {
    const a = docOf("orig"), b = docOf("draft");
    if (!a || !b) return;
    equalize();
    const cleanups: (() => void)[] = [];
    for (const doc of [a, b]) {
      Array.from(doc.images).forEach((img) => {
        if (!img.complete) { img.addEventListener("load", equalize); cleanups.push(() => img.removeEventListener("load", equalize)); }
      });
    }
    for (const side of ["orig", "draft"] as Side[]) {
      const win = docOf(side)!.defaultView!;
      const handler = () => {
        if (ignoreScroll.current[side]) { ignoreScroll.current[side] = false; return; }
        if (syncedRef.current) syncFrom(side);
      };
      win.addEventListener("scroll", handler, { passive: true });
      cleanups.push(() => win.removeEventListener("scroll", handler));
    }
    const onResize = () => { equalize(); syncFrom("orig"); };
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));
    applyActive(active);
    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, equalize, syncFrom]);

  useEffect(() => applyActive(active), [active, applyActive]);

  const step = (dir: 1 | -1) => {
    const idx = jumpable.findIndex((c) => c.id === active);
    const next = idx < 0 ? (dir === 1 ? 0 : jumpable.length - 1) : (idx + dir + jumpable.length) % jumpable.length;
    setActive(jumpable[next].id);
  };

  if (loading || (user && !roleChecked)) return <div className="container py-12"><Skeleton className="h-96 w-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const status = (c: ComparisonChange, side: Side) => {
    const found = side === "orig" ? original?.found : draft.found;
    if (!found) return "";
    return found.has(c.id) ? "" : side === "orig" ? " · links nicht gefunden" : " · rechts nicht gefunden";
  };

  return (
    <Layout>
      <SEOHead title="HTML-Vergleich (Entwurf)" noIndex />
      <div className="container py-6">
        <h1 className="font-serif text-2xl font-semibold">HTML-Vergleich: Frequenztherapie („Krankheit ist messbar“)</h1>
        <p className="mb-3 text-sm text-muted-foreground">
          Redaktioneller Entwurf zur gemeinsamen Prüfung – nicht veröffentlicht, keine Inhalts- oder Rechtsfreigabe. Statische Ansicht ohne Artikel-Skripte. Markierungen nur in dieser Ansicht.
        </p>

        <div className="mb-4 rounded-md border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: MARK.orig.bg, boxShadow: `inset 4px 0 0 ${MARK.orig.border}` }} />Rot + „Äx · Original“: beanstandete Stelle (links)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: MARK.draft.bg, boxShadow: `inset 4px 0 0 ${MARK.draft.border}` }} />Grün + „Äx · Entwurf“: geänderte Stelle (rechts)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border-2" style={{ borderColor: MARK.active }} />Blauer Rahmen: aktuell gewählte Änderung</span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" />Vorherige Änderung</Button>
            <Button size="sm" variant="outline" onClick={() => step(1)}>Nächste Änderung<ChevronRight className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground">{active ? `Ä${active} von ${CHANGES.length}` : `${CHANGES.length} Änderungen`}</span>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium">
              <Switch checked={synced} onCheckedChange={(v) => { setSynced(v); if (v) syncFrom("orig"); }} aria-label="Synchron scrollen" />
              Synchron scrollen (nach gemeinsamer Abschnittsnummer)
            </label>
          </div>
          <ol className="max-h-56 space-y-1 overflow-y-auto pr-1 text-xs" aria-label="Änderungsliste">
            {CHANGES.map((c) => (
              <li key={c.id}>
                {c.headOnly ? (
                  <div className="rounded border border-border px-2 py-1">
                    <span className="font-semibold">Ä{c.id}</span> [{c.reason.join(", ")}] {c.note} – nur im Seitenkopf:
                    <span className="block text-muted-foreground">vorher: „{c.headOnly.before}“</span>
                    <span className="block">neu: „{c.headOnly.after}“</span>
                  </div>
                ) : (
                  <button type="button" onClick={() => setActive(c.id)} aria-current={active === c.id}
                    className={`w-full rounded border px-2 py-1 text-left hover:bg-muted ${active === c.id ? "border-primary bg-muted" : "border-border"}`}>
                    <span className="font-semibold">Ä{c.id}</span>{original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""} [{c.reason.join(", ")}] {c.note}
                    <span className="text-destructive">{status(c, "orig")}{status(c, "draft")}</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
            {UNMARKED_NOTES.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Pane label="Original (aktuell ausgeliefert)" html={original?.html} error={error} frameRef={origRef} onLoad={onFrameLoad} />
          <Pane label="Vorgeschlagener Entwurf" html={draft.html} frameRef={draftRef} onLoad={onFrameLoad} />
        </div>
      </div>
    </Layout>
  );
}
