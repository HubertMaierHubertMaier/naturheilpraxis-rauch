import type { ParsedTherapy, CategoryGroup, RemedyRow } from "@/lib/therapyParser";

export interface DiagnoseEntry {
  icd10?: string;
  diagnose: string;
  begruendung?: string;
}

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
    pseudonymId?: string;
    notiz?: string;
  };
  /** "patient" = klean, ohne Warnungen/Begründungen | "praxis" = vollständig mit Diagnosen, Warnungen, Begründungen */
  mode?: "patient" | "praxis";
  /** Set aus "categoryIndex|remedyIndex" – ausgewählte Mittel. Wenn undefined → alle. */
  selectedKeys?: Set<string>;
  /** Schulmedizinische Verdachtsdiagnosen – nur für Praxis-PDF */
  diagnosen?: DiagnoseEntry[];
  /** Manuell ergänzte Mittel – erscheinen in beiden PDFs als eigene Sektion */
  manualMittel?: Array<{ name: string; dosage: string; application: string; duration: string; reason: string; group?: string }>;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mdInline = (s: string) =>
  escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

function filterCategoriesBySelection(
  categories: CategoryGroup[],
  selectedKeys?: Set<string>,
): { selected: CategoryGroup[]; unselected: CategoryGroup[] } {
  if (!selectedKeys) return { selected: categories, unselected: [] };
  const selected: CategoryGroup[] = [];
  const unselected: CategoryGroup[] = [];
  categories.forEach((g, ci) => {
    const sel: RemedyRow[] = [];
    const unsel: RemedyRow[] = [];
    g.remedies.forEach((r, ri) => {
      if (selectedKeys.has(`${ci}|${ri}`)) sel.push(r);
      else unsel.push(r);
    });
    if (sel.length) selected.push({ ...g, remedies: sel });
    if (unsel.length) unselected.push({ ...g, remedies: unsel });
  });
  return { selected, unselected };
}

