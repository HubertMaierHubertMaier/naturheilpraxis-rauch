import { Textarea } from "@/components/ui/textarea";
type Props={values:Record<string,string>;onChange:(values:Record<string,string>)=>void;disabled:boolean;section:"hrv"|"laboratory-advice"};
export function SupplementaryFindingsFields({values,onChange,disabled,section}:Props){
  const fields=section==="hrv"?[
    ["hrvSummary","Messwerte und Zusammenfassung","Dokumentierte HRV-Werte mit Messdatum, Einheit, Messbedingungen und Quelle"],
    ["hrvSourceInterpretation","Deutung laut Quellbericht","Nur die im Bericht enthaltene Deutung; Quelle und Datum erhalten"],
    ["hrvClinicalInterpretation","Zusätzliche fachliche Einordnung","Begründete Einordnung der dokumentierten Werte; fehlende Messbedingungen und Unsicherheiten benennen"],
  ]:[
    ["labTherapyRecommendations","Therapieempfehlung des Labors","Externer Vorschlag mit Labor als Urheber, Datum, Quelle, Mittel, dokumentierter Dosis und Anwendung"],
  ];
  return <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3" aria-label={section==="hrv"?"HRV – Zusammenfassung und Deutung":"Therapieempfehlung des Labors"}>
    <h3 className="font-semibold">{section==="hrv"?"HRV – Zusammenfassung und Deutung":"Therapieempfehlung des Labors – gesonderter Quellenvorschlag"}</h3>
    <p className="text-xs text-muted-foreground">{section==="hrv"?"HRV bleibt als eigene Messung erkennbar. Quelleninterpretation und zusätzliche Einordnung werden getrennt gespeichert. Fehlende Werte werden nicht ergänzt.":"Zum Beispiel Biodiagnostik: Dieser Vorschlag bleibt dem Labor zugeordnet. Er ist keine bestätigte aktuelle Einnahme und keine ungekennzeichnete eigene Empfehlung."}</p>
    {fields.map(([key,label,placeholder])=><div key={key} className="space-y-1"><label className="text-sm font-medium" htmlFor={`supplementary-${key}`}>{label}</label><Textarea id={`supplementary-${key}`} value={values[key]||""} disabled={disabled} onChange={event=>onChange({...values,[key]:event.target.value})} placeholder={placeholder} className="min-h-[100px] bg-background"/></div>)}
  </section>;
}
