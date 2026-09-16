import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { jsPDF } from "jspdf";
import { canvasToPngBytes, createLocalBrowserOcrWorker, type LocalOcrWorker } from "./localBrowserOcr";
import { assertPdfOcrEvidence, checkedPdfPrivacyReplacements, groupPdfPrivacyWords, isOpaquePrivacyCover, type PositionedPrivacyLine } from "./pdfArchiveRedactionPlan";
import { waitForPdfRender } from "./clinicalPdfExtraction";
import { isPreparedPdfArchiveCopy, registerPreparedPdfArchiveCopy } from "./pdfArchiveCopyRegistry";
import { readPdfOcrCache, rememberPdfOcrRead } from "./pdfReadOcrCache";
import { requestPdfPagePrivacyReview } from "./pdfPagePrivacyReview";
export { setPdfArchiveCopyReviewed, assertReviewedPdfArchiveCopy } from "./pdfArchiveCopyRegistry";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const passwords = new WeakMap<Blob, string>();
const prepared = new WeakMap<Blob, Promise<File>>();
export function openPdfArchiveCopy(file: File) {
  if (!isPreparedPdfArchiveCopy(file)) throw new Error("Anonymisierte PDF-Kopie fehlt.");
  const url=URL.createObjectURL(file);
  const link=globalThis.document.createElement("a");
  link.href=url;link.target="_blank";link.rel="noopener";link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
export function rememberValidatedPdfPassword(file: Blob, password: string) {
  if (password) passwords.set(file, password);
}
export function isAnonymizedPdfArchiveCopy(file: Blob): boolean { return isPreparedPdfArchiveCopy(file); }

export async function prepareAnonymizedPdfArchive(file: Blob & { name: string }, onProgress?: (message: string) => void, isCurrent:()=>boolean=()=>true): Promise<File> {
  if (isPreparedPdfArchiveCopy(file)) return file as File;
  const previous = prepared.get(file);
  if (previous) return previous;
  const promise = createCopy(file,onProgress,isCurrent).catch(error => {prepared.delete(file); throw error;});
  prepared.set(file,promise);
  return promise;
}

async function createCopy(file: Blob & { name: string }, onProgress:((message: string) => void)|undefined,isCurrent:()=>boolean): Promise<File> {
  const loading = pdfjs.getDocument({data:await file.arrayBuffer(),password:passwords.get(file)});
  let ocr: LocalOcrWorker | undefined;
  let output: jsPDF | undefined;
  let pageCount=0;
  let encodedBytes=0;
  try {
    const document = await loading.promise;
    pageCount=document.numPages;
    if (!pageCount) throw new Error("Leeres PDF wird nicht archiviert.");
    if(pageCount>1000)throw new Error("Die PDF überschreitet die Kapazität einer einzelnen lokalen Archivkopie. Keine Seiten wurden ausgelassen oder übertragen.");
    let totalPixels=0;
    for(let n=1;n<=pageCount;n++){
      const p=await document.getPage(n),v=p.getViewport({scale:2});
      const pixels=Math.ceil(v.width)*Math.ceil(v.height);
      if(!Number.isFinite(pixels)||pixels<=0||pixels>10_000_000)throw new Error("Ungültige oder zu große PDF-Seite; keine Archivübertragung.");
      totalPixels+=pixels;
      if(totalPixels>200_000_000)throw new Error("Die PDF überschreitet das lokale Bilddatenbudget. Keine Seiten wurden ausgelassen oder übertragen.");
      p.cleanup();
    }
    for (let number=1;number<=pageCount;number++) {
      if(!isCurrent())throw new Error("Der Fall wurde gewechselt; keine Archivübertragung.");
      onProgress?.(`Anonymisierte PDF-Archivkopie: Seite ${number} von ${pageCount}`);
      const page=await document.getPage(number);
      const canvas=documentOwnerCanvas();
      try {
        const viewport=page.getViewport({scale:2});
        canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
        if(canvas.width*canvas.height>10_000_000) throw new Error("PDF-Seite ist für die sichere lokale Archivkopie zu groß.");
        const context=canvas.getContext("2d",{alpha:false});
        if(!context)throw new Error("PDF-Archivkopie konnte nicht lokal vorbereitet werden.");
        // ENABLE_FORMS omits interactive widgets from canvas. ENABLE_STORAGE
        // flattens their current/saved values into the page image instead.
        await waitForPdfRender(page.render({canvas,canvasContext:context,viewport,background:"rgb(255,255,255)",annotationMode:pdfjs.AnnotationMode.ENABLE_STORAGE}));
        const content=await page.getTextContent();
        const words: PositionedPrivacyLine[]=[];
        let rotated=false;
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const transform=pdfjs.Util.transform(viewport.transform,item.transform);
          if(Math.abs(transform[1])>0.1 || Math.abs(transform[2])>0.1)rotated=true;
          const height=Math.hypot(transform[2],transform[3]);
          words.push({text:item.str,x:transform[4],y:transform[5]-height,width:Math.abs(item.width*viewport.scale),height:height*1.25});
        }
        let lines=groupPdfPrivacyWords(words);
        let reviewReason="";
        // Scan/rotated pages need actual OCR positions; text without positions is insufficient.
        const needsOcrForText=rotated || words.map(w=>w.text).join("").trim().length<40;
        // Any visible ink may include outlined glyphs or appearances absent from the
        // text layer. Only an exactly white page is exempt from the local OCR pass.
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        let blank=true;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i]!==255||pixels[i+1]!==255||pixels[i+2]!==255){blank=false;break;}}
        if(!blank) {
          const cached=readPdfOcrCache(file,number);
          if(!cached)ocr ||= await createLocalBrowserOcrWorker();
          const data=cached?.data || (await ocr!.recognize(canvas,{includeLayout:true})).data;
          if(!cached)rememberPdfOcrRead(file,number,canvas.width,canvas.height,data);
          const scaleX=cached?canvas.width/cached.width:1, scaleY=cached?canvas.height/cached.height:1;
          const positioned: PositionedPrivacyLine[]=[];
          for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]) {
            const box=line.bbox;
            if(box && line.text?.trim())positioned.push({text:line.text.trim(),x:box.x0*scaleX,y:box.y0*scaleY,width:(box.x1-box.x0)*scaleX,height:(box.y1-box.y0)*scaleY});
          }
          try {assertPdfOcrEvidence(data.text,data.confidence,positioned,canvas.width,canvas.height);}
          catch(error){
            reviewReason=error instanceof Error?error.message:"OCR-Sichtprüfung erforderlich.";
            // Invalid geometry cannot be used even in a review preview.
            for(let i=positioned.length-1;i>=0;i--){const p=positioned[i];if(![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>canvas.width+2||p.y+p.height>canvas.height+2)positioned.splice(i,1);}
          }
          // Native text is preferred where an OCR line covers the same printed line.
          lines=needsOcrForText ? positioned : [...lines,...positioned.filter(ocrLine=>!lines.some(native=>{
            const overlapX=Math.max(0,Math.min(native.x+native.width,ocrLine.x+ocrLine.width)-Math.max(native.x,ocrLine.x));
            const overlapY=Math.max(0,Math.min(native.y+native.height,ocrLine.y+ocrLine.height)-Math.max(native.y,ocrLine.y));
            return native.text.replace(/\s+/g,"").toLowerCase()===ocrLine.text.replace(/\s+/g,"").toLowerCase()
              && overlapX*overlapY>=ocrLine.width*ocrLine.height*0.7;
          }))];
        }
        const replacements=checkedPdfPrivacyReplacements(lines);
        for(const replacement of replacements) {
          const x=Math.max(0,Math.floor(replacement.x-2)), y=Math.max(0,Math.floor(replacement.y-2));
          const width=Math.min(canvas.width-x,Math.ceil(replacement.width+4)), height=Math.min(canvas.height-y,Math.ceil(replacement.height+4));
          if(width<=0||height<=0)throw new Error("Schwärzungsbereich liegt außerhalb der PDF-Seite.");
          if(isOpaquePrivacyCover(context.getImageData(x,y,width,height).data))continue;
          // Rebuild visible pixels, not an annotation covering recoverable original text.
          context.fillStyle="#fff"; context.fillRect(x,y,width,height);
          context.save(); context.beginPath(); context.rect(x,y,width,height); context.clip();
          let font=Math.max(6,replacement.height*0.65);
          context.font=`${font}px sans-serif`;
          const measured=context.measureText(replacement.replacement).width;
          if(measured>width-4)font*=Math.max(0,(width-4)/measured);
          if(font<6 && replacement.replacement.replace(/\[geschwärzt\]/g,"").trim())throw new Error("Verbleibender Befundtext würde unleserlich: Archivkopie benötigt Prüfung.");
          context.font=`${Math.max(6,font)}px sans-serif`; context.fillStyle="#000";context.textBaseline="middle";
          context.fillText(replacement.replacement,x+2,y+height/2);
          context.restore();
        }
        const dimensions: [number,number]=[viewport.width/2,viewport.height/2];
        const orientation=dimensions[0]>dimensions[1]?"landscape":"portrait";
        if(!output){output=new jsPDF({unit:"pt",format:dimensions,orientation,compress:true});output.setProperties({title:"Anonymisierte Befundkopie",author:"",subject:"",keywords:"",creator:"Lokale PDF-Anonymisierung"});}
        else output.addPage(dimensions,orientation);
        // Only newly rendered page images enter this PDF. No source attachments, forms,
        // metadata, annotations, JavaScript or hidden original text are copied.
        const png=await canvasToPngBytes(canvas);
        if(reviewReason){
          onProgress?.(`Lokale Sichtprüfung erforderlich: PDF-Seite ${number} von ${pageCount}`);
          await requestPdfPagePrivacyReview({image:new Blob([png],{type:"image/png"}),page:number,totalPages:pageCount,reason:reviewReason},isCurrent);
        }
        if(!isCurrent())throw new Error("Der Fall wurde gewechselt; keine Archivübertragung.");
        encodedBytes+=png.byteLength;
        if(encodedBytes>40*1024*1024)throw new Error("Lokales Bilddatenbudget der Archivkopie überschritten; keine Übertragung.");
        output.addImage(png,"PNG",0,0,dimensions[0],dimensions[1],undefined,"FAST");
      } finally {canvas.width=1;canvas.height=1;page.cleanup();}
    }
    if(!output||output.getNumberOfPages()!==pageCount)throw new Error("PDF-Archivkopie ist unvollständig.");
    const copy=new File([output.output("blob")],"anonymisierte-befundkopie.pdf",{type:"application/pdf"});
    if(copy.size>50*1024*1024)throw new Error("Anonymisierte Archivkopie überschreitet 50 MB; keine Übertragung.");
    registerPreparedPdfArchiveCopy(copy);
    return copy;
  } finally {try {await ocr?.terminate();} finally {await loading.destroy();}}
}

function documentOwnerCanvas() { return globalThis.document.createElement("canvas"); }
