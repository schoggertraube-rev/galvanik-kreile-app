// Test transport metadata only. Diagnostics are not the business read whose
// failure a generated flow requests; no action IDs or payloads are guessed.
type ActionReference={filename?:string;exportedName?:string;workers?:Record<string,{filename?:string;exportedName?:string}>};
export function protocolDiagnosticActionIds(manifest:{node:Record<string,ActionReference>}):Set<string>{
 const ids=new Set<string>();
 for(const name of ['getProtocolLogAction','recordProtocolClicksAction']){
  const matches=Object.entries(manifest.node).filter(([,reference])=>[reference,...Object.values(reference.workers??{})].some(value=>value.exportedName===name&&typeof value.filename==='string'&&/(?:^|\/)src\/app\/actions\/logging\.actions\.ts$/.test(value.filename.replaceAll('\\','/'))));
  if(matches.length!==1)throw Error('FLOW_DIAGNOSTIC_ACTION_ID_AMBIGUOUS:'+name+':'+matches.length);
  ids.add(matches[0][0]);
 }
 return ids;
}
export function isApplicationDataLoad(request:{method:string;nextAction?:string;resourceType:string;rsc?:string},diagnostics:ReadonlySet<string>):boolean{
 return request.method==='POST'&&!!request.nextAction&&!diagnostics.has(request.nextAction)
  ||['fetch','xhr'].includes(request.resourceType)&&request.method==='GET'&&!request.rsc;
}
