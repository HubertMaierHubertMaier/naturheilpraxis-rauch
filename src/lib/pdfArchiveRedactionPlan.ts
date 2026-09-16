import { deidentifyClinicalText, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";

export type PositionedPrivacyLine = { text: string; x: number; y: number; width: number; height: number };
export type PdfPrivacyReplacement = PositionedPrivacyLine & { replacement: string; categories: string[] };
const overlapArea=(a:PositionedPrivacyLine,b:PositionedPrivacyLine)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const compact=(text:string)=>text.replace(/\s+/g,"").toLowerCase();

export function assertPdfOcrEvidence(text:string,confidence:number|undefined,lines:readonly PositionedPrivacyLine[],width:number,height:number){
  if(!text.trim()||!lines.length)throw new Error("Sichtbarer PDF-Seiteninhalt ohne prüfbare OCR-Positionen. Lokale Sichtprüfung erforderlich; keine Archivübertragung.");
  if(!Number.isFinite(confidence)||Number(confidence)<70)throw new Error("Unsichere Scan-Erkennung: PDF-Archivkopie vor Übertragung prüfen.");
  if(lines.some(line=>![line.x,line.y,line.width,line.height].every(Number.isFinite)||line.x<0||line.y<0||line.width<=0||line.height<=0||line.x+line.width>width+2||line.y+line.height>height+2))throw new Error("Ungültige OCR-Positionen; keine Archivübertragung.");
}

export function checkedPdfPrivacyReplacements(lines:readonly PositionedPrivacyLine[]):PdfPrivacyReplacement[]{
  const result:PdfPrivacyReplacement[]=[];
  for(const candidate of buildPdfPrivacyReplacements(lines)){
    // OCR's ink box is tighter than the PDF font box. Include matching native
    // fragments completely instead of clipping a label that will be redrawn.
    for(const line of lines){
      if(!overlapArea(candidate,line)||!compact(candidate.text).includes(compact(line.text)))continue;
      const right=Math.max(candidate.x+candidate.width,line.x+line.width),bottom=Math.max(candidate.y+candidate.height,line.y+line.height);
      candidate.x=Math.min(candidate.x,line.x);candidate.y=Math.min(candidate.y,line.y);
      candidate.width=right-candidate.x;candidate.height=bottom-candidate.y;
    }
    const existing=result.find(item=>overlapArea(item,candidate)>0);
    if(!existing){result.push({...candidate});continue;}
    const existingContains=compact(existing.text).includes(compact(candidate.text))&&compact(existing.replacement).includes(compact(candidate.replacement));
    const candidateContains=compact(candidate.text).includes(compact(existing.text))&&compact(candidate.replacement).includes(compact(existing.replacement));
    if((compact(existing.replacement)!==compact(candidate.replacement)&&!existingContains&&!candidateContains)
      || overlapArea(existing,candidate)<Math.min(existing.width*existing.height,candidate.width*candidate.height)*0.8){
      throw new Error("Widersprüchliche überlappende PDF-Schwärzungen: lokale Prüfung erforderlich, keine Übertragung.");
    }
    const right=Math.max(existing.x+existing.width,candidate.x+candidate.width),bottom=Math.max(existing.y+existing.height,candidate.y+candidate.height);
    existing.x=Math.min(existing.x,candidate.x);existing.y=Math.min(existing.y,candidate.y);
    existing.width=right-existing.x;existing.height=bottom-existing.y;
    if(candidateContains){existing.text=candidate.text;existing.replacement=candidate.replacement;}
  }
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(overlapArea(result[i],result[j]))throw new Error("Mehrdeutige PDF-Schwärzungsüberlappung; keine Übertragung.");
  for(const replacement of result){
    const padded={...replacement,x:replacement.x-2,y:replacement.y-2,width:replacement.width+4,height:replacement.height+4};
    for(const line of lines){
      if(!overlapArea(padded,line))continue;
      if(overlapArea(replacement,line)>=line.width*line.height*0.8
        && (compact(replacement.text).includes(compact(line.text))
          || compact(replacement.replacement).includes(compact(line.text))
          || compact(deidentifyClinicalText(line.text).replace(/\[[^\]\n]*entfernt\]/giu,"[geschwärzt]"))===compact(replacement.replacement)))continue;
      if(!directIdentifierCategories(line.text).length)throw new Error("Eine PDF-Schwärzung würde benachbarten Befundtext überdecken. Lokale Prüfung erforderlich.");
    }
  }
  return result;
}

export function isOpaquePrivacyCover(pixels: Uint8ClampedArray): boolean {
  if (!pixels.length || pixels.length % 4) return false;
  let dark=0,white=0;
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]<250)return false;
    if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<30)dark++;
    if(Math.min(pixels[i],pixels[i+1],pixels[i+2])>250)white++;
  }
  // Do not reconstruct invisible text (including age) over an existing blackout/whiteout.
  return dark/(pixels.length/4)>0.8 || white/(pixels.length/4)>0.995;
}

export function buildPdfPrivacyReplacements(lines: readonly PositionedPrivacyLine[]): PdfPrivacyReplacement[] {
  return lines.flatMap(line => {
    const categories = directIdentifierCategories(line.text);
    if (!categories.length) return [];
    if (![line.x, line.y, line.width, line.height].every(Number.isFinite) || line.width <= 0 || line.height <= 0) {
      throw new Error("Personenbezogene PDF-Stelle konnte nicht sicher lokalisiert werden. Keine Archivübertragung.");
    }
    const safe = deidentifyClinicalText(line.text);
    if (safe === line.text || directIdentifierCategories(safe).length) {
      throw new Error("PDF-Stelle benötigt eine eindeutige Schwärzung. Keine Archivübertragung.");
    }
    return [{ ...line, replacement: safe.replace(/\[[^\]\n]*entfernt\]/giu, "[geschwärzt]"), categories }];
  });
}

export function groupPdfPrivacyWords(words: readonly PositionedPrivacyLine[]): PositionedPrivacyLine[] {
  const rows: PositionedPrivacyLine[][] = [];
  for (const word of [...words].filter(word => word.text.trim()).sort((a,b) => a.y-b.y || a.x-b.x)) {
    const row = rows.find(candidate => Math.abs(candidate[0].y-word.y) <= Math.max(2, Math.min(candidate[0].height,word.height)*0.35));
    if (row) row.push(word); else rows.push([word]);
  }
  return rows.flatMap(row => {
    const runs: PositionedPrivacyLine[][] = [];
    for (const word of row.sort((a,b) => a.x-b.x)) {
      const current=runs.at(-1), previous=current?.at(-1);
      // Do not combine separate table columns into one redaction rectangle.
      if (!previous || word.x-(previous.x+previous.width) > Math.max(20,word.height*3)) runs.push([word]);
      else current!.push(word);
    }
    return runs.map(run => {
      const x=Math.min(...run.map(w=>w.x)), y=Math.min(...run.map(w=>w.y));
      return {text:run.map(w=>w.text).join(" "),x,y,width:Math.max(...run.map(w=>w.x+w.width))-x,height:Math.max(...run.map(w=>w.y+w.height))-y};
    });
  });
}
