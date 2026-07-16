import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "article", "section", "header", "footer", "main", "div", "span", "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "small",
  "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr",
  "th", "td", "caption", "blockquote", "code", "pre", "details", "summary",
];

const ALLOWED_ATTR = ["colspan", "rowspan", "scope", "lang", "dir", "aria-label"];

const REPORT_STYLES = `
  :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #fff; }
  body { margin: 0 auto; max-width: 1100px; padding: 24px; line-height: 1.55; }
  h1, h2, h3, h4 { color: #315f46; line-height: 1.25; margin: 1.2em 0 .45em; }
  h1 { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #d1d5db; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #eef6f0; }
  blockquote { margin: 12px 0; padding: 8px 14px; border-left: 4px solid #8fb69c; background: #f8faf8; }
  pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
  @media print { body { max-width: none; padding: 0; } }
`;

const extractBodyContent = (value: string) => {
  const match = value.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  return match?.[1] ?? value;
};

export function sanitizeClinicalReportFragment(value: string): string {
  return DOMPurify.sanitize(extractBodyContent(String(value || "")), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "base", "link", "svg", "math", "img", "video", "audio", "canvas"],
    FORBID_ATTR: ["style", "src", "href", "srcset", "formaction", "xlink:href"],
    KEEP_CONTENT: true,
  });
}

export function sanitizeClinicalReportHtml(value: string): string {
  const content = sanitizeClinicalReportFragment(value);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Befund-Auswertung</title><style>${REPORT_STYLES}</style></head><body>${content}</body></html>`;
}

export function openClinicalReportWindow(value: string, title: string, print = false): Window | null {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return null;
  reportWindow.opener = null;
  reportWindow.document.open();
  reportWindow.document.write(sanitizeClinicalReportHtml(value));
  reportWindow.document.close();
  reportWindow.document.title = title;
  if (print) {
    reportWindow.addEventListener("load", () => window.setTimeout(() => reportWindow.print(), 300), { once: true });
  }
  return reportWindow;
}

export function downloadClinicalReportHtml(value: string, filename: string): void {
  const blob = new Blob([sanitizeClinicalReportHtml(value)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
