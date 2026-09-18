// @vitest-environment node
import {describe,expect,it} from "vitest";
import {createPdfRedactionDraftKey,loadPdfRedactionDraft,savePdfRedactionDraft,type PdfRedactionDraftKey} from "@/lib/pdfRedactionDraft";

class MemoryStorage implements Storage{
  data=new Map<string,string>();get length(){return this.data.size;}
  key(index:number){return [...this.data.keys()][index]??null;}
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,String(value));}
  removeItem(key:string){this.data.delete(key);}clear(){this.data.clear();}
}
const key:PdfRedactionDraftKey={scope:JSON.stringify(["user-a","case-a"]),sourceHash:"a".repeat(64),imageHash:"b".repeat(64),page:1,width:200,height:300};
const rectangles=[{x:10,y:20,width:30,height:12}];

describe("local PDF marking drafts",()=>{
  it("restores geometry across a recreated descriptor without approval flags",()=>{
    const storage=new MemoryStorage();savePdfRedactionDraft(key,rectangles,storage);
    const restored=loadPdfRedactionDraft(JSON.parse(JSON.stringify(key)),storage);
    expect(restored).toEqual(rectangles);restored![0].width=99;
    expect(loadPdfRedactionDraft(key,storage)).toEqual(rectangles);
    const raw=storage.getItem(storage.key(0)!)!;
    expect(raw).not.toMatch(/approved|privacyReviewed|originalText|archiveCopy/);
  });
  it.each([
    {scope:JSON.stringify(["user-b","case-a"])},{scope:JSON.stringify(["user-a","case-b"])},
    {sourceHash:"c".repeat(64)},{imageHash:"c".repeat(64)},{page:2},{width:201},
  ])("does not restore another user, case, original, page or rendered image: %j",different=>{
    const storage=new MemoryStorage();savePdfRedactionDraft(key,rectangles,storage);
    expect(loadPdfRedactionDraft({...key,...different},storage)).toBeUndefined();
  });
  it("preserves unknown versions and invalid coordinates instead of overwriting them",()=>{
    const storage=new MemoryStorage();savePdfRedactionDraft(key,rectangles,storage);const id=storage.key(0)!;
    const old=JSON.parse(storage.getItem(id)!);old.version=2;storage.setItem(id,JSON.stringify(old));
    expect(()=>loadPdfRedactionDraft(key,storage)).toThrow(/Unbekannter/);
    expect(()=>savePdfRedactionDraft(key,[],storage)).toThrow(/Unbekannter/);
    expect(JSON.parse(storage.getItem(id)!).version).toBe(2);
    expect(()=>savePdfRedactionDraft({...key,page:2},[{x:199,y:1,width:3,height:4}],storage)).toThrow();
  });
  it("persists undo-to-empty without inventing an unchanged-page approval",()=>{
    const storage=new MemoryStorage();savePdfRedactionDraft(key,rectangles,storage);savePdfRedactionDraft(key,[],storage);
    expect(loadPdfRedactionDraft(key,storage)).toEqual([]);
    expect(storage.getItem(storage.key(0)!)!).not.toContain("unchangedPageConfirmed");
  });
  it("reports storage failures and rejects missing user identity",()=>{
    const storage=new MemoryStorage();storage.setItem=()=>{throw Error("quota");};
    expect(()=>savePdfRedactionDraft(key,rectangles,storage)).toThrow("quota");
    expect(()=>savePdfRedactionDraft({...key,scope:JSON.stringify(["","case-a"])},rectangles,new MemoryStorage())).toThrow(/Benutzer/);
  });
  it("uses actual source and page-image bytes rather than filenames",async()=>{
    const image=new Blob(["page"]);
    const first=await createPdfRedactionDraftKey(new Blob(["first"]),image,1,200,300,key.scope);
    const same=await createPdfRedactionDraftKey(new Blob(["first"]),new Blob(["page"]),1,200,300,key.scope);
    const other=await createPdfRedactionDraftKey(new Blob(["other"]),image,1,200,300,key.scope);
    expect(first).toEqual(same);expect(other.sourceHash).not.toBe(first.sourceHash);
  });
});
