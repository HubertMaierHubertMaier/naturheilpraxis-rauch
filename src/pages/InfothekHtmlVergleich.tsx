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
import { composeWorkingVersion, findChangeTarget } from "@/lib/infothekComparison";
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

type MarkStyle = Side | "kept";
function markChange(doc: Document, change: ComparisonChange, side: Side, style: MarkStyle = side): boolean {
  const target = findChangeTarget(doc, change, side);
  if (!target) return false;
  const badge = doc.createElement("span");
  badge.className = `cmp-badge ${style}`;
  badge.textContent = `Ä${change.id} · ${style === "kept" ? "Original beibehalten (nicht übernommen)" : MARK[side].label}${change.img ? " (Alt-Text)" : ""}`;
  target.classList.add("cmp-mark", style);
  target.setAttribute("data-change", String(change.id));
  if (change.img) target.parentElement?.insertBefore(badge, target);
  else target.prepend(badge);
  if (style === "draft") {
    const why = doc.createElement("div");
    why.className = "cmp-why";
    const head = doc.createElement("strong");
    head.textContent = `Ä${change.id} – warum besser: `;
    const status = doc.createElement("span");
    status.className = "cmp-status";
    status.setAttribute("data-status-for", String(change.id));
    status.textContent = "Offen";
    why.append(status, head, doc.createTextNode(change.why));
    target.after(why);
  }
  return true;
}

