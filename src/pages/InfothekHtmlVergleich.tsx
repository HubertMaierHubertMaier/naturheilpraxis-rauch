import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { composeWorkingVersion, findChangeTarget, nextOpenChange } from "@/lib/infothekComparison";
import type { ComparisonChange } from "@/lib/infothekComparisonChanges";
import { configFor, type ComparisonConfig } from "@/lib/infothekComparisonConfigs";
import { EDITORIAL_STATUS } from "@/lib/infothekEditorialStatus";
import { buildProgressReport, progressProjection, isOptionalAlternative, parseDecisions, replacedBy, serializeDecisions, undecided } from "@/lib/infothekDecisions";
import { applyContactCorrection } from "@/lib/practiceContact";

// Active comparison (one page instance at a time; set at render start, page remounts per slug).
let CFG: ComparisonConfig = configFor(undefined);
let CHANGES = CFG.changes; let CHANGE_TOPICS = CFG.topics; let UNMARKED_NOTES = CFG.notes; let draftHtml = CFG.draftHtml;
let ROUTE = CFG.base.kind === "delivered" ? CFG.base.route : `/${CFG.slug}.html`;
export default function InfothekHtmlVergleichRoute() {
  const { slug } = useParams();
  const cfg = configFor(slug ?? "krankheit-ist-messbar");
  CFG = cfg; CHANGES = cfg.changes; CHANGE_TOPICS = cfg.topics; UNMARKED_NOTES = cfg.notes; draftHtml = cfg.draftHtml;
  ROUTE = cfg.base.kind === "delivered" ? cfg.base.route : `/${cfg.slug}.html`;
  return <InfothekHtmlVergleich key={cfg.slug} />;
}
type Side = "orig" | "draft";

