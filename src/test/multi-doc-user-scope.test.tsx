import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MultiDocUpload } from "@/components/admin/therapy/MultiDocUpload";

const session=vi.hoisted(()=>({user:{id:"synthetic-user-a"} as {id:string}|null}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:session.user})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
vi.mock("pdfjs-dist",()=>({GlobalWorkerOptions:{},OPS:{}}));
vi.mock("@/lib/anonymizedPdfArchive",()=>({
  prepareAnonymizedPdfArchive:vi.fn(),rememberValidatedPdfPassword:vi.fn(),openPdfArchiveCopy:vi.fn(),setPdfArchiveCopyReviewed:vi.fn(),
}));
vi.mock("@/components/admin/therapy/RedactedTextPreview",()=>({RedactedTextPreview:({text}:{text:string})=><pre data-testid="preview">{text}</pre>}));
const pid="P-2099-0011";
const key=(userId:string)=>`therapy.pendingPrivacyReview.v2:${JSON.stringify([userId,pid,"Befund"])}`;
const cached=(userId:string,text:string)=>JSON.stringify({
  sourceUserId:userId,sourcePseudonymId:pid,text,documentCount:1,totalPages:1,totalChars:text.length,
  anamneseMappedAnswers:0,anamneseManualReviewItems:0,anamneseLowConfidencePages:[],identifierCategories:[],
});
afterEach(()=>{cleanup();sessionStorage.clear();session.user={id:"synthetic-user-a"};});

describe("individual document review user separation",()=>{
  it("restores only the signed-in user's preview and resets it when the user changes",()=>{
    sessionStorage.setItem(key("synthetic-user-a"),cached("synthetic-user-a","LDL 130 mg/dl"));
    sessionStorage.setItem(key("synthetic-user-b"),cached("synthetic-user-b","CRP 2 mg/l"));
    const onExtracted=vi.fn();
    const view=render(<MultiDocUpload pseudonymId={pid} onExtracted={onExtracted}/>);
    expect(screen.getByTestId("preview")).toHaveTextContent("LDL 130 mg/dl");
    session.user={id:"synthetic-user-b"};
    view.rerender(<MultiDocUpload pseudonymId={pid} onExtracted={onExtracted}/>);
    expect(screen.getByTestId("preview")).toHaveTextContent("CRP 2 mg/l");
    expect(screen.queryByText("LDL 130 mg/dl")).toBeNull();
    expect(sessionStorage.getItem(key("synthetic-user-a"))).toContain("LDL 130 mg/dl");
    expect(screen.getByRole("button",{name:"Bereinigten Text übernehmen"})).toBeDisabled();
    session.user=null;
    view.rerender(<MultiDocUpload pseudonymId={pid} onExtracted={onExtracted}/>);
    expect(screen.queryByTestId("preview")).toBeNull();
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it("does not restore a mismatched owner or an old unowned review",()=>{
    sessionStorage.setItem(key("synthetic-user-a"),cached("synthetic-user-b","CRP 2 mg/l"));
    const legacyKey=`therapy.pendingPrivacyReview.v1:${pid}:Befund`;
    const legacy=cached("synthetic-user-a","LDL 130 mg/dl");
    sessionStorage.setItem(legacyKey,legacy);
    render(<MultiDocUpload pseudonymId={pid} onExtracted={vi.fn()}/>);
    expect(screen.queryByTestId("preview")).toBeNull();
    expect(sessionStorage.getItem(legacyKey)).toBe(legacy);
  });
});
