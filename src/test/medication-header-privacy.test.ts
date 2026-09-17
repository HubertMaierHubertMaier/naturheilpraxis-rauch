import {describe,expect,it} from "vitest";
import {deidentifyClinicalText,directIdentifierCategories} from "../../supabase/functions/_shared/clinicalDeidentification";
import {checkedPdfPrivacyReplacements} from "../lib/pdfArchiveRedactionPlan";

describe("clinical medication column headers are not person names",()=>{
  it.each(["Name Dosierung tägl. pro Woche Grund","Name Dosierung tägl. pro Woche Grund seit","Name | Dosierung | täglich | pro Woche | Grund","Name Dosis Einheit Einnahme Grund"])("preserves the clinical header %s",header=>{
    const source=`Aktuelle Medikamente / Nahrungsergänzung\n${header}\nTestpräparat-Alpha 5 mg 1 Beispielgrund`;
    expect(deidentifyClinicalText(source)).toBe(source);
    expect(directIdentifierCategories(header)).not.toContain("Name");
    expect(checkedPdfPrivacyReplacements([{text:header,x:10,y:10,width:600,height:20}])).toEqual([]);
  });
  it("keeps a generic treatment reference without treating it as a clinician name",()=>{
    const source="In Behandlung bei\nallen Fachärzten";
    expect(deidentifyClinicalText(source)).toBe(source);
    expect(directIdentifierCategories(source)).toEqual([]);
  });
  it("still removes an actual labelled name next to a medication table",()=>{
    const source="Name: Erika Beispiel\nName Dosierung tägl. pro Woche Grund\nTestpräparat-Alpha 5 mg 1 Beispielgrund";
    const result=deidentifyClinicalText(source);
    expect(result).not.toContain("Erika Beispiel");
    expect(result).toContain("Name Dosierung tägl. pro Woche Grund");
    expect(result).toContain("Testpräparat-Alpha 5 mg");
  });
});
