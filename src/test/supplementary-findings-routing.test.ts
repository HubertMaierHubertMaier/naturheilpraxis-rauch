import { describe, expect, it } from "vitest";
import { buildAnamnesisIntake, formatIntakeFact } from "../lib/anamnesisIntakeFields";
import { formatAdditionalAnamnesis, normalizeAdditionalAnamnesis } from "../components/admin/therapy/AnamnesisAdditionalFields";
import { attachClinicalSourceEvidence } from "../../supabase/functions/_shared/clinicalSourceEvidence";
import { buildClinicallyRelevantLabHighlights } from "../../supabase/functions/_shared/labTrendAnalysis";
const beleg={quelle:"Labor Beispiel",datum:"2026-07-16",seite:"7",zitat:"Vitamin D3 empfohlen",pruefstatus:"quellenzitat_bestaetigt"};
describe("system-wide HRV and external laboratory advice",()=>{
  it("keeps a laboratory proposal separate even if a model contradictorily labels it current",()=>{
    const raw={medicationsTherapies:[{name:"Vitamin D3",kategorie:"vitamine",sourceRole:"lab_recommendation",status:"laufend",dosis:"1000 IE",vonWem:"Labor Beispiel",beleg}]};
    const before=JSON.stringify(raw), result=buildAnamnesisIntake([raw]);
    expect(result.medications).toEqual([]);expect(result.uncertainMedications).toEqual([]);
    expect(result.additional.labTherapyRecommendations[0].text).toContain("1000 IE");
    expect(formatIntakeFact(result.additional.labTherapyRecommendations[0])).toContain("Labor Beispiel");
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("does not turn device lists or general descriptions into actual medication",()=>{
    const result=buildAnamnesisIntake([{medicationsTherapies:["device_suggestion","general_information"].map(sourceRole=>({name:"Magnesium",kategorie:"mineralstoffe",status:"laufend",sourceRole,beleg}))}]);
    expect(result.medications).toEqual([]);expect(result.additional.externalTherapySuggestions).toHaveLength(1);
  });
  it("stores HRV measurements, source interpretation and additional interpretation separately",()=>{
    const result=buildAnamnesisIntake([{findings:["hrv_measurement","hrv_source_interpretation","hrv_clinical_interpretation"].map((findingType,index)=>({findingType,text:["RMSSD 24 ms","Berichtseinordnung","Zusätzliche Einordnung"][index],datum:"2026-06-25",beleg:{...beleg,quelle:"Vieva",zitat:"RMSSD 24 ms"}}))}]);
    const values=Object.fromEntries(Object.entries(result.additional).map(([key,rows])=>[key,rows.map(formatIntakeFact).join("\n")]));
    const restored=normalizeAdditionalAnamnesis(JSON.parse(JSON.stringify(values)));
    expect(restored).toEqual(values);expect(formatAdditionalAnamnesis(restored)).toContain("HRV – Deutung laut Quellbericht");
    expect(restored.hrvSummary).toContain("24 ms");expect(restored.hrvClinicalInterpretation).toContain("nicht Aussage der Quelle");
  });
  it("keeps unverified HRV out of automatically confirmed fields",()=>{
    const result=buildAnamnesisIntake([{findings:[{findingType:"hrv_measurement",text:"RMSSD 24 ms",beleg:{...beleg,pruefstatus:"quellenzitat_nicht_bestaetigt"}}]}]);
    expect(result.additional.hrvSummary).toBeUndefined();expect(result.negativeOrUncertainFindings).toHaveLength(1);
  });
  it("uses authoritative source labels to prevent a Vieva value becoming a blood-laboratory highlight",()=>{
    const item={parameter:"Magnesium",wert:"0,50",einheit:"mmol/l",bewertung:"↓",measurementMethod:"laboratory",beleg:{zitat:"Magnesium 0,50 mmol/l"}};
    const source=attachClinicalSourceEvidence({labValues:[item]},"Magnesium 0,50 mmol/l","Vieva Pro","1");
    expect(source.labValues[0].measurementMethod).toBe("vieva_estimate");
    expect(source.labValues[0].ungepruefteMessmethodenangabe).toBe("laboratory");
    expect(buildClinicallyRelevantLabHighlights(source.labValues,{})).toEqual([]);
    expect(source.labValues).toHaveLength(1);
  });
});
