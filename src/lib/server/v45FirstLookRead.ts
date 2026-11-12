import 'server-only';
import {V45_ELEMENTS,V45_REFERENCE_STATES,V45_SOURCE_HASHES} from '@/ui/v45.generated';

/** Derive only the field order from the existing V45 occurrence metadata.
 * No example values or person-to-role mapping enter the result. An incomplete
 * or contradictory order stays unavailable rather than choosing a new layout. */
export function readV45FirstLook(area:string,values:Readonly<Record<string,Readonly<Record<string,unknown>>>>,hiddenKeys:readonly string[]=[],state?:string,partial=false){
 const declared=V45_ELEMENTS.filter(row=>row.id.startsWith(area+'.'));
 if(declared.some(row=>typeof row.zaehlt_als_info!=='boolean'||row.zaehlt_als_info&&(typeof row.tiefe!=='number'||!Array.isArray(row.reihenfolge))))return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_METADATA']};
 let contexts:Set<string>|undefined;
 if(state!==undefined){
  const references=V45_REFERENCE_STATES as {faelle?:unknown};
  if(!Array.isArray(references?.faelle))return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_CONTEXT']};
  contexts=new Set(references.faelle.flatMap((value:unknown)=>{
   if(!value||typeof value!=='object'||Array.isArray(value))return [];
   const row=value as Record<string,unknown>;
   return typeof row.fall==='string'&&row.fall.startsWith(area+'.')&&row.zustand===state?[row.fall]:[];
  }));
  if(!contexts.size){if(!partial)return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_CONTEXT']};contexts=undefined;}
 }
 const inContext=(value:unknown)=>!contexts||!!value&&typeof value==='object'&&!Array.isArray(value)&&contexts.has(String((value as Record<string,unknown>).zustand));
 const fields=declared.filter(row=>row.tiefe===1&&row.zaehlt_als_info&&Array.isArray(row.reihenfolge)&&row.reihenfolge.some(inContext));
 const allKeys=new Set(fields.map(row=>row.id));
 if(!fields.length||hiddenKeys.some(key=>!allKeys.has(key)))return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_METADATA']};
 const hidden=new Set(hiddenKeys),keys=[...allKeys].filter(key=>!hidden.has(key));
 if(keys.length>5)return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_LIMIT']};
 const groups=new Map<string,Array<{key:string;position:number}>>();
 for(const field of fields){
  if(hidden.has(field.id))continue;
  for(const value of field.reihenfolge as unknown[]){
   if(!value||typeof value!=='object'||Array.isArray(value))return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_METADATA']};
   const occurrence=value as Record<string,unknown>;
   if(occurrence.tiefe!==1||!inContext(value))continue;
   if(typeof occurrence.zustand!=='string'||typeof occurrence.rolle!=='string'||typeof occurrence.geraet!=='string'||typeof occurrence.reihenfolge!=='number'||!Number.isSafeInteger(occurrence.reihenfolge))return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_METADATA']};
   const scope=JSON.stringify([occurrence.zustand,occurrence.rolle,occurrence.geraet]);
   const rows=groups.get(scope)??[];
   if(!rows.some(row=>row.key===field.id&&row.position===occurrence.reihenfolge))rows.push({key:field.id,position:occurrence.reihenfolge});
   groups.set(scope,rows);
  }
 }
 const edges=new Map(keys.map(key=>[key,new Set<string>()]));
 for(const rows of groups.values()){
  rows.sort((a,b)=>a.position-b.position);
  for(let i=1;i<rows.length;i++){
   if(rows[i].position===rows[i-1].position||rows[i].key===rows[i-1].key)return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_ORDER']};
   edges.get(rows[i-1].key)!.add(rows[i].key);
  }
 }
 const remaining=new Set(keys),ordered:string[]=[];
 while(remaining.size){
  const roots=[...remaining].filter(key=>![...remaining].some(other=>edges.get(other)!.has(key)));
  if(roots.length!==1)return {code:'SOURCE_INCOMPLETE' as const,missing:['FIRST_LOOK_ORDER']};
  ordered.push(roots[0]);remaining.delete(roots[0]);
 }
 const missing=ordered.filter(key=>!Object.hasOwn(values,key)||values[key]===null||typeof values[key]!=='object'||Array.isArray(values[key]));
 if(missing.length&&!partial)return {code:'SOURCE_INCOMPLETE' as const,missing};
 return {code:'OK' as const,datenluecken:missing,erstblick:ordered.filter(key=>!missing.includes(key)).map(key=>({key,werte:values[key]})),quelle:{sha256:V45_SOURCE_HASHES['elemente.json']}};
}
