import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {PdfArchiveReviewDialog} from "@/components/admin/therapy/PdfArchiveReviewDialog";
import {requestPdfPagePrivacyReview} from "@/lib/pdfPagePrivacyReview";
import {savePdfRedactionDraft,type PdfRedactionDraftKey} from "@/lib/pdfRedactionDraft";

const key:PdfRedactionDraftKey={scope:JSON.stringify(["synthetic-user","synthetic-case"]),sourceHash:"a".repeat(64),imageHash:"b".repeat(64),page:1,width:100,height:100};
const masks=[{x:10,y:10,width:20,height:10}];
const request={image:new Blob(["synthetic"]),page:1,totalPages:1,reason:"synthetic overlap",manualRedaction:{width:100,height:100,draftKey:key}};
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal("URL",class extends URL{static createObjectURL(){return "blob:synthetic-review";}static revokeObjectURL(){}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});

async function open(){
  let pending:ReturnType<typeof requestPdfPagePrivacyReview>;
  await act(async()=>{pending=requestPdfPagePrivacyReview(request);void pending.catch(()=>{});await Promise.resolve();});
  await screen.findByText(/Gespeicherte Markierungen wiederhergestellt/);
  return {pending:pending!};
}
async function cancel(pending:ReturnType<typeof requestPdfPagePrivacyReview>){
  fireEvent.click(screen.getByRole("button",{name:"Nicht freigeben"}));
  await expect(pending).rejects.toThrow(/nicht freigegeben/);
}

describe("restored manual PDF review",()=>{
  it("restores the rectangles after remount but requires fresh view and both confirmations",async()=>{
    savePdfRedactionDraft(key,masks);
    const first=render(<PdfArchiveReviewDialog scopeKey="synthetic-user/case"/>);
    const {pending}=await open();
    expect(document.querySelectorAll('[data-pdf-manual-redaction] rect')).toHaveLength(1);
    expect(screen.getByRole("button",{name:"Diese Seite bestätigt – weiter"})).toBeDisabled();
    const image=document.querySelector('[data-pdf-review-image]')!;
    Object.defineProperties(image,{naturalWidth:{value:100},naturalHeight:{value:100}});
    fireEvent.load(image);
    for(const checkbox of screen.getAllByRole("checkbox"))fireEvent.click(checkbox);
    const scroller=document.querySelector('[data-pdf-review-scroller]')!;
    fireEvent.scroll(scroller);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Diese Seite bestätigt – weiter"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button",{name:"Diese Seite bestätigt – weiter"}));
    await expect(pending).resolves.toEqual(masks);
    first.unmount();
    render(<PdfArchiveReviewDialog scopeKey="synthetic-user/case"/>);
    const second=await open();
    expect(document.querySelectorAll('[data-pdf-manual-redaction] rect')).toHaveLength(1);
    for(const checkbox of screen.getAllByRole("checkbox"))expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("button",{name:"Diese Seite bestätigt – weiter"})).toBeDisabled();
    await cancel(second.pending);
  });
  it("keeps an existing draft if its initial read fails instead of autosaving empty geometry",async()=>{
    savePdfRedactionDraft(key,masks);const id=localStorage.key(0)!,before=localStorage.getItem(id);
    vi.spyOn(Storage.prototype,"getItem").mockImplementationOnce(()=>{throw Error("temporary read failure");});
    render(<PdfArchiveReviewDialog scopeKey="synthetic-user/case"/>);
    let pending:ReturnType<typeof requestPdfPagePrivacyReview>;
    await act(async()=>{pending=requestPdfPagePrivacyReview(request);void pending.catch(()=>{});await Promise.resolve();});
    expect(await screen.findByText(/konnte nicht geladen werden/)).toBeVisible();
    expect(localStorage.getItem(id)).toBe(before);
    await cancel(pending!);
  });
});
