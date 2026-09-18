import {validateManualPdfPageSize,validateManualPdfRedactions,type ManualPdfRedaction} from "./manualPdfRedaction";

export type PdfRedactionDraftKey={scope:string;sourceHash:string;imageHash:string;page:number;width:number;height:number};
const PREFIX="therapy.pdfRedactionDraft.v1:";
export const MAX_PDF_DRAFT_BYTES=2*1024*1024;
const hashes=new WeakMap<Blob,Promise<string>>();

function storageKey(key:PdfRedactionDraftKey){
  let scope:unknown;
  try{scope=JSON.parse(key.scope);}catch{throw Error("Markierungsentwurf benötigt eine eindeutige Benutzer-/Fallbindung.");}
  if(!Array.isArray(scope)||scope.length!==2||scope.some(value=>typeof value!=="string"||!value.trim()||value.length>200))
    throw Error("Markierungsentwurf benötigt eine eindeutige Benutzer-/Fallbindung.");
  if(!/^[a-f0-9]{64}$/.test(key.sourceHash)||!/^[a-f0-9]{64}$/.test(key.imageHash)||!Number.isInteger(key.page)||key.page<1||key.page>1000)
    throw Error("Markierungsentwurf hat keine gültige Original-/Seitenbindung.");
  validateManualPdfPageSize(key.width,key.height);
  return PREFIX+JSON.stringify([scope[0],scope[1],key.sourceHash,key.page,key.width,key.height,key.imageHash]);
}

export function hashPdfDraftBlob(blob:Blob):Promise<string>{
  let hash=hashes.get(blob);
  if(!hash){
    hash=blob.arrayBuffer().then(bytes=>crypto.subtle.digest("SHA-256",bytes))
      .then(bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join(""));
    hashes.set(blob,hash);void hash.catch(()=>hashes.delete(blob));
  }
  return hash;
}

export async function createPdfRedactionDraftKey(file:Blob,image:Blob,page:number,width:number,height:number,scope:string):Promise<PdfRedactionDraftKey>{
  const [sourceHash,imageHash]=await Promise.all([hashPdfDraftBlob(file),hashPdfDraftBlob(image)]);
  const key={scope,sourceHash,imageHash,page,width,height};storageKey(key);return key;
}

function readDraft(raw:string,key:string,width:number,height:number):ManualPdfRedaction[]{
  let value;
  try{value=JSON.parse(raw);}catch{throw Error("Gespeicherter Markierungsentwurf ist nicht lesbar und bleibt unverändert erhalten.");}
  if(value?.version!==1||value?.key!==key)throw Error("Unbekannter Markierungsentwurf bleibt unverändert erhalten.");
  if(!Array.isArray(value.rectangles))throw Error("Gespeicherte Markierungsbereiche sind ungültig.");
  return value.rectangles.length?validateManualPdfRedactions(value.rectangles,width,height):[];
}

/** Coordinates only. No original text, image bytes, approval flags or archive capability. */
export function loadPdfRedactionDraft(key:PdfRedactionDraftKey,storage:Storage=localStorage):ManualPdfRedaction[]|undefined{
  const id=storageKey(key),raw=storage.getItem(id);
  return raw===null?undefined:readDraft(raw,id,key.width,key.height);
}

export function savePdfRedactionDraft(key:PdfRedactionDraftKey,rectangles:readonly ManualPdfRedaction[],storage:Storage=localStorage):void{
  const id=storageKey(key);
  const checked=rectangles.length?validateManualPdfRedactions(rectangles,key.width,key.height):[];
  const previous=storage.getItem(id);
  if(previous!==null)readDraft(previous,id,key.width,key.height);
  const raw=JSON.stringify({version:1,key:id,rectangles:checked});
  let count=1,bytes=(id.length+raw.length)*2;
  for(let index=0;index<storage.length;index++){
    const other=storage.key(index);if(!other?.startsWith(PREFIX)||other===id)continue;
    count++;bytes+=(other.length+(storage.getItem(other)?.length||0))*2;
  }
  if(count>500||bytes>MAX_PDF_DRAFT_BYTES)throw Error("Lokaler Speicher für Markierungsentwürfe ist voll; bisherige Entwürfe bleiben erhalten.");
  storage.setItem(id,raw);
  if(storage.getItem(id)!==raw)throw Error("Markierungsentwurf konnte nicht zuverlässig lokal gespeichert werden.");
}
