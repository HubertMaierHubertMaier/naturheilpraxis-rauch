import {afterEach,describe,expect,it,vi} from "vitest";
import {applyManualPdfRedactions,validateManualPdfRedactions} from "../lib/manualPdfRedaction";
import {registerPdfPageReviewer,requestPdfPagePrivacyReview,type PdfPagePrivacyReviewDecision} from "../lib/pdfPagePrivacyReview";

const request={image:new Blob(["synthetic page"]),page:1,totalPages:2,reason:"synthetic overlapping rows",manualRedaction:{width:100,height:100}};
let unregister:(()=>void)|undefined;
afterEach(()=>{unregister?.();unregister=undefined;});

describe("explicit local PDF redaction",()=>{
  it("requires nonempty bounded geometry and rounds outward to opaque pixel boundaries",()=>{
    expect(validateManualPdfRedactions([{x:10.2,y:20.4,width:15.1,height:5.2}],100,100)).toEqual([{x:10,y:20,width:16,height:6}]);
    for(const rectangles of [[],[{x:-1,y:0,width:5,height:5}],[{x:95,y:0,width:6,height:5}],[{x:1,y:2,width:NaN,height:5}],Array(201).fill({x:1,y:1,width:1,height:1})]){
      expect(()=>validateManualPdfRedactions(rectangles,100,100)).toThrow();
    }
  });
  it("checks every rectangle before altering any pixels",()=>{
    const context={save:vi.fn(),restore:vi.fn(),fillRect:vi.fn()} as unknown as CanvasRenderingContext2D;
    expect(()=>applyManualPdfRedactions(context,[{x:0,y:0,width:5,height:5},{x:99,y:99,width:5,height:5}],100,100)).toThrow();
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
  });
  it("draws opaque masks and restores drawing state even on failure",()=>{
    const fillRect=vi.fn(function(this:CanvasRenderingContext2D){expect(this.globalAlpha).toBe(1);expect(this.fillStyle).toBe("#000");throw Error("synthetic drawing error");});
    const context={save:vi.fn(),restore:vi.fn(),fillRect,globalAlpha:.1} as unknown as CanvasRenderingContext2D;
    expect(()=>applyManualPdfRedactions(context,[{x:0,y:0,width:5,height:5}],100,100)).toThrow("synthetic drawing error");
    expect(context.restore).toHaveBeenCalledOnce();
  });
  it("does not treat an ordinary confirmation as a manual redaction",async()=>{
    unregister=registerPdfPageReviewer(async()=>true);
    await expect(requestPdfPagePrivacyReview(request)).rejects.toThrow("Schwärzung fehlt");
  });
  it("rejects a changed case even after a reviewer accepts",async()=>{
    let current=true;
    unregister=registerPdfPageReviewer(async()=>{current=false;return {approved:true,redactions:[{x:1,y:2,width:3,height:4}]};});
    await expect(requestPdfPagePrivacyReview(request,()=>current)).rejects.toThrow("nicht freigegeben");
  });
  it("does not reuse a previous page confirmation or mutable rectangle array",async()=>{
    const rectangles=[{x:1,y:2,width:3,height:4}];
    const reviewer=vi.fn(async():Promise<PdfPagePrivacyReviewDecision>=>({approved:true,redactions:rectangles}));
    unregister=registerPdfPageReviewer(reviewer);
    const accepted=await requestPdfPagePrivacyReview(request);
    rectangles[0].width=90;
    expect(accepted).toEqual([{x:1,y:2,width:3,height:4}]);
    await requestPdfPagePrivacyReview({...request,page:2});
    expect(reviewer).toHaveBeenCalledTimes(2);
  });
  it("keeps the existing non-manual page confirmation compatible",async()=>{
    unregister=registerPdfPageReviewer(async()=>true);
    const {manualRedaction,...ordinary}=request;
    await expect(requestPdfPagePrivacyReview(ordinary)).resolves.toBeUndefined();
  });
});
