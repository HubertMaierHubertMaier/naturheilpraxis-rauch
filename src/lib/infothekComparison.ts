import type { ComparisonChange } from "@/lib/infothekComparisonChanges";

export type Side = "orig" | "draft";
const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,blockquote";

/** Finds the real element holding a change snippet (deepest text element, or <img> by alt). */
export function findChangeTarget(doc: Document, change: ComparisonChange, side: Side): Element | undefined {
  const snippet = side === "orig" ? change.orig : change.draft;
  if (!snippet) return undefined;
  const nth = (side === "orig" ? change.origNth : change.draftNth) ?? 0;
  if (change.img) return Array.from(doc.images).filter((img) => img.alt.includes(snippet))[nth];
  const hits = Array.from(doc.body.querySelectorAll(TEXT_TAGS)).filter((el) => el.textContent?.includes(snippet));
  return hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)))[nth];
}

const group = (el: Element, c: ComparisonChange) =>
  [c.withPrev ? el.previousElementSibling : null, el, c.withNext ? el.nextElementSibling : null].filter(Boolean) as Element[];

/**
 * Working version = original HTML with only the accepted proposals swapped in.
 * Not accepted changes keep the original wording. Returns ids that could not be applied.
 */
export function composeWorkingVersion(
  originalHtml: string,
  draftHtml: string,
  changes: ComparisonChange[],
  accepted: Set<number>,
): { html: string; failed: number[] } {
  const parser = new DOMParser();
  const o = parser.parseFromString(originalHtml, "text/html");
  const d = parser.parseFromString(draftHtml, "text/html");
  const failed: number[] = [];

  for (const c of changes) {
    if (!accepted.has(c.id)) continue;
    if (c.headOnly?.kind === "title") {
      o.title = d.title;
      continue;
    }
    if (c.headOnly?.kind === "description") {
      const src = d.querySelector('meta[name="description"]');
      const dst = o.querySelector('meta[name="description"]');
      if (!src || !dst) { failed.push(c.id); continue; }
      dst.setAttribute("content", src.getAttribute("content") ?? "");
      d.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((m) => {
        const key = m.getAttribute("property") ? `meta[property="${m.getAttribute("property")}"]` : `meta[name="${m.getAttribute("name")}"]`;
        if (!o.querySelector(key)) o.head.appendChild(o.importNode(m, true));
      });
      continue;
    }
    const to = findChangeTarget(o, c, "orig");
    let td = findChangeTarget(d, c, "draft");
    if (!to || !td) { failed.push(c.id); continue; }
    if (c.draftWrap) td = td.closest(c.draftWrap) ?? td;
    if (c.insertAfter) {
      const anchor = c.insertAfter === "parentNext" ? to.parentElement?.nextElementSibling : to;
      if (!anchor) { failed.push(c.id); continue; }
      anchor.after(o.importNode(td, true));
      continue;
    }
    const origEls = group(to, c);
    const draftEls = group(td, c).map((el) => o.importNode(el, true));
    origEls[0].replaceWith(...draftEls);
    origEls.slice(1).forEach((el) => el.remove());
  }

  o.documentElement.insertBefore(
    o.createComment(` ARBEITSFASSUNG – Original mit ${accepted.size} übernommenen Vorschlägen. Nicht veröffentlicht, keine Inhalts- oder Rechtsfreigabe. `),
    o.head,
  );
  return { html: `<!DOCTYPE html>\n${o.documentElement.outerHTML}`, failed };
}
