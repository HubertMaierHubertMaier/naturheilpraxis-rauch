import type { LocalOcrResultData } from "./localBrowserOcr";
type PageRead = { width: number; height: number; data: LocalOcrResultData };
// Only the immutable local Blob owns this cache. No patient text is persisted or transmitted.
const cache=new WeakMap<Blob,Map<number,PageRead>>();
export function rememberPdfOcrRead(file: Blob,page: number,width: number,height: number,data:LocalOcrResultData) {
  if(!Number.isInteger(page)||page<1||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!data.blocks?.length||!data.text.trim()||!Number.isFinite(data.confidence)||Number(data.confidence)<70)return;
  let pages=cache.get(file);if(!pages){pages=new Map();cache.set(file,pages);}
  // Keep only page/line/word boxes needed to bind a manual image redaction back to
  // the same local source page. Character trees and all other OCR detail are dropped.
  const compact={text:data.text,confidence:data.confidence,blocks:data.blocks.map(block=>({paragraphs:block.paragraphs?.map(paragraph=>({lines:paragraph.lines?.map(line=>({text:line.text,bbox:line.bbox?{...line.bbox}:undefined,words:line.words?.map(word=>({text:word.text,bbox:word.bbox?{...word.bbox}:undefined}))}))}))}))};
  pages.set(page,{width,height,data:compact});
}
export function readPdfOcrCache(file:Blob,page:number):PageRead|undefined{return cache.get(file)?.get(page);}
