import {validateManualPdfPageSize,validateManualPdfRedactions,type ManualPdfRedaction} from "./manualPdfRedaction";
export type PdfPagePrivacyReviewRequest={image:Blob;page:number;totalPages:number;reason:string;manualRedaction?:{width:number;height:number}};
export type PdfPagePrivacyReviewDecision=boolean|{approved:boolean;redactions:ManualPdfRedaction[];unchangedPageConfirmed?:boolean};
type Reviewer=(request:PdfPagePrivacyReviewRequest)=>Promise<PdfPagePrivacyReviewDecision>;
let reviewer:Reviewer|undefined;
let queue:Promise<unknown>=Promise.resolve();

export function registerPdfPageReviewer(handler:Reviewer){
  if(reviewer)throw new Error("Eine PDF-Prüfansicht ist bereits registriert.");
  reviewer=handler;
  return ()=>{if(reviewer===handler)reviewer=undefined;};
}

export function requestPdfPagePrivacyReview(request:PdfPagePrivacyReviewRequest,isCurrent:()=>boolean=()=>true):Promise<ManualPdfRedaction[]|undefined>{
  const currentReviewer=reviewer;
  const run=queue.catch(()=>{}).then(async()=>{
    if(!isCurrent()||!currentReviewer||reviewer!==currentReviewer)throw new Error("Lokale PDF-Sichtprüfung erforderlich; keine Übertragung.");
    // A confirmation is scoped to this exact request. Reusing a matching page image
    // would silently bypass the required visible review for another document.
    const decision=await currentReviewer(request);
    const approved=typeof decision==="boolean"?decision:decision?.approved===true;
    if(!approved||!isCurrent()||reviewer!==currentReviewer)throw new Error("PDF-Seite nicht freigegeben; Original bleibt lokal.");
    if(request.manualRedaction){
      if(typeof decision==="boolean")throw new Error("Lokale PDF-Schwärzung fehlt; keine Übertragung.");
      if(Array.isArray(decision.redactions)&&decision.redactions.length===0&&decision.unchangedPageConfirmed===true){
        validateManualPdfPageSize(request.manualRedaction.width,request.manualRedaction.height);
        return [];
      }
      return validateManualPdfRedactions(decision.redactions,request.manualRedaction.width,request.manualRedaction.height);
    }
    return undefined;
  });
  queue=run;
  return run;
}
