import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {registerPdfPageReviewer,type PdfPagePrivacyReviewRequest,type PdfPagePrivacyReviewDecision} from "@/lib/pdfPagePrivacyReview";
import {validateManualPdfRedactions,type ManualPdfRedaction} from "@/lib/manualPdfRedaction";
import {loadPdfRedactionDraft,savePdfRedactionDraft} from "@/lib/pdfRedactionDraft";

export function PdfArchiveReviewDialog({scopeKey}:{scopeKey:string}){
  const [request,setRequest]=useState<PdfPagePrivacyReviewRequest|null>(null);
  const [url,setUrl]=useState("");
  const [imageLoaded,setImageLoaded]=useState(false);
  const [privacy,setPrivacy]=useState(false),[content,setContent]=useState(false),[viewed,setViewed]=useState(false);
  const resolver=useRef<((approved:PdfPagePrivacyReviewDecision)=>void)|null>(null);
  const [redactions,setRedactions]=useState<ManualPdfRedaction[]>([]);
  const [unchangedPageConfirmed,setUnchangedPageConfirmed]=useState(false);
  const [draftRestored,setDraftRestored]=useState(false),[draftMessage,setDraftMessage]=useState("");
  const [draftWritable,setDraftWritable]=useState(false);
  const [drag,setDrag]=useState<{x:number;y:number;endX:number;endY:number}|null>(null);
  const scroller=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const unregister=registerPdfPageReviewer(next=>new Promise(resolve=>{
      let initial:ManualPdfRedaction[]=[],warning=next.manualRedaction?.draftWarning||"",writable=!!next.manualRedaction?.draftKey;
      try{if(next.manualRedaction?.draftKey)initial=loadPdfRedactionDraft(next.manualRedaction.draftKey)||[];}
      catch{writable=false;warning="Gespeicherter Markierungsentwurf konnte nicht geladen werden; bestehende Daten bleiben erhalten.";}
      resolver.current=resolve;setPrivacy(false);setContent(false);setViewed(false);setImageLoaded(false);setRedactions(initial);setDraftRestored(initial.length>0);setDraftMessage(warning);setDraftWritable(writable);setUnchangedPageConfirmed(false);setDrag(null);setRequest(next);
    }));
    return()=>{unregister();resolver.current?.(false);resolver.current=null;setRequest(null);};
  },[scopeKey]);
  useEffect(()=>{
    if(!request){setUrl("");return;}
    const value=URL.createObjectURL(request.image);setUrl(value);
    return()=>URL.revokeObjectURL(value);
  },[request]);
  useEffect(()=>{
    const key=request?.manualRedaction?.draftKey;if(!key||!draftWritable)return;
    try{savePdfRedactionDraft(key,redactions);setDraftMessage("Markierungsentwurf lokal gespeichert. Freigaben werden nicht gespeichert.");}
    catch{setDraftMessage("Markierungen NICHT dauerhaft gesichert. Sie bleiben nur in dieser Sitzung; vorhandene Entwürfe werden nicht gelöscht.");}
  },[request,redactions,draftWritable]);
  const finish=(approved:boolean)=>{resolver.current?.(approved&&request?.manualRedaction?{approved:true,redactions,unchangedPageConfirmed:!redactions.length&&unchangedPageConfirmed}:approved);resolver.current=null;setRequest(null);};
  const changed=()=>{setPrivacy(false);setContent(false);setViewed(false);setUnchangedPageConfirmed(false);setDraftWritable(true);};
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
  const missing=[!imageLoaded&&"Bild laden",!viewed&&"PDF-Seite bis zum Ende prüfen",(!privacy||!content)&&"beide Prüfpunkte bestätigen",!!drag&&"Markierung abschließen",!!manual&&!redactions.length&&!unchangedPageConfirmed&&"Schwärzen oder ausdrücklich keine zusätzliche Schwärzung bestätigen"].filter(Boolean);
  return <Dialog open={!!request} onOpenChange={open=>{if(!open)finish(false);}}>
    <DialogContent style={{maxWidth:"95vw",width:1050,height:"95vh",maxHeight:1000,display:"flex",flexDirection:"column",gap:10,overflow:"hidden",background:"white",color:"#172b3a",padding:16}}>
      <header style={{flexShrink:0}} data-pdf-review-header>
        <DialogTitle style={{fontSize:24,fontWeight:700}}>Dateiseite {request?.page} von {request?.totalPages}</DialogTitle>
        <DialogDescription>{manual?"Lokale Originalseite: Automatische Schwärzungen wurden verworfen. Nur identifizierende Angaben abdecken; medizinische Inhalte erhalten.":"Lokale Sichtprüfung: Bereits erkannte Angaben sind geschwärzt. Bitte Inhalt und Datenschutz prüfen."} Andere Seiten werden automatisch verarbeitet.</DialogDescription>
        <details className="text-sm"><summary>Warum wird diese Seite angehalten?</summary><p data-pdf-review-reason>{request?.reason}</p></details>
        {draftRestored&&<p className="text-sm" data-pdf-draft-restored>Gespeicherte Markierungen wiederhergestellt – bitte die gesamte Seite erneut prüfen und bestätigen.</p>}
        {draftMessage&&<p className="text-xs" role="status" data-pdf-draft-status>{draftMessage}</p>}
      </header>
      {manual&&<div style={{flexShrink:0}} className="flex flex-wrap items-center gap-2 text-sm"><span>Bei Bedarf mit der Maus Schwärzungsrechtecke ziehen.</span><Button type="button" variant="outline" disabled={!redactions.length} onClick={()=>{setRedactions(r=>r.slice(0,-1));changed();}}>Letzte Schwärzung zurücknehmen</Button><span>{redactions.length} Bereich(e)</span></div>}
      <div ref={scroller} onScroll={inspectScroll} data-pdf-review-scroller style={{flex:"1 1 0",minHeight:0,overflow:"auto",border:"1px solid #b8c9c3"}}>
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
      <footer style={{flexShrink:0}} className="space-y-2" data-pdf-review-footer>
        {manual&&!redactions.length&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={unchangedPageConfirmed} onChange={e=>setUnchangedPageConfirmed(e.target.checked)}/>Auf dieser Seite ist keine zusätzliche Schwärzung erforderlich.</label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/>Die vollständig geprüfte Seite enthält keine identifizierenden Angaben mehr.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={content} onChange={e=>setContent(e.target.checked)}/>Befunde, Werte, Abbildungen und Markierungen sind erhalten und lesbar.</label>
        {missing.length>0&&<p className="text-xs" role="status">Noch offen: {missing.join(" · ")}.</p>}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>finish(false)}>Nicht freigeben</Button><Button type="button" disabled={missing.length>0} onClick={()=>finish(true)}>Diese Seite bestätigt – weiter</Button></div>
      </footer>
    </DialogContent>
  </Dialog>;
}