export function openPrintRecipe({ parsed, patient, mode = "patient", selectedKeys, diagnosen, manualMittel }: PrintArgs) {
  const isPraxis = mode === "praxis";
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const { selected, unselected } = filterCategoriesBySelection(parsed.categories, selectedKeys);

  const patientLine = [
    isPraxis && patient.pseudonymId ? `Pseudonym: <strong>${escapeHtml(patient.pseudonymId)}</strong>` : null,
    patient.alter ? `Alter: ${escapeHtml(patient.alter)} J.` : null,
    patient.schwanger && patient.schwanger !== "nein" ? `Status: ${escapeHtml(patient.schwanger)}` : null,
    patient.medikamente && isPraxis ? `Medikation: ${escapeHtml(patient.medikamente)}` : null,
    patient.budget && isPraxis ? `Budget: ${escapeHtml(patient.budget)} €` : null,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const indication = [patient.belastungen, patient.symptome, patient.erkrankung]
    .filter((x) => x && x.trim())
    .map((x) => escapeHtml(x!))
    .join(" / ");

  // Praxis: alle Intro-Sektionen (Warnungen, Sicherheit, Analyse, Lücken)
  // Patient: KEINE Intro-Sektionen außer evtl. neutrale Info – wir lassen sie ganz weg
  const introHtml = isPraxis
    ? parsed.intro
        .map((s) => {
          const cls = s.variant === "danger" ? "alert-danger" : s.variant === "warning" ? "alert-warning" : "alert-info";
          return `<div class="alert ${cls}"><strong>${s.emoji} ${escapeHtml(s.title)}</strong><div>${mdInline(s.content).replace(/\n/g, "<br/>")}</div></div>`;
        })
        .join("")
    : "";

  // Diagnosen (nur Praxis)
  const diagnoseHtml = (isPraxis && diagnosen && diagnosen.length)
    ? `<section class="diagnose-block">
        <h2>🩺 Schulmedizinische Verdachtsdiagnosen <span class="muted-small">(KI-generiert, ICD-10-orientiert – Arbeitshypothesen)</span></h2>
        <table class="diagnose-table">
          <thead><tr><th style="width:90px;">ICD-10</th><th>Diagnose</th><th>Begründung</th></tr></thead>
          <tbody>
            ${diagnosen.map((d) => `
              <tr>
                <td class="mono">${escapeHtml(d.icd10 || "—")}</td>
                <td><strong>${escapeHtml(d.diagnose)}</strong></td>
                <td class="reason-cell">${escapeHtml(d.begruendung || "")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`
    : "";

  const renderCategory = (g: CategoryGroup, opts: { showReason: boolean; showPrio: boolean }) => {
    const rows = g.remedies
      .map((r) => `
        <tr>
          <td class="name"><strong>${escapeHtml(r.name)}</strong>${r.latin ? `<div class="latin">${escapeHtml(r.latin)}</div>` : ""}</td>
          <td class="mono">${escapeHtml(r.dosage)}</td>
          <td>${escapeHtml(r.application)}</td>
          <td>${escapeHtml(r.duration)}</td>
          ${opts.showPrio ? `<td class="prio">${escapeHtml(r.priorityRaw)}</td>` : ""}
        </tr>
        ${opts.showReason && r.reason ? `<tr class="reason-row"><td colspan="${opts.showPrio ? 5 : 4}" class="reason">${escapeHtml(r.reason)}</td></tr>` : ""}`)
      .join("");
    return `
      <section class="cat">
        <h2>${g.emoji} ${escapeHtml(g.title)}</h2>
        <table>
          <thead><tr><th>Mittel</th><th>Dosierung</th><th>Anwendung</th><th>Dauer</th>${opts.showPrio ? "<th>Priorität</th>" : ""}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  };

  const selectedHtml = selected.map((g) => renderCategory(g, { showReason: isPraxis, showPrio: isPraxis })).join("");

  const manualMittelHtml = (manualMittel && manualMittel.length)
    ? `<section class="cat">
        <h2>✍️ Manuell ergänzte Mittel <span class="muted-small">(vom Therapeuten ergänzt, nicht aus KI/Wiki)</span></h2>
        <table>
          <thead><tr><th>Mittel</th><th>Dosierung</th><th>Anwendung</th><th>Dauer</th>${isPraxis ? "<th>Begründung</th>" : ""}</tr></thead>
          <tbody>
            ${manualMittel.map((m) => `
              <tr>
                <td class="name"><strong>${escapeHtml(m.name)}</strong></td>
                <td class="mono">${escapeHtml(m.dosage || "—")}</td>
                <td>${escapeHtml(m.application || "—")}</td>
                <td>${escapeHtml(m.duration || "—")}</td>
                ${isPraxis ? `<td class="reason-cell">${escapeHtml(m.reason || "")}</td>` : ""}
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`
    : "";

  const reserveHtml = (isPraxis && unselected.length)
    ? `<section class="reserve">
        <h2>📦 Reserve & Alternativen <span class="muted-small">(nicht für Patienten ausgewählt)</span></h2>
        ${unselected.map((g) => renderCategory(g, { showReason: true, showPrio: true })).join("")}
      </section>`
    : "";

  // Outro: Patient bekommt nur "neutrale" Outros (Begleitmaßnahmen, Therapieprotokoll, Kosten).
  // Ausgeschlossene Mittel (variant: danger) und Wissensdatenbank-Lücken (warning) NUR Praxis.
  const outroSections = isPraxis
    ? parsed.outro
    : parsed.outro.filter((s) => s.variant !== "danger" && s.variant !== "warning");

  const outroHtml = outroSections
    .map((s) => `<section class="outro"><h3>${s.emoji} ${escapeHtml(s.title)}</h3><div class="outro-content">${mdInline(s.content).replace(/\n/g, "<br/>")}</div></section>`)
    .join("");

  const notizHtml = (isPraxis && patient.notiz?.trim())
    ? `<section class="notiz"><h3>📝 Notiz Therapeut</h3><div>${escapeHtml(patient.notiz).replace(/\n/g, "<br/>")}</div></section>`
    : "";

  const docTitle = isPraxis ? "Therapie-Empfehlung – Praxis-Akte" : "Therapie-Empfehlung";
  const headerSubtitle = isPraxis
    ? `<div class="header-subtitle praxis-tag">⚕ Interne Praxis-Akte – nicht für Patient bestimmt</div>`
    : "";

  // NLS-Hinweis: erscheint, sobald Pathogene/Belastungen eingegeben wurden.
  // Patient bekommt ausführlichen Aufklärungsblock, Praxis-PDF nur eine kurze Fußnote.
  const hasNlsBefund = !!patient.belastungen?.trim();
  const nlsNoticePatient = (!isPraxis && hasNlsBefund)
    ? `<div class="nls-notice">
        <div class="nls-notice-title">ℹ Hinweis zur Befunderhebung</div>
        <p>Die in dieser Empfehlung genannten Belastungen (Erreger, Toxine, Organbezüge) wurden mittels <strong>bioenergetischer Resonanz-Analyse</strong> ermittelt (Metapathia / Hospital, Nonlinear Diagnostic System – NLS). Es handelt sich dabei <strong>nicht um einen labormedizinischen Befund</strong> (Blut, Stuhl, Abstrich) und nicht um eine schulmedizinische Diagnose, sondern um Hinweise aus einem energetischen Messverfahren der Komplementärmedizin.</p>
        <p>Diese Methode ist wissenschaftlich umstritten, wird in meiner Praxis jedoch seit vielen Jahren mit guten Erfahrungen eingesetzt, um individuelle Therapieansätze zu entwickeln. Bei Verdacht auf eine konkrete Erkrankung empfehle ich ergänzend eine weiterführende Abklärung beim Heilpraktiker oder Arzt Ihres Vertrauens (z. B. Labor, bildgebende Verfahren).</p>
      </div>`
    : "";
  const nlsNoticePraxis = (isPraxis && hasNlsBefund)
    ? `<div class="nls-notice-praxis">⚕ Befundgrundlage: NLS / Metapathia (bioenergetische Resonanz-Analyse) – kein laborbasierter Befund.</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title>
<style>
  @page { size: A4; margin: 1.8cm 1.5cm 2cm 1.5cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.45; font-size: 10.5pt; margin: 0; }
  h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #6b8e6b; padding-bottom: 10px; margin-bottom: 6px; }
  .header h1 { font-size: 20pt; color: #4a6e4a; }
  .header .practice { text-align: right; font-size: 9pt; color: #555; line-height: 1.35; }
  .header-subtitle { font-size: 8.5pt; padding: 4px 8px; margin-bottom: 12px; border-radius: 3px; }
  .praxis-tag { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; display: inline-block; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 9.5pt; color: #444; margin-bottom: 12px; }
  .meta .label { color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8pt; }
  .indication { background: #f5f1e8; padding: 8px 12px; border-left: 3px solid #c47a5a; margin-bottom: 16px; font-size: 10pt; }
  .nls-notice { background: #f0f4ee; border: 1px solid #c8d6c0; border-left: 4px solid #6b8e6b; padding: 10px 14px; margin-bottom: 16px; font-size: 9.5pt; line-height: 1.5; page-break-inside: avoid; border-radius: 3px; }
  .nls-notice-title { font-weight: 600; color: #4a6e4a; margin-bottom: 4px; font-size: 10pt; }
  .nls-notice p { margin: 4px 0; color: #3d4a3d; }
  .nls-notice-praxis { background: #fef9ed; border-left: 3px solid #c8a456; padding: 4px 10px; margin-bottom: 12px; font-size: 8.5pt; color: #6b5a2c; font-style: italic; }
  .alert { padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-size: 9.5pt; page-break-inside: avoid; }
  .alert-info { background: #eff6ff; border-left: 3px solid #2563eb; }
  .alert-warning { background: #fef3c7; border-left: 3px solid #d97706; }
  .alert-danger { background: #fee2e2; border-left: 3px solid #dc2626; }
  .diagnose-block { margin: 14px 0; page-break-inside: avoid; }
  .diagnose-block h2 { font-size: 13pt; color: #4a6e4a; margin-bottom: 6px; }
  .diagnose-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .diagnose-table thead th { background: #eef2ed; padding: 5px 8px; text-align: left; border-bottom: 1.5px solid #6b8e6b; }
  .diagnose-table tbody td { padding: 6px 8px; border-bottom: 1px solid #ececec; vertical-align: top; }
  .reason-cell { color: #555; font-size: 9pt; }
  .muted-small { font-size: 8.5pt; color: #888; font-weight: normal; font-family: 'Source Sans 3', sans-serif; }
  .cat { margin-bottom: 16px; page-break-inside: avoid; }
  .cat h2 { font-size: 12pt; color: #4a6e4a; padding: 6px 10px; background: #eef2ed; border-radius: 3px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  thead th { text-align: left; padding: 5px 8px; background: #f9f7f2; border-bottom: 1.5px solid #c8b89e; font-weight: 600; color: #5a4a35; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
  tbody td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #ececec; }
  td.name { width: 26%; }
  td.name strong { font-size: 11pt; color: #2c4a2c; font-family: 'Playfair Display', Georgia, serif; }
  .latin { font-style: italic; color: #888; font-size: 8.5pt; margin-top: 1px; }
  td.mono, .mono { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 9pt; }
  td.prio { font-size: 8.5pt; white-space: nowrap; }
  tr.reason-row td.reason { color: #666; font-size: 8.5pt; padding-top: 0; padding-bottom: 8px; padding-left: 14px; border-bottom: 1px solid #ececec; font-style: italic; }
  .reserve { margin-top: 18px; padding-top: 10px; border-top: 1px dashed #c8b89e; }
  .reserve > h2 { font-size: 13pt; color: #8a6f3a; margin-bottom: 8px; }
  .outro { margin-top: 14px; page-break-inside: avoid; font-size: 9.5pt; }
  .outro h3 { font-size: 11pt; color: #5a4a35; margin-bottom: 4px; border-bottom: 1px solid #e5d9c0; padding-bottom: 2px; }
  .outro-content { padding-left: 4px; }
  .notiz { margin-top: 14px; padding: 10px 12px; background: #f9f7f2; border-left: 3px solid #6b8e6b; font-size: 9.5pt; page-break-inside: avoid; }
  .notiz h3 { font-size: 11pt; margin-bottom: 4px; color: #4a6e4a; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8.5pt; color: #777; }
  .sig { margin-top: 36px; display: flex; justify-content: flex-end; }
  .sig .line { border-top: 1px solid #333; padding-top: 4px; width: 220px; text-align: center; font-size: 8.5pt; color: #555; }
  @media print { .no-print { display: none; } body { font-size: 10pt; } }
</style></head>
<body>
  <div class="header">
    <h1>${escapeHtml(isPraxis ? "Therapie-Empfehlung (Praxis)" : "Therapie-Empfehlung")}</h1>
    <div class="practice">
      <strong>Naturheilpraxis Peter Rauch</strong><br/>
      Heilpraktiker · Friedrich-Deffner-Str. 19a, 86163 Augsburg<br/>
      Tel. 0821-2621462 · www.rauch-heilpraktiker.de
    </div>
  </div>
  ${headerSubtitle}

  <div class="meta">
    <div><span class="label">Datum</span><br/>${today}</div>
    <div style="text-align:right;"><span class="label">${isPraxis ? "Patientenkontext" : "Patient"}</span><br/>${patientLine || "—"}</div>
  </div>

  ${indication ? `<div class="indication"><strong>Indikation:</strong> ${indication}</div>` : ""}

  ${diagnoseHtml}
  ${introHtml}
  ${selectedHtml || `<p style="color:#888;font-style:italic;">Keine Mittel ausgewählt.</p>`}
  ${manualMittelHtml}
  ${reserveHtml}
  ${outroHtml}
  ${notizHtml}

  <div class="sig"><div class="line">${isPraxis ? "Unterschrift Therapeut" : "Datum / Unterschrift"}</div></div>
  <div class="footer">
    <span>Naturheilpraxis Peter Rauch · ${isPraxis ? "Interne Akte – KI-unterstützt" : "Empfehlung – bitte vor Einnahme bei Unklarheiten Rückfrage"}</span>
    <span>Seite <span class="page"></span></span>
  </div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
