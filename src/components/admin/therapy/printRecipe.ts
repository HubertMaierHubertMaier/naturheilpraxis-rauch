import type { ParsedTherapy } from "@/lib/therapyParser";

interface PrintArgs {
  parsed: ParsedTherapy;
  patient: {
    alter?: string;
    schwanger?: string;
    medikamente?: string;
    budget?: string;
    belastungen?: string;
    symptome?: string;
    erkrankung?: string;
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mdInline = (s: string) =>
  escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

export function openPrintRecipe({ parsed, patient }: PrintArgs) {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const patientLine = [
    patient.alter ? `Alter: ${escapeHtml(patient.alter)} Jahre` : null,
    patient.schwanger && patient.schwanger !== "nein" ? `Status: ${escapeHtml(patient.schwanger)}` : null,
    patient.medikamente ? `Medikation: ${escapeHtml(patient.medikamente)}` : null,
    patient.budget ? `Budget: ${escapeHtml(patient.budget)} €` : null,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const indication = [patient.belastungen, patient.symptome, patient.erkrankung]
    .filter((x) => x && x.trim())
    .map((x) => escapeHtml(x!))
    .join(" / ");

  const introHtml = parsed.intro
    .filter((s) => s.variant === "warning" || s.variant === "danger")
    .map(
      (s) => `<div class="alert alert-${s.variant}"><strong>${s.emoji} ${escapeHtml(s.title)}</strong><div>${mdInline(s.content).replace(/\n/g, "<br/>")}</div></div>`
    )
    .join("");

  const categoriesHtml = parsed.categories
    .map((g) => {
      const rows = g.remedies
        .map(
          (r) => `
          <tr>
            <td class="name"><strong>${escapeHtml(r.name)}</strong>${r.latin ? `<div class="latin">${escapeHtml(r.latin)}</div>` : ""}</td>
            <td class="mono">${escapeHtml(r.dosage)}</td>
            <td>${escapeHtml(r.application)}</td>
            <td>${escapeHtml(r.duration)}</td>
            <td class="prio">${escapeHtml(r.priorityRaw)}</td>
          </tr>
          ${r.reason ? `<tr class="reason-row"><td colspan="5" class="reason">${escapeHtml(r.reason)}</td></tr>` : ""}`
        )
        .join("");
      return `
        <section class="cat">
          <h2>${g.emoji} ${escapeHtml(g.title)}</h2>
          <table>
            <thead><tr><th>Mittel</th><th>Dosierung</th><th>Anwendung</th><th>Dauer</th><th>Priorität</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    })
    .join("");

  const outroHtml = parsed.outro
    .map(
      (s) => `<section class="outro"><h3>${s.emoji} ${escapeHtml(s.title)}</h3><div class="outro-content">${mdInline(s.content).replace(/\n/g, "<br/>")}</div></section>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Therapie-Empfehlung</title>
<style>
  @page { size: A4; margin: 1.8cm 1.5cm 2cm 1.5cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.45; font-size: 10.5pt; margin: 0; }
  h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #6b8e6b; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 20pt; color: #4a6e4a; }
  .header .practice { text-align: right; font-size: 9pt; color: #555; line-height: 1.35; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 9.5pt; color: #444; margin-bottom: 12px; }
  .meta .label { color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8pt; }
  .indication { background: #f5f1e8; padding: 8px 12px; border-left: 3px solid #c47a5a; margin-bottom: 16px; font-size: 10pt; }
  .alert { padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-size: 9.5pt; }
  .alert-warning { background: #fef3c7; border-left: 3px solid #d97706; }
  .alert-danger { background: #fee2e2; border-left: 3px solid #dc2626; }
  .cat { margin-bottom: 16px; page-break-inside: avoid; }
  .cat h2 { font-size: 12pt; color: #4a6e4a; padding: 6px 10px; background: #eef2ed; border-radius: 3px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  thead th { text-align: left; padding: 5px 8px; background: #f9f7f2; border-bottom: 1.5px solid #c8b89e; font-weight: 600; color: #5a4a35; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
  tbody td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #ececec; }
  td.name { width: 26%; }
  td.name strong { font-size: 11pt; color: #2c4a2c; font-family: 'Playfair Display', Georgia, serif; }
  .latin { font-style: italic; color: #888; font-size: 8.5pt; margin-top: 1px; }
  td.mono { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 9pt; }
  td.prio { font-size: 8.5pt; white-space: nowrap; }
  tr.reason-row td.reason { color: #666; font-size: 8.5pt; padding-top: 0; padding-bottom: 8px; padding-left: 14px; border-bottom: 1px solid #ececec; font-style: italic; }
  .outro { margin-top: 14px; page-break-inside: avoid; font-size: 9.5pt; }
  .outro h3 { font-size: 11pt; color: #5a4a35; margin-bottom: 4px; border-bottom: 1px solid #e5d9c0; padding-bottom: 2px; }
  .outro-content { padding-left: 4px; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8.5pt; color: #777; }
  .sig { margin-top: 36px; display: flex; justify-content: flex-end; }
  .sig .line { border-top: 1px solid #333; padding-top: 4px; width: 220px; text-align: center; font-size: 8.5pt; color: #555; }
  @media print { .no-print { display: none; } body { font-size: 10pt; } }
</style></head>
<body>
  <div class="header">
    <h1>Therapie-Empfehlung</h1>
    <div class="practice">
      <strong>Naturheilpraxis Peter Rauch</strong><br/>
      Heilpraktiker<br/>
      www.rauch-heilpraktiker.de
    </div>
  </div>

  <div class="meta">
    <div><span class="label">Datum</span><br/>${today}</div>
    <div><span class="label">Patientenkontext</span><br/>${patientLine || "—"}</div>
  </div>

  ${indication ? `<div class="indication"><strong>Indikation:</strong> ${indication}</div>` : ""}

  ${introHtml}
  ${categoriesHtml}
  ${outroHtml}

  <div class="sig"><div class="line">Unterschrift Therapeut</div></div>
  <div class="footer">
    <span>Naturheilpraxis Peter Rauch · Erstellt mit KI-Unterstützung auf Basis der internen Wissensdatenbank</span>
    <span>Seite <span class="page"></span></span>
  </div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
