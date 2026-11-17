import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {ClientDiagnosticFact,ClientMissedFact,LoggingSettingsReader,TechnicalEvent,ProtocolReply,ProtocolRejection} from '../public';
import {parseClientDiagnostic,parseClientMissed} from '../clientErrorCodes';
import {parseClick,PROTOCOL_EVENT_ID} from '../clickContract';
import {logTechnical,logTechnicalReceipt} from './protocol';
import {logClick} from './click';

function event(fact:ClientDiagnosticFact):TechnicalEvent{return {type:'server_error',command:fact.command,subject:{type:'action',id:fact.command},occurredAt:fact.occurredAt,reason:'UNKNOWN'};}
function lossEvent(fact:ClientMissedFact):TechnicalEvent{return {type:'server_error',command:'PROTOCOL_CLIENT_ENTRIES_MISSED',subject:{type:'protocol_loss',id:fact.id+':'+fact.count},occurredAt:fact.occurredAt,reason:'UNKNOWN'};}
function parsed(value:unknown){if(value&&typeof value==='object'&&'kind'in value){if(value.kind==='error')return parseClientDiagnostic(value);if(value.kind==='missed')return parseClientMissed(value);return null;}return parseClick(value);}
/** One diagnostic transport and the existing two sinks. Per-entry final rejects
 * are explicit; unavailable originals remain available for the next retry. */
export async function logClientDiagnostics(auth:AuthorizationSnapshot|null,input:unknown,readSettings:LoggingSettingsReader):Promise<ProtocolReply>{
 if(!Array.isArray(input)||!input.length||input.length>50)return {code:'VALIDATION_ERROR',accepted:[],rejected:[]};
 const accepted:string[]=[],rejected:ProtocolRejection[]=[],clicks:unknown[]=[],seen=new Set<string>();let unavailable=false;
 for(const value of input){
  const id=value&&typeof value==='object'&&typeof value.id==='string'&&PROTOCOL_EVENT_ID.test(value.id)?value.id:null;
  if(!id)continue;
  if(seen.has(id))continue;seen.add(id);
  const fact=parsed(value),sameKey=input.filter(row=>row&&typeof row==='object'&&row.id===id);
  if(sameKey.some(row=>JSON.stringify(parsed(row))!==JSON.stringify(fact))){rejected.push({id,code:'CONFLICT'});continue;}
  if(!fact){rejected.push({id,code:'VALIDATION_ERROR'});continue;}
  if(!('kind'in fact)){if(auth)clicks.push(fact);else rejected.push({id,code:'VALIDATION_ERROR'});continue;}
  const technical=fact.kind==='error'?event(fact):lossEvent(fact),count=fact.kind==='missed'?fact.count:0;
  if(!auth){await logTechnical(null,technical,fact.id,count);accepted.push(id);continue;}
  const result=await logTechnicalReceipt(auth,technical,fact.id,count);
  if(result.code==='OK')accepted.push(id);
  else if(result.code==='UNAVAILABLE')unavailable=true;
  else rejected.push({id,code:result.code});
 }
 if(auth&&clicks.length){
  const result=await logClick(auth,clicks,readSettings);accepted.push(...(result.accepted??[]));rejected.push(...(result.rejected??[]));if(result.code==='UNAVAILABLE')unavailable=true;
 }
 const code=unavailable?'UNAVAILABLE':accepted.length?(auth?'OK':'COUNTED'):rejected[0]?.code??'VALIDATION_ERROR';
 return {code,accepted,rejected};
}
