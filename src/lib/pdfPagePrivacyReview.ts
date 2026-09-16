export type PdfPagePrivacyReviewRequest={image:Blob;page:number;totalPages:number;reason:string};
type Reviewer=(request:PdfPagePrivacyReviewRequest)=>Promise<boolean>;
let reviewer:Reviewer|undefined;
let queue:Promise<unknown>=Promise.resolve();

export function registerPdfPageReviewer(handler:Reviewer){
  if(reviewer)throw new Error("Eine PDF-Prüfansicht ist bereits registriert.");
  reviewer=handler;
  return ()=>{if(reviewer===handler)reviewer=undefined;};
}

export function requestPdfPagePrivacyReview(request:PdfPagePrivacyReviewRequest,isCurrent:()=>boolean=()=>true):Promise<void>{
  const currentReviewer=reviewer;
  const run=queue.catch(()=>{}).then(async()=>{
    if(!isCurrent()||!currentReviewer||reviewer!==currentReviewer)throw new Error("Lokale PDF-Sichtprüfung erforderlich; keine Übertragung.");
    // A confirmation is scoped to this exact request. Reusing a matching page image
    // would silently bypass the required visible review for another document.
    const approved=await currentReviewer(request);
    if(!approved||!isCurrent()||reviewer!==currentReviewer)throw new Error("PDF-Seite nicht freigegeben; Original bleibt lokal.");
  });
  queue=run;
  return run;
}
