import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {ClientDiagnosticFact,LoggingSettingsReader,TechnicalEvent} from '../public';
import {parseClientDiagnostic} from '../clientErrorCodes';
import {logTechnical} from './protocol';
import {logClick} from './click';

function event(fact:ClientDiagnosticFact):TechnicalEvent{
 return {type:'server_error',command:fact.command,subject:{type:'action',id:fact.command},occurredAt:fact.occurredAt,reason:'UNKNOWN'};
}
/** One diagnostic transport, existing two sinks. Errors never consult the click flag. */
export async function logClientDiagnostics(auth:AuthorizationSnapshot|null,input:unknown,readSettings:LoggingSettingsReader){
 if(!Array.isArray(input)||!input.length||input.length>50)return {code:'VALIDATION_ERROR' as const};
 const errors:ClientDiagnosticFact[]=[],clicks:unknown[]=[];
 for(const value of input){
  if(value&&typeof value==='object'&&value.kind==='error'){
   const parsed=parseClientDiagnostic(value);if(!parsed)return {code:'VALIDATION_ERROR' as const};errors.push(parsed);
  }else clicks.push(value);
 }
 if(!auth){
  if(clicks.length||new Set(errors.map(row=>row.id)).size!==errors.length)return {code:'VALIDATION_ERROR' as const};
  // PL14:51: no substituted tenant/user or table row for an unknown origin.
  // This acknowledgement means counted in this instance, never persisted.
  for(const fact of errors)await logTechnical(null,event(fact));
  return {code:'COUNTED' as const,accepted:errors.map(row=>row.id)};
 }
 if(!errors.length)return logClick(auth,input,readSettings);
 const ids=input.map(row=>row&&typeof row==='object'?row.id:undefined);
 if(new Set(ids).size!==ids.length)return {code:'VALIDATION_ERROR' as const};
 const accepted:string[]=[];
 for(const fact of errors){
  if(!await logTechnical(auth,event(fact),fact.id))return accepted.length?{code:'UNAVAILABLE' as const,accepted}:{code:'UNAVAILABLE' as const};
  accepted.push(fact.id);
 }
 if(!clicks.length)return {code:'OK' as const,accepted};
 const result=await logClick(auth,clicks,readSettings);
 if(result.code==='OK')return {code:'OK' as const,accepted:[...accepted,...result.accepted]};
 return {...result,accepted};
}
