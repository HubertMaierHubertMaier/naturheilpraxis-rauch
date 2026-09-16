export type Citation = { sourceId: string; locator: string; quote: string };
export type Source = { id: string; title: string; kind: "repertory" | "materia_medica"; maxGrade?: number; evidenceNote?: string };
export type Rubric = { id: string; sourceId: string; path: string; searchTerms?:string[] };
export type Remedy = { id: string; name: string };
export type Entry = { rubricId: string; remedyId: string; grade?: number; citation: Citation };
export type Administration = { remedyId: string; potency?: string; intake?: string; applicability: string; citation: Citation };
export type Catalog = { version: string; sources: Source[]; rubrics: Rubric[]; remedies: Remedy[]; entries: Entry[]; administrations: Administration[] };
export type Fact = { id: string; patientId: string; kind: "symptom" | "modality" | "disease" | "iaa"; text: string; assertion: "affirmed" | "negated" | "uncertain" | "not-stated"; iaaRating?: number; citation: string };
export type Binding = { factId: string; rubricId: string; confirmed: boolean; expectedAssertion?: "affirmed" | "negated"; weight?: number };
export type Request = { patientId: string; inputRevision: string; facts: Fact[]; bindings: Binding[]; limit?: number };
export type Match = { factId: string; factText: string; rubricId: string; rubricPath: string; sourceId: string; sourceTitle: string; weight: number; originalGrade?: number; normalizedGrade: number | null; citation: Citation };
export type Candidate = { remedyId: string; name: string; matchedFactCount: number; weightedCoverage: number; repertoryCount: number; gradeComparison: number | null; matches: Match[]; administrations: Administration[]; missing: string[]; explanation: string };
export type Result = { version: 1; visibility: "admin_only"; patientId: string; inputRevision: string; catalogVersion: string; status: "needs_sources" | "needs_mapping" | "comparison_ready"; allCandidates: Candidate[]; displayed: Candidate[]; furtherTiedCandidates: number; issues: string[] };

function unique<T extends {id:string}>(values:T[],label:string):Map<string,T>{
  const map=new Map<string,T>();
  for(const value of values){if(!value.id?.trim()||map.has(value.id))throw Error(`${label}: leere oder doppelte Kennung.`);map.set(value.id,value);}
  return map;
}
function hasCitation(citation:Citation|undefined,sources:Map<string,Source>):boolean{
  return !!citation && sources.has(citation.sourceId) && !!citation.locator?.trim() && !!citation.quote?.trim();
}

/** A deterministic source comparison, not a claim of clinical effectiveness.
 * Original source grades remain visible. IAA intensity NEVER supplies a remedy grade.
 * The engine does not fabricate a rubric binding, potency or administration.
 */