/** Colours used inside the article frames (legend below mirrors them). */
const MARK = {
  orig: { bg: "#fde2e2", border: "#b91c1c", label: "Original/Basis" },
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
  // Alternative proposals (supersedes) share the original element with the earlier proposal.
  if (target.hasAttribute("data-change")) target.setAttribute("data-change-also", `${target.getAttribute("data-change-also") ?? ""} ${change.id}`.trim());
  else target.setAttribute("data-change", String(change.id));
  // Mark the full replaced range (neighbouring text nodes), so no unmarked remainder appears.
  if (!change.img) [change.withPrev ? target.previousElementSibling : null, change.withNext ? target.nextElementSibling : null]
    .forEach((el) => el?.classList.add("cmp-mark", style));
  if (change.img) target.parentElement?.insertBefore(badge, target);
  else target.prepend(badge);
  if (style === "draft" || style === "kept") {
    const why = doc.createElement("div");
    why.className = "cmp-why";
    const head = doc.createElement("strong");
    head.textContent = `Ä${change.id} – warum besser: `;
    const status = doc.createElement("span");
    status.className = "cmp-status";
    status.setAttribute("data-status-for", String(change.id));
    status.textContent = "Offen";
    const text = doc.createElement("span");
    text.className = "cmp-why-text";
    text.textContent = change.why;
    head.className = "cmp-why-text";
    // Comparison-only controls; handled by a listener in the parent page (no scripts run in the frame).
    const actions = doc.createElement("span");
    actions.className = "cmp-actions";
    const accept = doc.createElement("button");
    accept.type = "button";
    accept.className = "cmp-btn cmp-accept";
    accept.setAttribute("data-accept", String(change.id));
    accept.textContent = `Nur Änderung Ä${change.id} übernehmen`;
    const undo = doc.createElement("button");
    undo.type = "button";
    undo.className = "cmp-btn cmp-undo";
    undo.setAttribute("data-undo", String(change.id));
    undo.textContent = "Rückgängig";
    undo.hidden = true;
    actions.append(accept, undo);
    why.append(status, head, text, actions);
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
    sec.querySelectorAll("[data-change]").forEach((el) => { sectionOf.set(Number(el.getAttribute("data-change")), i + 1); (el.getAttribute("data-change-also") ?? "").split(" ").filter(Boolean).forEach((x) => sectionOf.set(Number(x), i + 1)); });
  });
  const base = doc.createElement("base");
  base.href = `${window.location.origin}/`;
  doc.head.prepend(base);
  const c = MARK[side];
  const style = doc.createElement("style");
  style.textContent = `
    /* Exactly one vertical scroller per article: the document (html). body never scrolls itself. */
    html { overflow-x: hidden !important; overflow-y: auto !important; height: auto !important; max-height: none !important; }
    body { overflow: visible !important; height: auto !important; max-height: none !important; min-height: 0 !important; position: static !important; }
    .reveal, .reveal .slides { position: static !important; height: auto !important; width: auto !important; transform: none !important; overflow: visible !important; }
    .reveal .slides > section, .reveal .slides > section > section {
      display: block !important; position: relative !important; top: auto !important; left: auto !important;
      opacity: 1 !important; visibility: visible !important; transform: none !important; height: auto !important;
      width: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 0 24px !important; padding: 24px !important;
      border-bottom: 2px dashed #b7c3ae; overflow: visible !important;
    }
    .reveal h2, .reveal h3 { position: static !important; }
    .reveal .slides section, .reveal .slides section * { max-height: none !important; }
    .reveal .slides section { height: auto !important; }
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
    html.has-rail .cmp-why-text { display: none !important; }
    html.has-rail .cmp-why { padding: 4px 8px; }
    .cmp-actions { display: inline-flex; gap: 6px; margin-left: 6px; vertical-align: middle; }
    .cmp-btn { font: 700 13px/1.3 Arial, sans-serif !important; padding: 3px 10px; border-radius: 6px; cursor: pointer; border: 1px solid #15803d; background: #15803d; color: #fff; -webkit-text-fill-color: #fff; }
    .cmp-btn.cmp-undo { background: #fff; color: #334155; -webkit-text-fill-color: #334155; border-color: #64748b; }
    .cmp-btn[hidden] { display: none !important; }
    .cmp-why, .cmp-actions, .cmp-btn { pointer-events: auto !important; }
    html body .cmp-mark.cmp-mark.cmp-mark, html body .cmp-mark.cmp-mark *:not(.cmp-badge):not(.cmp-status), html body .reveal .slides section .cmp-mark, html body .reveal .slides section .cmp-mark *:not(.cmp-badge) { color: #111827 !important; -webkit-text-fill-color: #111827 !important; text-shadow: none !important; }
    html body .cmp-badge.cmp-badge { color: #fff !important; -webkit-text-fill-color: #fff !important; }
    html body .cmp-status.cmp-status { -webkit-text-fill-color: currentColor !important; }
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
        <iframe ref={frameRef} onLoad={onLoad} title={label} srcDoc={html} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[calc(100vh-8rem)] min-h-[300px] w-full border-0 bg-background" />
      ) : (
        <Skeleton className="m-3 h-[calc(100vh-9rem)] min-h-[280px]" />
      )}
    </section>
  );
}

function InfothekHtmlVergleich() {
  const { user, loading, isAdmin, roleChecked } = useAuth();
  const [original, setOriginal] = useState<ReturnType<typeof toStaticPreview>>();
  const [synced, setSynced] = useState(true);
  const syncedRef = useRef(true);
  syncedRef.current = synced;
  const ignoreScroll = useRef<Record<Side, boolean>>({ orig: false, draft: false });
  const [error, setError] = useState<string>();
  const [active, setActive] = useState<number>();
  const [cardId, setCardId] = useState<number | undefined>(undefined);
  const cardIdRef = useRef(cardId);
  cardIdRef.current = cardId;
  const [cardTop, setCardTop] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardText, setCardText] = useState<{ orig?: string; draft?: string }>({});
  const [listOpen, setListOpen] = useState(false);
  const [namingOpen, setNamingOpen] = useState(false);
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
  const storageKey = user ? `infothek-vergleich:${CFG.slug}:v1:${user.id}` : null;
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [openListOpen, setOpenListOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();
  const [rightMode, setRightMode] = useState<"proposal" | "working">("proposal");
  useEffect(() => {
    if (!storageKey) return;
    try {
      const d = parseDecisions(localStorage.getItem(storageKey), CHANGES.map((c) => c.id));
      setAccepted(d.accepted);
      setKept(d.kept);
      setSavedAt(d.savedAt);
    } catch { /* ignore broken local state */ }
  }, [storageKey]);
  // Start selection: last explicitly chosen change (if still valid), otherwise first visible text change.
  const activeKey = storageKey ? `${storageKey}:active` : null;
  useEffect(() => {
    if (!activeKey) return;
    const stored = Number(localStorage.getItem(activeKey));
    const valid = CHANGES.some((c) => c.id === stored);
    setActive(valid ? stored : CHANGES.find((c) => !c.headOnly)?.id);
  }, [activeKey]);
  const chooseActive = (id: number) => {
    setActive(id);
    if (activeKey) localStorage.setItem(activeKey, String(id));
  };
  const [saveError, setSaveError] = useState<string>();
  /** Persists first; only a successful save updates the state (and may advance). */
  const persist = (id: number, next: Set<number>, nextKept: Set<number>): boolean => {
    const stamp = new Date().toISOString();
    try {
      if (!storageKey) throw new Error("no user");
      localStorage.setItem(storageKey, serializeDecisions({ accepted: next, kept: nextKept, savedAt: stamp }));
    } catch {
      setSaveError(`Ä${id} konnte nicht gespeichert werden – Auswahl bleibt hier.`);
      return false;
    }
    setSaveError(undefined);
    setAccepted(next);
    setKept(nextKept);
    setSavedAt(stamp);
    return true;
  };
  const toggleAccepted = (id: number, value: boolean): boolean => {
    const next = new Set(accepted), nextKept = new Set(kept);
    if (value) { next.add(id); nextKept.delete(id); } else next.delete(id);
    return persist(id, next, nextKept);
  };
  /** Explicit decision "keep original" – separate from the accepted counter. */
  const toggleKept = (id: number, value: boolean): boolean => {
    const next = new Set(accepted), nextKept = new Set(kept);
    if (value) { nextKept.add(id); next.delete(id); } else nextKept.delete(id);
    if (!persist(id, next, nextKept)) return false;
    if (value) {
      const t = nextOpenChange(CHANGES.map((c) => c.id), new Set([...next, ...nextKept, ...CHANGES.filter((c) => replacedBy(c, CHANGES, { accepted: next, kept: nextKept }) !== undefined).map((c) => c.id)]), id);
      if (t !== undefined) chooseActive(t);
    }
    return true;
  };
  const acceptAndAdvance = (id: number) => {
    const next = new Set(accepted).add(id);
    if (!toggleAccepted(id, true)) return;
    const target = nextOpenChange(CHANGES.map((c) => c.id), new Set([...next, ...kept, ...CHANGES.filter((c) => replacedBy(c, CHANGES, { accepted: next, kept }) !== undefined).map((c) => c.id)]), id);
    if (target !== undefined) chooseActive(target);
  };
  const working = useMemo(
    () => (origRaw ? (() => { const w = composeWorkingVersion(origRaw, draftHtml, CHANGES, accepted); return { ...w, html: applyContactCorrection(w.html).html }; })() : undefined),
    [origRaw, accepted],
  );
  const proposal = useMemo(() => toStaticPreview(draftHtml, "draft"), []);
  const workingPreview = useMemo(
    () => (rightMode === "working" && working ? toStaticPreview(working.html, "draft", accepted) : undefined),
    [rightMode, working, accepted],
  );
  const draft = workingPreview ?? proposal;
  const decisions = { accepted, kept, savedAt };
  const openItems = undecided(CHANGES, decisions);
  const proj = progressProjection(CHANGES, decisions, working?.failed ?? []);
  const downloadReport = () => {
    if (!storageKey) return;
    const md = buildProgressReport({ changes: CHANGES, topics: CHANGE_TOPICS, d: decisions, storageKey, sectionOf: original?.sectionOf, title: CFG.reportTitle, extraChecks: CFG.extraChecks, failed: working?.failed ?? [] });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `krankheit-ist-messbar.fortschritt-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadWorking = () => {
    if (!working) return;
    const url = URL.createObjectURL(new Blob([working.html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${CFG.slug}.arbeitsfassung-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (CFG.base.kind === "baseDraft") { setOrigRaw(CFG.base.html); setOriginal(toStaticPreview(CFG.base.html, "orig")); return; }
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
      const h = Math.max(el.scrollHeight, other.scrollHeight, el.offsetHeight, other.offsetHeight);
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

  const applyActive = useCallback((id?: number, scroll = true) => {
    let anchorY: number | undefined;
    for (const side of ["orig", "draft"] as Side[]) {
      const doc = docOf(side);
      if (!doc) continue;
      doc.querySelectorAll("[data-active]").forEach((el) => el.removeAttribute("data-active"));
      if (id === undefined) continue;
      if (CHANGES.find((c) => c.id === id)?.headOnly) { if (scroll) setScroll(side, 0); continue; }
      const el = doc.querySelector(`[data-change="${id}"], [data-change-also~="${id}"]`);
      if (!el) continue;
      el.setAttribute("data-active", "");
      if (!scroll) continue;
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
        const d = Math.abs(r.top - h * 0.2);
        if (d < dist) { dist = d; best = Number(el.dataset.change); }
      });
      if (best !== undefined && best !== cardIdRef.current) {
        cardIdRef.current = best;
        setCardId(best);
        followRef.current?.(best);
      }
    }
    const c = CHANGES.find((x) => x.id === cardIdRef.current);
    const el = c && !c.headOnly ? doc.querySelector(`[data-change="${c.id}"], [data-change-also~="${c.id}"]`) : null;
    setCardTop(el ? el.getBoundingClientRect().top : 0);
    // Full wording of the marked element on both sides (badge/why box excluded).
    const textOf = (side: Side) => {
      const t = c && !c.headOnly ? docOf(side)?.querySelector(`[data-change="${c.id}"], [data-change-also~="${c.id}"]`) : null;
      if (!t) return undefined;
      // iframe elements belong to another realm: instanceof HTMLImageElement is always false there.
      if (t.tagName === "IMG") return t.getAttribute("alt") || undefined;
      const clone = t.cloneNode(true) as Element;
      clone.querySelectorAll(".cmp-badge, .cmp-why, .cmp-actions").forEach((x) => x.remove());
      const txt = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
      return txt.length > 260 ? `${txt.slice(0, 257)}…` : txt;
    };
    setCardText({ orig: textOf("orig"), draft: textOf("draft") });
  }, []);

  // Refs so listeners inside the frames always call the current handlers.
  const followRef = useRef<(id: number) => void>();
  const acceptRef = useRef<(id: number) => void>();
  const undoRef = useRef<(id: number) => void>();
  const noScrollNext = useRef(false);
  const lastUserInput = useRef(0);

  const [loaded, setLoaded] = useState(0);
  const onFrameLoad = useCallback(() => setLoaded((n) => n + 1), []);
  useEffect(() => {
    const a = docOf("orig"), b = docOf("draft");
    if (!a || !b) return;
    equalize();
    // Re-measure after web fonts are ready (natural height changes with font metrics).
    a.fonts?.ready.then(equalize); b.fonts?.ready.then(equalize);
    const cleanups: (() => void)[] = [];
    for (const doc of [a, b]) {
      Array.from(doc.images).forEach((img) => {
        if (!img.complete) { img.addEventListener("load", equalize); cleanups.push(() => img.removeEventListener("load", equalize)); }
      });
    }
    for (const side of ["orig", "draft"] as Side[]) {
      const win = docOf(side)!.defaultView!;
      const doc = docOf(side)!;
      const markUser = () => { lastUserInput.current = Date.now(); };
      for (const ev of ["wheel", "touchmove", "keydown", "mousedown"]) {
        doc.addEventListener(ev, markUser, { passive: true });
        cleanups.push(() => doc.removeEventListener(ev, markUser));
      }
      const handler = () => {
        if (ignoreScroll.current[side]) { ignoreScroll.current[side] = false; return; }
        if (syncedRef.current) syncFrom(side);
        // Only scrolling caused by the user (wheel/touch/keys/scrollbar) re-targets the margin note.
        const byUser = Date.now() - lastUserInput.current < 800;
        updateCard(byUser);
      };
      win.addEventListener("scroll", handler, { passive: true });
      cleanups.push(() => win.removeEventListener("scroll", handler));
    }
    const onClick = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.("[data-accept],[data-undo]");
      if (!t) return;
      e.preventDefault();
      const acc = t.getAttribute("data-accept");
      if (acc) acceptRef.current?.(Number(acc)); else undoRef.current?.(Number(t.getAttribute("data-undo")));
    };
    b.addEventListener("click", onClick);
    cleanups.push(() => b.removeEventListener("click", onClick));
    const onResize = () => { equalize(); syncFrom("orig"); };
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));
    applyActive(active);
    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, equalize, syncFrom]);

  useEffect(() => {
    if (active !== undefined) { cardIdRef.current = active; setCardId(active); }
    const scroll = !noScrollNext.current;
    noScrollNext.current = false;
    applyActive(active, scroll);
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
      const id = Number(el.dataset.statusFor);
      const c = CHANGES.find((x) => x.id === id);
      const rep = c ? replacedBy(c, CHANGES, { accepted, kept }) : undefined;
      const on = accepted.has(id);
      const k = kept.has(id);
      el.textContent = rep !== undefined ? `Ersetzt durch Ä${rep}` : on ? "Übernommen" : k ? "Original beibehalten" : "Offen";
      el.toggleAttribute("data-accepted", on && rep === undefined);
      const box = el.closest<HTMLElement>(".cmp-why");
      const acc = box?.querySelector<HTMLElement>("[data-accept]"), undo = box?.querySelector<HTMLElement>("[data-undo]");
      if (acc) acc.hidden = on || rep !== undefined;
      if (undo) undo.hidden = !on || rep !== undefined;
      // Replaced draft wording is hidden; restored automatically when the alternative is undone.
      const target = box?.previousElementSibling as HTMLElement | null;
      if (box && target && c && !c.img) {
        [box, target, c.withPrev ? target.previousElementSibling : null, c.withNext ? box.nextElementSibling : null]
          .forEach((x) => { if (x) (x as HTMLElement).hidden = rep !== undefined; });
      }
    });
  }, [accepted, kept, loaded]);

  followRef.current = (id: number) => { noScrollNext.current = true; chooseActive(id); };
  acceptRef.current = acceptAndAdvance;
  undoRef.current = (id: number) => { toggleAccepted(id, false); };
  const step = (dir: 1 | -1) => {
    const idx = jumpable.findIndex((c) => c.id === active);
    const next = idx < 0 ? (dir === 1 ? 0 : jumpable.length - 1) : (idx + dir + jumpable.length) % jumpable.length;
    chooseActive(jumpable[next].id);
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
    <main className="min-h-screen bg-background">
      <SEOHead title="HTML-Vergleich (Entwurf)" noIndex />
      <div className="container py-2">
        <h1 className="font-serif text-lg font-semibold leading-tight">HTML-Vergleich: {CFG.heading} <span className="text-xs font-normal text-muted-foreground">– Entwurf, nicht veröffentlicht, keine Freigabe</span></h1>

        <div className="my-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => step(-1)} aria-label="Vorherige Änderung"><ChevronLeft className="h-4 w-4" />Vorherige</Button>
          <span className="flex min-w-[9rem] max-w-[22rem] flex-col text-center leading-tight sm:max-w-[30rem]" aria-live="polite">
            <span className="font-semibold">{active ? `Vorschlag ${active} von ${CHANGES.length}` : `Kein Vorschlag gewählt (${CHANGES.length})`}</span>
            {active && <span className="truncate text-xs text-muted-foreground">{CHANGE_TOPICS[active]}{(() => { const c = CHANGES.find((x) => x.id === active); return c?.headOnly ? " · im Artikel nicht sichtbar" : original?.sectionOf.get(active) ? ` · Abschnitt ${original.sectionOf.get(active)}` : ""; })()}</span>}
          </span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => step(1)} aria-label="Nächste Änderung">Nächste<ChevronRight className="h-4 w-4" /></Button>
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold" title={`Original beibehalten: ${proj.kept.length} · ersetzt durch Alternative: ${proj.replaced.length} · offen: ${proj.open.length}${proj.optionalOpen.length ? ` (davon ${proj.optionalOpen.length} optionale Alternativen)` : ""}`}>{proj.accepted.length} von {CHANGES.length} übernommen{proj.replaced.length ? ` · ${proj.replaced.length} ersetzt` : ""}{proj.appliedFailed.length ? ` · ${proj.appliedFailed.length} nicht angewandt` : ""}</span>
          {proj.kept.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5">{proj.kept.length} Original beibehalten</span>}
          <Button size="sm" variant={openListOpen ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setOpenListOpen((o) => !o)} aria-expanded={openListOpen}>Noch zu entscheiden ({openItems.length})</Button>
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
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNamingOpen((o) => !o)} aria-expanded={namingOpen} disabled={!CFG.naming}>HTML-Benennung</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setStatusOpen((o) => !o)} aria-expanded={statusOpen}>Stand aller HTMLs</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={downloadReport} disabled={!storageKey}>Fortschrittsbericht</Button>
          </span>
          {saveError && <span role="alert" className="w-full font-semibold text-destructive">{saveError}</span>}
          {openItems.length === 0 && <span role="status" className="w-full rounded bg-primary/10 px-2 py-1 font-semibold">Alle {CHANGES.length} Vorschläge entschieden ({proj.accepted.length} übernommen, {proj.kept.length} Original beibehalten{proj.replaced.length ? `, ${proj.replaced.length} ersetzt` : ""}). Noch nicht abgeschlossen: Restprüfung „Zusätzlich zu prüfen“. Nicht veröffentlicht, keine Freigabe.</span>}
          {working && working.failed.length > 0 && <span className="w-full text-destructive">Nicht anwendbar: {working.failed.map((id) => `Ä${id}`).join(", ")}</span>}
        </div>

        {namingOpen && CFG.naming && <NamingPanel />}
        {openListOpen && (
          <div className="mb-2 rounded-md border border-border bg-card p-2 text-xs">
            <p className="mb-1 text-muted-foreground">Noch offen heißt nicht abgelehnt. Klick springt zur Stelle links/rechts und zur Randnotiz.</p>
            <ul className="max-h-36 space-y-0.5 overflow-y-auto">
              {openItems.map((c) => (
                <li key={c.id}>
                  <button type="button" className="text-left hover:underline" onClick={() => chooseActive(c.id)}>
                    <span className="font-semibold">Vorschlag {c.id}</span> · {CHANGE_TOPICS[c.id]}
                    {c.headOnly ? " · im Artikel nicht sichtbar" : original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""}
                    {isOptionalAlternative(c, decisions) && <span className="ml-1 rounded bg-muted px-1">optionale Alternative zu Vorschlag {c.supersedes}</span>}
                  </button>
                </li>
              ))}
              {openItems.length === 0 && <li>Alle Vorschläge entschieden.</li>}
            </ul>
            <p className="mt-2 font-semibold">Zusätzlich zu prüfen (nicht durch die Vorschläge abgedeckt)</p>
            <ul className="list-disc pl-5">{CFG.extraChecks.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        {statusOpen && (
          <div className="mb-2 overflow-x-auto rounded-md border border-border bg-card p-2 text-xs">
            <p className="mb-1 text-muted-foreground">Redaktioneller Bearbeitungsstand (Quelle: Infothek-Verzeichnis im Projekt). Veröffentlichung wird separat entschieden. Ohne Nachweis gilt eine Seite als nicht begonnen.</p>
            <table className="w-full border-collapse">
              <thead><tr className="text-left"><th className="p-1">Datei</th><th className="p-1">Titel</th><th className="p-1">Bearbeitung</th><th className="p-1">Sichtbarkeit / Prüfung</th><th className="p-1">Offen</th></tr></thead>
              <tbody>
                {EDITORIAL_STATUS.map((e) => (
                  <tr key={e.file} className="border-t border-border align-top">
                    <td className="p-1">{e.comparePath ? <a className="underline" href={e.comparePath}>{e.file}</a> : e.file}</td>
                    <td className="p-1">{e.title}</td>
                    <td className="p-1 font-semibold">{e.state}</td>
                    <td className="p-1">{e.visibility} · {e.reviewStatus}{e.indexable ? " · indexierbar" : " · noindex"}</td>
                    <td className="p-1">{e.comparePath ? (e.comparePath.endsWith(`/${CFG.slug}`) ? `${openItems.length} Vorschläge offen (hier); ` : "") + e.openTopics.join("; ") : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <button type="button" onClick={() => chooseActive(c.id)} className="min-w-0 flex-1 text-left hover:underline">
                    <span className="font-semibold">Ä{c.id}</span>{c.headOnly ? (c.headOnly.kind === "title" ? " · HTML-Seitentitel (im Artikel nicht sichtbar)" : " · Meta-Beschreibung (im Artikel nicht sichtbar)") : original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""} [{c.reason.join(", ")}] {c.note}
                    <span className="text-destructive">{c.headOnly ? "" : status(c, "orig") + status(c, "draft")}</span>
                  </button>
                  {replacedBy(c, CHANGES, decisions) !== undefined ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Ersetzt durch Vorschlag {replacedBy(c, CHANGES, decisions)}</span> : <AcceptControl on={accepted.has(c.id)} kept={kept.has(c.id)} id={c.id} accept={acceptAndAdvance} undo={(id) => toggleAccepted(id, false)} keep={(id, v) => toggleKept(id, v)} />}
                </li>
              ))}
            </ol>
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {UNMARKED_NOTES.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
          <Pane label={CFG.leftLabel} html={original?.html} error={error} frameRef={origRef} onLoad={onFrameLoad} />
          <Pane label={rightMode === "working" ? `Arbeitsfassung (Original + ${proj.applied.length} angewandt${proj.appliedFailed.length ? `, ${proj.appliedFailed.length} nicht anwendbar` : ""})` : "Vorgeschlagener Entwurf"} html={draft.html} frameRef={draftRef} onLoad={onFrameLoad} />
          <aside className="relative lg:pt-[37px]" aria-label="Randnotiz zur Änderung">
            <div ref={railRef} className="relative lg:h-[calc(100vh-8rem)] lg:min-h-[300px]">
              {(() => {
                const c = CHANGES.find((x) => x.id === cardId);
                if (!c) return (
                  <div className="rounded-md border border-dashed border-border bg-card p-2 text-xs text-muted-foreground">
                    Keine Änderung gewählt. Mit „Nächste“ eine Änderung wählen oder zu einer markierten Stelle scrollen – die Randnotiz zeigt dann deren Nummer und Begründung.
                  </div>
                );
                const railH = railRef.current?.clientHeight ?? 400;
                const cardH = Math.min(cardRef.current?.offsetHeight ?? 0, railH);
                const top = wide ? Math.max(0, Math.min(cardTop, railH - cardH)) : 0;
                return (
                  <div ref={cardRef} className="rounded-md border-2 border-primary/60 bg-card p-2 text-xs shadow-sm lg:absolute lg:inset-x-0 lg:overflow-y-auto transition-[top] duration-150" style={wide ? { top, maxHeight: railH } : undefined}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <button type="button" className="font-semibold hover:underline" onClick={() => chooseActive(c.id)}>
                        Vorschlag {c.id} · {CHANGE_TOPICS[c.id]}{c.headOnly ? "" : original?.sectionOf.get(c.id) ? ` · Abschnitt ${original.sectionOf.get(c.id)}` : ""}
                      </button>
                      <span className="text-muted-foreground">{c.reason.join(", ")}</span>
                    </div>
                    {c.supersedes !== undefined && <p className="mb-1 rounded bg-muted px-1.5 py-1">Optionale Alternative zu Vorschlag {c.supersedes}{accepted.has(c.supersedes) ? " (bereits übernommen)" : ""} – kein zusätzliches Problem. Bei Übernahme ersetzt sie Vorschlag {c.supersedes} in der Arbeitsfassung.</p>}
                    {c.headOnly && (
                      <div className="mb-2 space-y-1">
                        <p className="rounded bg-muted px-1.5 py-1 font-medium">
                          {c.headOnly.kind === "title"
                            ? "HTML-Seitentitel – Browser-Tab/Suche, im Artikel nicht sichtbar."
                            : "Meta-Beschreibung – Suchergebnis/Link-Vorschau, im Artikel nicht sichtbar."}
                          {" "}Es gibt dafür keine markierte Textzeile im Artikel.
                        </p>
                        <dl className="space-y-1">
                          <div className="rounded border-l-4 px-1.5 py-0.5" style={{ borderColor: MARK.orig.border }}><dt className="font-semibold">Original</dt><dd>„{c.headOnly.before}“</dd></div>
                          <div className="rounded border-l-4 px-1.5 py-0.5" style={{ borderColor: MARK.draft.border }}><dt className="font-semibold">Entwurf</dt><dd>„{c.headOnly.after}“</dd></div>
                        </dl>
                      </div>
                    )}
                    {!c.headOnly && (c.orig || c.draft) && (
                      <dl className="mb-2 space-y-1">
                        <div className="rounded border-l-4 bg-muted/40 px-1.5 py-0.5" style={{ borderColor: MARK.orig.border }}><dt className="font-semibold">Vorher{c.img ? " (Alt-Text)" : ""}</dt><dd>„{cardText.orig || c.orig || "–"}“</dd></div>
                        <div className="rounded border-l-4 bg-muted/40 px-1.5 py-0.5" style={{ borderColor: MARK.draft.border }}><dt className="font-semibold">Nachher{c.img ? " (Alt-Text)" : ""}</dt><dd>„{cardText.draft || c.draft || "–"}“</dd></div>
                      </dl>
                    )}
                    {replacedBy(c, CHANGES, decisions) !== undefined && <p className="mb-1 rounded bg-muted px-1.5 py-1">Durch Vorschlag {replacedBy(c, CHANGES, decisions)} ersetzt – diese Fassung erscheint nicht in der Arbeitsfassung. Wird Vorschlag {replacedBy(c, CHANGES, decisions)} rückgängig gemacht, ist dieser Vorschlag wieder offen.</p>}
                    <p className="mb-2"><span className="font-semibold">Warum besser:</span> {c.why}</p>
                    {replacedBy(c, CHANGES, decisions) !== undefined ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Ersetzt durch Vorschlag {replacedBy(c, CHANGES, decisions)}</span> : <AcceptControl on={accepted.has(c.id)} kept={kept.has(c.id)} id={c.id} accept={acceptAndAdvance} undo={(id) => toggleAccepted(id, false)} keep={(id, v) => toggleKept(id, v)} />}
                  </div>
                );
              })()}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AcceptControl({ on, kept, id, accept, undo, keep }: { on: boolean; kept: boolean; id: number; accept: (id: number) => void; undo: (id: number) => void; keep: (id: number, v: boolean) => void }) {
  if (kept) return (
    <span className="flex items-center gap-1">
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Original beibehalten</span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => keep(id, false)}>Rückgängig</Button>
    </span>
  );
  if (!on) return (
    <span className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => accept(id)} aria-label={`Nur Änderung Ä${id} übernehmen`}>Nur Änderung Ä{id} übernehmen</Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => keep(id, true)}>Original beibehalten</Button>
    </span>
  );
  return on ? (
    <span className="flex items-center gap-1">
      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Übernommen</span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => undo(id)}>Rückgängig</Button>
    </span>
  ) : (
    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => accept(id)} aria-label={`Nur Änderung Ä${id} übernehmen`}>Nur Änderung Ä{id} übernehmen</Button>
  );
}

/** Three different "names" of the article, kept apart. Values come from the files / existing SEO notes. */
function NamingPanel() {
  const t = CHANGES.find((c) => c.headOnly?.kind === "title")?.headOnly;
  const h1 = CHANGES.find((c) => c.id === 3);
  const rows = [
    { what: "Dateiname / öffentliche Adresse", where: "Adresszeile, Links, Suchergebnis-URL", before: ROUTE, after: "/ratgeber/frequenztherapie (Vorschlag aus den SEO-Notizen)",
      why: "SEO/Lesbarkeit: Adresse benennt das Thema statt eines Messbarkeits-Versprechens. Rechtlicher Prüfbedarf (§ 3 HWG) möglich, keine abschließende Bewertung. Nicht umbenannt – Umstellung nur nach Freigabe, dann mit 301-Weiterleitung von der alten Adresse." },
    { what: "HTML-Seitentitel (Ä1)", where: "Browser-Tab, Suchergebnis – im Artikel nicht sichtbar", before: t?.before, after: t?.after, why: "SEO + rechtlicher Prüfbedarf: „Krankheit ist messbar“ als Aussage ist im Artikel nicht belegt; neuer Titel beschreibt den Inhalt." },
    { what: "Sichtbare H1 (Ä3)", where: "Erste Überschrift im Artikel", before: h1?.orig, after: h1?.draft, why: "Lesbarkeit + rechtlicher Prüfbedarf: „Grundlagen“ klingt nach Beweis; Vorschlag trennt Modell und Erfahrungsheilkunde." },
  ];
  return (
    <div className="mb-2 overflow-x-auto rounded-md border border-border bg-card p-2 text-xs">
      <table className="w-full border-collapse">
        <thead><tr className="text-left"><th className="p-1">Benennung</th><th className="p-1">Original</th><th className="p-1">Vorschlag</th><th className="p-1">Prüfgrund</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what} className="border-t border-border align-top">
              <td className="p-1"><span className="font-semibold">{r.what}</span><span className="block text-muted-foreground">{r.where}</span></td>
              <td className="p-1">„{r.before}“</td>
              <td className="p-1">„{r.after}“</td>
              <td className="p-1">{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
