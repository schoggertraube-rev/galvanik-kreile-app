import 'server-only';
import {V45_REFERENCE_STATES,V45_SOURCE_HASHES} from '@/ui/v45.generated';

/** An empty alternative list is a source fact, not a default. Non-empty or
 * conflicting reference conditions need their own binding before they can be
 * projected. Person labels never stand in for the canonical authorization. */
export function readV45ObjectActionAbsence(area:string,state:string){
 const source=V45_REFERENCE_STATES as {faelle?:unknown};
 if(!source||!Array.isArray(source.faelle))return {code:'SOURCE_INCOMPLETE' as const,missing:['OBJECT_ACTION_METADATA']};
 const rows=source.faelle.filter((value:unknown)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;return typeof row.fall==='string'&&row.fall.startsWith(area+'.')&&row.zustand===state;
 }) as Array<Record<string,unknown>>;
 if(!rows.length)return {code:'SOURCE_INCOMPLETE' as const,missing:['OBJECT_ACTION_CONTEXT']};
 if(rows.some(row=>!Array.isArray(row.weitere_objektaktionen)||!Array.isArray(row.gesperrt)))return {code:'SOURCE_INCOMPLETE' as const,missing:['OBJECT_ACTION_METADATA']};
 if(rows.some(row=>(row.weitere_objektaktionen as unknown[]).length||(row.gesperrt as unknown[]).length))return {code:'SOURCE_INCOMPLETE' as const,missing:['OBJECT_ACTION_BINDING']};
 return {code:'OK' as const,weitere:[],quelle:{sha256:V45_SOURCE_HASHES['ERWARTUNG.json']}};
}
