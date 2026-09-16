import {useEffect,useRef,useState} from "react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {registerPdfPageReviewer,type PdfPagePrivacyReviewRequest} from "@/lib/pdfPagePrivacyReview";

export function PdfArchiveReviewDialog({scopeKey}:{scopeKey:string}){
  const [request,setRequest]=useState<PdfPagePrivacyReviewRequest|null>(null);
  const [url,setUrl]=useState("");
  const [privacy,setPrivacy]=useState(false),[content,setContent]=useState(false),[viewed,setViewed]=useState(false);
  const resolver=useRef<((approved:boolean)=>void)|null>(null);
  const scroller=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const unregister=registerPdfPageReviewer(next=>new Promise(resolve=>{
      resolver.current=resolve;setPrivacy(false);setContent(false);setViewed(false);setRequest(next);
    }));
    return()=>{unregister();resolver.current?.(false);resolver.current=null;setRequest(null);};
  },[scopeKey]);
  useEffect(()=>{
    if(!request){setUrl("");return;}
    const value=URL.createObjectURL(request.image);setUrl(value);
    return()=>URL.revokeObjectURL(value);
  },[request]);
  const finish=(approved:boolean)=>{resolver.current?.(approved);resolver.current=null;setRequest(null);};
  const inspectScroll=()=>{const e=scroller.current;if(e&&e.scrollTop+e.clientHeight>=e.scrollHeight-12)setViewed(true);};
  return <Dialog open={!!request} onOpenChange={open=>{if(!open)finish(false);}}>
    <DialogContent style={{maxWidth:"95vw",width:1050,maxHeight:"95vh",background:"white",color:"#172b3a",padding:20}}>
      <DialogTitle>PDF-Seite {request?.page} von {request?.totalPages} prüfen</DialogTitle>
      <DialogDescription>Diese Ansicht bleibt lokal. Die automatische Erkennung konnte diese Seite nicht sicher bestätigen. Bereits erkannte Angaben sind geschwärzt. Erst nach der Sichtprüfung darf der Vorgang fortgesetzt werden.</DialogDescription>
      <p className="text-sm" data-pdf-review-reason>{request?.reason}</p>
      <div ref={scroller} onScroll={inspectScroll} style={{maxHeight:"60vh",overflow:"auto",border:"1px solid #b8c9c3"}}>
        {url&&<img data-pdf-review-image src={url} alt={`Lokal vorbereitete PDF-Seite ${request?.page}`} style={{display:"block",width:"100%",height:"auto"}} onLoad={inspectScroll}/>}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/>Auf der gesamten sichtbaren Seite sind keine identifizierenden Angaben übrig geblieben.</label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={content} onChange={e=>setContent(e.target.checked)}/>Befunde, Werte, Abbildungen und Markierungen sind erhalten und lesbar.</label>
      <p className="text-xs">Wenn Angaben übrig geblieben oder Inhalte unklar sind: nicht freigeben. Das Original bleibt erhalten und wird nicht übertragen.</p>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>finish(false)}>Nicht freigeben</Button><Button type="button" disabled={!privacy||!content||!viewed} onClick={()=>finish(true)}>Diese Seite bestätigt – weiter</Button></div>
    </DialogContent>
  </Dialog>;
}
