import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {registerPdfPageReviewer,type PdfPagePrivacyReviewRequest,type PdfPagePrivacyReviewDecision} from "@/lib/pdfPagePrivacyReview";
import {validateManualPdfRedactions,type ManualPdfRedaction} from "@/lib/manualPdfRedaction";

export function PdfArchiveReviewDialog({scopeKey}:{scopeKey:string}){
  const [request,setRequest]=useState<PdfPagePrivacyReviewRequest|null>(null);
  const [url,setUrl]=useState("");
  const [imageLoaded,setImageLoaded]=useState(false);
  const [privacy,setPrivacy]=useState(false),[content,setContent]=useState(false),[viewed,setViewed]=useState(false);
  const resolver=useRef<((approved:PdfPagePrivacyReviewDecision)=>void)|null>(null);
  const [redactions,setRedactions]=useState<ManualPdfRedaction[]>([]);
  const [drag,setDrag]=useState<{x:number;y:number;endX:number;endY:number}|null>(null);
  const scroller=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const unregister=registerPdfPageReviewer(next=>new Promise(resolve=>{
      resolver.current=resolve;setPrivacy(false);setContent(false);setViewed(false);setImageLoaded(false);setRedactions([]);setDrag(null);setRequest(next);
    }));
    return()=>{unregister();resolver.current?.(false);resolver.current=null;setRequest(null);};
  },[scopeKey]);
  useEffect(()=>{
    if(!request){setUrl("");return;}
    const value=URL.createObjectURL(request.image);setUrl(value);
    return()=>URL.revokeObjectURL(value);
  },[request]);
  const finish=(approved:boolean)=>{resolver.current?.(approved&&request?.manualRedaction?{approved:true,redactions}:approved);resolver.current=null;setRequest(null);};
  const changed=()=>{setPrivacy(false);setContent(false);setViewed(false);};
  const manual=request?.manualRedaction;
  const point=(event:ReactPointerEvent<SVGSVGElement>)=>{
    const box=event.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(manual!.width,(event.clientX-box.left)*manual!.width/box.width)),y:Math.max(0,Math.min(manual!.height,(event.clientY-box.top)*manual!.height/box.height))};
  };
  const inspectScroll=()=>{const e=scroller.current;if(e&&e.scrollTop+e.clientHeight>=e.scrollHeight-12)setViewed(true);};
  useEffect(()=>{
    if(!request||!imageLoaded)return;
    const frame=requestAnimationFrame(inspectScroll);
    return()=>cancelAnimationFrame(frame);
  },[request,redactions,imageLoaded]);
  return <Dialog open={!!request} onOpenChange={open=>{if(!open)finish(false);}}>
    <DialogContent style={{maxWidth:"95vw",width:1050,maxHeight:"95vh",overflowY:"auto",background:"white",color:"#172b3a",padding:20}}>
      <DialogTitle>PDF-Seite {request?.page} von {request?.totalPages} prüfen</DialogTitle>
      <DialogDescription>{manual?"Diese Originalseite bleibt lokal. Die automatische Schwärzung wurde wegen eines Konflikts verworfen. Markiere alle noch identifizierenden Angaben mit schwarzen Rechtecken. Inhalte außerhalb der Rechtecke bleiben unverändert. Erst die geprüfte Kopie darf später übertragen werden.":"Diese Ansicht bleibt lokal. Die automatische Erkennung konnte diese Seite nicht sicher bestätigen. Bereits erkannte Angaben sind geschwärzt. Erst nach der Sichtprüfung darf der Vorgang fortgesetzt werden."}</DialogDescription>
      <p className="text-sm" data-pdf-review-reason>{request?.reason}</p>
      {manual&&<div className="flex flex-wrap items-center gap-2 text-sm"><span>Mit der Maus Rechtecke über die zu entfernenden Angaben ziehen.</span><Button type="button" variant="outline" disabled={!redactions.length} onClick={()=>{setRedactions(r=>r.slice(0,-1));changed();}}>Letzte Schwärzung zurücknehmen</Button><span>{redactions.length} Bereich(e)</span></div>}
      <div ref={scroller} onScroll={inspectScroll} style={{maxHeight:"60vh",overflow:"auto",border:"1px solid #b8c9c3"}}>
        {url&&<div style={{position:"relative"}}><img data-pdf-review-image src={url} alt={`Lokal vorbereitete PDF-Seite ${request?.page}`} style={{display:"block",width:"100%",height:"auto"}} onLoad={e=>{const image=e.currentTarget;setImageLoaded(!manual||(image.naturalWidth===manual.width&&image.naturalHeight===manual.height));}} onError={()=>{setImageLoaded(false);setViewed(false);}}/>
          {manual&&<svg data-pdf-manual-redaction viewBox={`0 0 ${manual.width} ${manual.height}`} aria-label="Lokale PDF-Schwärzungsfläche" style={{position:"absolute",inset:0,width:"100%",height:"100%",touchAction:"none",cursor:"crosshair"}}
            onPointerDown={e=>{if(e.button!==0||redactions.length>=200)return;const p=point(e);e.currentTarget.setPointerCapture(e.pointerId);setDrag({...p,endX:p.x,endY:p.y});}}
            onPointerMove={e=>{if(!drag)return;const p=point(e);setDrag({...drag,endX:p.x,endY:p.y});}}
            onPointerCancel={()=>setDrag(null)}
            onPointerUp={e=>{if(!drag)return;const p=point(e),rect={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),width:Math.abs(p.x-drag.x),height:Math.abs(p.y-drag.y)};setDrag(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(rect.width<2||rect.height<2)return;setRedactions(r=>[...r,...validateManualPdfRedactions([rect],manual.width,manual.height)]);changed();}}>
            {redactions.map((rect,index)=><rect key={index} {...rect} fill="#000"/>)}
            {drag&&<rect x={Math.min(drag.x,drag.endX)} y={Math.min(drag.y,drag.endY)} width={Math.abs(drag.endX-drag.x)} height={Math.abs(drag.endY-drag.y)} fill="#000"/>}
          </svg>}
        </div>}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/>Auf der gesamten sichtbaren Seite sind keine identifizierenden Angaben übrig geblieben.</label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={content} onChange={e=>setContent(e.target.checked)}/>Befunde, Werte, Abbildungen und Markierungen sind erhalten und lesbar.</label>
      <p className="text-xs">Wenn Angaben übrig geblieben oder Inhalte unklar sind: nicht freigeben. Das Original bleibt erhalten und wird nicht übertragen.</p>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>finish(false)}>Nicht freigeben</Button><Button type="button" disabled={!imageLoaded||!privacy||!content||!viewed||!!drag||(!!manual&&!redactions.length)} onClick={()=>finish(true)}>Diese Seite bestätigt – weiter</Button></div>
    </DialogContent>
  </Dialog>;
}