export function repertorize(request:Request,catalog:Catalog):Result{
  if(!request.patientId?.trim()||!request.inputRevision?.trim())throw Error("Fallkennung und Eingaberevision fehlen.");
  const facts=unique(request.facts,"Patientenangaben"),sources=unique(catalog.sources,"Quellen"),rubrics=unique(catalog.rubrics,"Rubriken"),remedies=unique(catalog.remedies,"Mittel");
  for(const fact of facts.values())if(fact.patientId!==request.patientId)throw Error("Angaben verschiedener Patienten dürfen nicht vermischt werden.");
  const issues:string[]=[];
  const result:Result={version:1,visibility:"admin_only",patientId:request.patientId,inputRevision:request.inputRevision,catalogVersion:catalog.version,status:"needs_sources",allCandidates:[],displayed:[],furtherTiedCandidates:0,issues};
  if(!catalog.entries.length||!catalog.sources.some(source=>source.kind==="repertory")){
    issues.push("Keine strukturierten Repertorium-Einträge geladen. Es werden keine Ersatzmittel oder Grade erfunden.");return result;
  }
  const bindings:Binding[]=[];
  const seenBindings=new Set<string>();
  for(const binding of request.bindings){
    const fact=facts.get(binding.factId),rubric=rubrics.get(binding.rubricId);
    if(!fact||!rubric){issues.push("Eine Rubrikzuordnung verweist auf fehlende Angaben oder Quellen.");continue;}
    if(!binding.confirmed){issues.push(`Rubrikzuordnung zu ${binding.factId} ist noch nicht bestätigt.`);continue;}
    if(!fact.citation.trim()){issues.push(`Beleg der Patientenangabe ${fact.id} fehlt.`);continue;}
    if(fact.assertion!==(binding.expectedAssertion||"affirmed")){
      issues.push(`Angabe ${fact.id} wird mit ihrem Aussagezustand erhalten, aber nicht als bejahte Rubrik gewertet.`);continue;
    }
    const weight=binding.weight??1;
    if(!Number.isFinite(weight)||weight<=0||weight>10)throw Error("Die ausdrücklich gewählte Rubrikgewichtung muss zwischen 0 und 10 liegen, ohne 0.");
    const key=`${binding.factId}|${binding.rubricId}`;
    if(!seenBindings.has(key)){bindings.push({...binding,weight});seenBindings.add(key);}
  }
  if(!bindings.length){result.status="needs_mapping";issues.push("Keine bestätigten, belegten Rubrikzuordnungen vorhanden.");return result;}
  const collected=new Map<string,Match[]>();
  const seenEntries=new Set<string>();
  const entriesByRubric=new Map<string,Entry[]>();
  for(const entry of catalog.entries){const list=entriesByRubric.get(entry.rubricId)||[];list.push(entry);entriesByRubric.set(entry.rubricId,list);}
  for(const binding of bindings){
    const rubric=rubrics.get(binding.rubricId)!,fact=facts.get(binding.factId)!,source=sources.get(rubric.sourceId);
    if(!source||source.kind!=="repertory"){issues.push(`Rubrik ${rubric.id}: keine Repertoriumsquelle; Materia-medica-Texte liefern keine erfundenen Grade.`);continue;}
    for(const entry of entriesByRubric.get(rubric.id)||[]){
      if(!remedies.has(entry.remedyId)||entry.citation?.sourceId!==source.id||!hasCitation(entry.citation,sources)){
        issues.push(`Rubrik ${rubric.id}: Quellenzuordnung eines Eintrags ist unvollständig.`);continue;
      }
      const key=JSON.stringify([binding.factId,entry]);if(seenEntries.has(key))continue;seenEntries.add(key);
      let normalizedGrade:number|null=null;
      if(entry.grade!==undefined){
        if(Number.isFinite(entry.grade)&&entry.grade>=0&&Number.isFinite(source.maxGrade)&&source.maxGrade!>0&&entry.grade<=source.maxGrade!){normalizedGrade=entry.grade/source.maxGrade!;}
        else issues.push(`Grad/Skala für ${entry.remedyId} in ${source.title} ist nicht vergleichbar; Originalangabe bleibt erhalten.`);
      }
      const match:Match={factId:fact.id,factText:fact.text,rubricId:rubric.id,rubricPath:rubric.path,sourceId:source.id,sourceTitle:source.title,weight:binding.weight!,...(entry.grade===undefined?{}:{originalGrade:entry.grade}),normalizedGrade,citation:{...entry.citation}};
      const list=collected.get(entry.remedyId)||[];list.push(match);collected.set(entry.remedyId,list);
    }
  }
  for(const [remedyId,matches] of collected){
    const covered=new Map<string,number>(),perSourceFact=new Map<string,{grade:number;weight:number}>();
    for(const match of matches){
      covered.set(match.factId,Math.max(covered.get(match.factId)||0,match.weight));
      if(match.normalizedGrade!==null){const key=`${match.factId}|${match.sourceId}`,previous=perSourceFact.get(key);if(!previous||previous.grade<match.normalizedGrade)perSourceFact.set(key,{grade:match.normalizedGrade,weight:match.weight});}
    }
    const grades=[...perSourceFact.values()],weightSum=grades.reduce((sum,item)=>sum+item.weight,0);
    const administrations=catalog.administrations.filter(item=>item.remedyId===remedyId&&hasCitation(item.citation,sources)).map(item=>({...item,citation:{...item.citation}}));
    const missing:string[]=[];
    if(!administrations.some(item=>item.potency?.trim()))missing.push("Keine belegte Potenzangabe geladen.");
    if(!administrations.some(item=>item.intake?.trim()))missing.push("Keine belegte Einnahmeangabe geladen.");
    if(matches.some(match=>match.normalizedGrade===null))missing.push("Mindestens ein Originalgrad fehlt oder ist nicht vergleichbar.");
    const sourceTitles=[...new Set(matches.map(match=>match.sourceTitle))];
    result.allCandidates.push({remedyId,name:remedies.get(remedyId)!.name,matchedFactCount:covered.size,weightedCoverage:[...covered.values()].reduce((a,b)=>a+b,0),repertoryCount:sourceTitles.length,gradeComparison:weightSum?grades.reduce((sum,item)=>sum+item.grade*item.weight,0)/weightSum:null,matches,administrations,missing,explanation:`Das Mittel erscheint aufgrund belegter Einträge zu ${covered.size} ausgewählten Patientenangaben in ${sourceTitles.join(", ")}. Die Rubriken und Originalgrade sind einzeln aufgeführt. Potenz-/Einnahmeangaben sind Quellenangaben mit eigenem Geltungsbereich, keine automatisch festgelegte Dosierung.`});
  }
  result.allCandidates.sort((a,b)=>b.weightedCoverage-a.weightedCoverage||b.matchedFactCount-a.matchedFactCount||b.repertoryCount-a.repertoryCount||(b.gradeComparison??-1)-(a.gradeComparison??-1)||a.remedyId.localeCompare(b.remedyId));
  const limit=request.limit??10;if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("Die Anzeigegrenze muss zwischen 1 und 100 liegen.");
  result.displayed=result.allCandidates.slice(0,limit);
  const last=result.displayed.at(-1);
  if(last)result.furtherTiedCandidates=result.allCandidates.slice(limit).filter(item=>item.weightedCoverage===last.weightedCoverage&&item.matchedFactCount===last.matchedFactCount&&item.repertoryCount===last.repertoryCount&&item.gradeComparison===last.gradeComparison).length;
  result.status=result.allCandidates.length?"comparison_ready":"needs_mapping";
  result.issues=[...new Set(issues)];
  return result;
}

export function assertCurrentHomeopathyResult(result:Result,patientId:string,inputRevision:string){
  if(result.patientId!==patientId||result.inputRevision!==inputRevision)throw Error("Repertorisation gehört zu einem anderen Fall oder einer überholten Eingabe.");
  if(result.visibility!=="admin_only")throw Error("Keine automatische öffentliche oder patientengerichtete Freigabe.");
}