/** Static, script-free rendering with change markers. */
export function toStaticPreview(html: string, side: Side, workingAccepted?: Set<number>): { html: string; found: Set<number>; sectionOf: Map<number, number> } {
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
  for (const change of CHANGES) {
    // Working version: accepted proposals are marked green, not accepted ones as kept original wording (grey).
    const ok = workingAccepted && !workingAccepted.has(change.id)
      ? markChange(doc, change, "orig", "kept")
      : markChange(doc, change, side);
    if (ok) found.add(change.id);
  }
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
    .cmp-mark.kept { background: #f1f5f9 !important; box-shadow: inset 6px 0 0 #64748b; }
    img.cmp-mark.kept { border-color: #64748b; }
    .cmp-badge.kept { background: #475569; }
    .cmp-why { margin: 6px 0 12px; padding: 8px 10px; border: 1px dashed ${c.border}; border-radius: 6px; background: #ffffff;
      font: 400 14px/1.45 Arial, sans-serif !important; color: #1f2937 !important; text-align: left; }
    html.has-rail .cmp-why { display: none !important; }
    .cmp-why strong { font-weight: 700; }
    .cmp-status { display: inline-block; margin-right: 8px; padding: 1px 8px; border-radius: 999px; border: 1px solid #64748b; font: 700 12px/1.4 Arial, sans-serif; color: #334155; }
    .cmp-status[data-accepted] { background: #15803d; border-color: #15803d; color: #fff; }
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
        <iframe ref={frameRef} onLoad={onLoad} title={label} srcDoc={html} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[calc(100vh-17rem)] min-h-[300px] w-full border-0 bg-background" />
      ) : (
        <Skeleton className="m-3 h-[calc(100vh-18rem)] min-h-[280px]" />
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
  const [cardId, setCardId] = useState<number>(CHANGES[0].id);
  const cardIdRef = useRef(cardId);
  cardIdRef.current = cardId;
  const [cardTop, setCardTop] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const origRef = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef<HTMLIFrameElement>(null);
  const [origRaw, setOrigRaw] = useState<string>();
  const storageKey = user ? `infothek-vergleich:krankheit-ist-messbar:v1:${user.id}` : null;
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [savedAt, setSavedAt] = useState<string>();
  const [rightMode, setRightMode] = useState<"proposal" | "working">("proposal");
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { accepted?: number[]; savedAt?: string };
        setAccepted(new Set((parsed.accepted ?? []).filter((id) => CHANGES.some((c) => c.id === id))));
        setSavedAt(parsed.savedAt);
      }
    } catch { /* ignore broken local state */ }
  }, [storageKey]);
  const toggleAccepted = (id: number, value: boolean) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (value) next.add(id); else next.delete(id);
      const stamp = new Date().toISOString();
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ accepted: [...next].sort((x, y) => x - y), savedAt: stamp }));
      setSavedAt(stamp);
      return next;
    });
  };
  const working = useMemo(
    () => (origRaw ? composeWorkingVersion(origRaw, draftHtml, CHANGES, accepted) : undefined),
    [origRaw, accepted],
  );
  const proposal = useMemo(() => toStaticPreview(draftHtml, "draft"), []);
  const workingPreview = useMemo(
    () => (rightMode === "working" && working ? toStaticPreview(working.html, "draft", accepted) : undefined),
    [rightMode, working, accepted],
  );
  const draft = workingPreview ?? proposal;
  const downloadWorking = () => {
    if (!working) return;
    const url = URL.createObjectURL(new Blob([working.html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `krankheit-ist-messbar.arbeitsfassung-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
        const text = await res.text();
        setOrigRaw(text);
        setOriginal(toStaticPreview(text, "orig"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Original konnte nicht geladen werden.");
      }
    })();
    return () => controller.abort();
  }, [isAdmin]);

  const jumpable = CHANGES;

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
    [...sa, ...sb].forEach((el) => el.style.removeProperty("min-height"));
    sa.forEach((el, i) => {
      const other = sb[i];
      if (!other) return;
      const h = Math.max(el.offsetHeight, other.offsetHeight);
      el.style.setProperty("min-height", `${h}px`, "important");
      other.style.setProperty("min-height", `${h}px`, "important");
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
      if (CHANGES.find((c) => c.id === id)?.headOnly) { setScroll(side, 0); continue; }
      const el = doc.querySelector(`[data-change="${id}"]`);
      if (!el) continue;
      el.setAttribute("data-active", "");
      const win = doc.defaultView!;
      // Place both markers at the same viewport height (first one centred, second aligned to it).
      if (anchorY === undefined) anchorY = Math.max(40, win.innerHeight / 2 - el.getBoundingClientRect().height / 2);
      setScroll(side, Math.max(0, absTop(el) - anchorY));
    }
  }, []);

  /** Margin note follows its marker in the right frame; while scrolling it switches to the marker in view. */
  const updateCard = useCallback((follow: boolean) => {
    const doc = docOf("draft");
    if (!doc) return;
    const h = doc.defaultView!.innerHeight;
    if (follow) {
      let best: number | undefined, dist = Infinity;
      doc.querySelectorAll<HTMLElement>("[data-change]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > h) return;
        const d = Math.abs(r.top - h / 3);
        if (d < dist) { dist = d; best = Number(el.dataset.change); }
      });
      if (best !== undefined && best !== cardIdRef.current) { cardIdRef.current = best; setCardId(best); }
    }
    const c = CHANGES.find((x) => x.id === cardIdRef.current);
    const el = c && !c.headOnly ? doc.querySelector(`[data-change="${c.id}"]`) : null;
    setCardTop(el ? el.getBoundingClientRect().top : 0);
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
        if (side === "draft") updateCard(true);
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

  useEffect(() => {
    if (active !== undefined) { cardIdRef.current = active; setCardId(active); }
    applyActive(active);
    requestAnimationFrame(() => updateCard(false));
  }, [active, applyActive, updateCard]);
  useEffect(() => {
    const doc = docOf("draft");
    if (!doc) return;
    doc.documentElement.classList.toggle("has-rail", wide);
    equalize();
    syncFrom("draft");
    updateCard(false);
  }, [wide, loaded, equalize, syncFrom, updateCard]);
  useEffect(() => {
    docOf("draft")?.querySelectorAll<HTMLElement>("[data-status-for]").forEach((el) => {
      const on = accepted.has(Number(el.dataset.statusFor));
      el.textContent = on ? "Übernommen" : "Offen";
      el.toggleAttribute("data-accepted", on);
    });
  }, [accepted, loaded]);

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
      <div className="container py-2">
        <h1 className="font-serif text-lg font-semibold leading-tight">HTML-Vergleich: Frequenztherapie („Krankheit ist messbar“) <span className="text-xs font-normal text-muted-foreground">– Entwurf, nicht veröffentlicht, keine Freigabe</span></h1>

        <div className="sticky top-0 z-10 my-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => step(-1)} aria-label="Vorherige Änderung"><ChevronLeft className="h-4 w-4" />Vorherige</Button>
          <span className="min-w-[4.5rem] text-center font-semibold">{active ? `Ä${active} / ${CHANGES.length}` : `– / ${CHANGES.length}`}</span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => step(1)} aria-label="Nächste Änderung">Nächste<ChevronRight className="h-4 w-4" /></Button>
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{accepted.size} von {CHANGES.length} übernommen</span>
          <label className="flex items-center gap-1.5 font-medium">
            <Switch checked={synced} onCheckedChange={(v) => { setSynced(v); if (v) syncFrom("orig"); }} aria-label="Synchron scrollen" />Synchron
          </label>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant={rightMode === "working" ? "default" : "outline"} className="h-7 px-2 text-xs"
              onClick={() => setRightMode((m) => (m === "working" ? "proposal" : "working"))} disabled={!working}>
              {rightMode === "working" ? "Rechts: Vorschlag" : "Rechts: Arbeitsfassung"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={downloadWorking} disabled={!working}>HTML herunterladen</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
              {listOpen ? "Liste einklappen" : "Alle Änderungen"}
            </Button>
          </span>
          {working && working.failed.length > 0 && <span className="w-full text-destructive">Nicht anwendbar: {working.failed.map((id) => `Ä${id}`).join(", ")}</span>}
        </div>

        {listOpen && (
          <div className="mb-2 rounded-md border border-border bg-card p-2">
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: MARK.orig.bg, boxShadow: `inset 4px 0 0 ${MARK.orig.border}` }} />Original (links)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: MARK.draft.bg, boxShadow: `inset 4px 0 0 ${MARK.draft.border}` }} />Entwurf (rechts)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: "#f1f5f9", boxShadow: "inset 4px 0 0 #64748b" }} />Original beibehalten</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border-2" style={{ borderColor: MARK.active }} />aktuelle Änderung</span>
              <span className="text-muted-foreground">Entscheidungen nur lokal in diesem Browser gespeichert{savedAt ? ` (zuletzt ${new Date(savedAt).toLocaleString("de-DE")})` : ""} – nicht auf dem Server.</span>
            </div>
            <ol className="max-h-56 space-y-1 overflow-y-auto pr-1 text-xs" aria-label="Änderungsliste">
              {CHANGES.map((c) => (
                <li key={c.id} className={`flex items-start gap-2 rounded border px-2 py-1 ${active === c.id ? "border-primary bg-muted" : "border-border"}`}>
                  <button type="button" onClick={() => setActive(c.id)} className="min-w-0 flex-1 text-left hover:underline">
                    <span className="font-semibold">Ä{c.id}</span>{c.headOnly ? " · Seitenkopf" : original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""} [{c.reason.join(", ")}] {c.note}
                    <span className="text-destructive">{c.headOnly ? "" : status(c, "orig") + status(c, "draft")}</span>
                  </button>
                  <AcceptControl on={accepted.has(c.id)} id={c.id} toggle={toggleAccepted} />
                </li>
              ))}
            </ol>
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {UNMARKED_NOTES.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
          <Pane label="Original (aktuell ausgeliefert)" html={original?.html} error={error} frameRef={origRef} onLoad={onFrameLoad} />
          <Pane label={rightMode === "working" ? `Arbeitsfassung (Original + ${accepted.size} übernommen)` : "Vorgeschlagener Entwurf"} html={draft.html} frameRef={draftRef} onLoad={onFrameLoad} />
          <aside className="relative lg:pt-[37px]" aria-label="Randnotiz zur Änderung">
            <div className="relative lg:h-[calc(100vh-17rem)] lg:min-h-[300px]">
              {(() => {
                const c = CHANGES.find((x) => x.id === cardId);
                if (!c) return null;
                const top = wide ? Math.max(0, Math.min(cardTop, window.innerHeight - 22 * 16)) : 0;
                return (
                  <div className="rounded-md border-2 border-primary/60 bg-card p-2 text-xs shadow-sm lg:absolute lg:inset-x-0 transition-[top] duration-150" style={wide ? { top } : undefined}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <button type="button" className="font-semibold hover:underline" onClick={() => setActive(c.id)}>
                        Ä{c.id}{c.headOnly ? " · Seitenkopf (SEO)" : original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""}
                      </button>
                      <span className="text-muted-foreground">{c.reason.join(", ")}</span>
                    </div>
                    {c.headOnly && (
                      <div className="mb-1 space-y-0.5">
                        <p className="text-muted-foreground">vorher: „{c.headOnly.before}“</p>
                        <p>neu: „{c.headOnly.after}“</p>
                      </div>
                    )}
                    <p className="mb-2"><span className="font-semibold">Warum besser:</span> {c.why}</p>
                    <AcceptControl on={accepted.has(c.id)} id={c.id} toggle={toggleAccepted} />
                  </div>
                );
              })()}
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function AcceptControl({ on, id, toggle }: { on: boolean; id: number; toggle: (id: number, v: boolean) => void }) {
  return on ? (
    <span className="flex items-center gap-1">
      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Übernommen</span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => toggle(id, false)}>Rückgängig</Button>
    </span>
  ) : (
    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => toggle(id, true)} aria-label={`Ä${id} übernehmen`}>Übernehmen</Button>
  );
}
