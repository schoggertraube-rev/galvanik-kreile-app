import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {readAuthorizedV45Action} from '@/lib/server/v45RuleRead';
import {readV45ActionValues} from '@/lib/server/v45ActionValuesRead';
import {readV45FirstLook} from '@/lib/server/v45FirstLookRead';
import {messageTone,type IntakeMessage,type readFallbackMessagePriority} from '../messageContract';
import {canAssignIntakeCustomer} from './intakeAssignment';

/** R13/PL22:06: the stored message and the existing priority/tone readers are
 * the sole facts. This is a partial U2 binding; unsupported specialist command
 * bindings remain explicit instead of guessing their target or a reply clock. */
export function readMessageNextAction(auth:AuthorizationSnapshot,row:IntakeMessage,priority:ReturnType<typeof readFallbackMessagePriority>){
 const source={kind:'intake' as const,id:row.id,version:row.version};
 if(priority.source.id!==row.id||priority.source.version!==row.version)return {code:'SOURCE_INCOMPLETE' as const,missing:['MESSAGE_VERSION'],source};
 const tone=messageTone(row),farbe=({rot:'ral',orange:'warn',navy:'info',gruen:'succ'} as const)[tone];
 const base={zustand:tone,farbe,nutzung:row.usage,zuordnung:row.assignment,source};
 let hauptaktion:null|{elementId:string;textKey:string;werte:Record<string,string|number>;befehl:{datei:string;funktion:string;argumente:Readonly<Record<string,unknown>>};recht:string|null}=null;
 let gesperrt:Array<{elementId:string;grundKey:string}>=[];
 if(priority.code==='OK'&&priority.rank===6){
  const selected=readAuthorizedV45Action(auth,'message.assign',{'message.assign':canAssignIntakeCustomer(auth)});
  if(selected.code!=='OK')return {...selected,...base};
  gesperrt=selected.gesperrt;
  if(selected.hauptaktion!==null){
   if(!('textKey' in selected)||typeof selected.textKey!=='string'||!('recht' in selected)||selected.recht!==null&&typeof selected.recht!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA'],...base};
   const values=readV45ActionValues(selected.textKey,{});if(values.code!=='OK')return {...values,...base};
   hauptaktion={elementId:selected.hauptaktion,textKey:selected.textKey,werte:values.werte,befehl:{datei:'src/app/actions/eingang.actions.ts',funktion:'getIntakeAssignmentAction',argumente:{itemId:row.id,mode:'normal'}},recht:selected.recht};
  }
 }else if(priority.code==='OK'&&priority.rank===2){
  if(!row.customerId)return {code:'SOURCE_INCOMPLETE' as const,missing:['MESSAGE_CUSTOMER'],prioritaet:priority.rank,...base};
  // The existing reply-target reader opens the real original and its bounded
  // customer choices (0/1/many); it neither accepts a quote nor invents a use ID.
  const selected=readAuthorizedV45Action(auth,'concern.act');
  if(selected.code!=='OK')return {...selected,...base};
  gesperrt=selected.gesperrt;
  if(selected.hauptaktion!==null){
   if(!('textKey' in selected)||typeof selected.textKey!=='string'||!('recht' in selected)||selected.recht!==null&&typeof selected.recht!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA'],...base};
   const values=readV45ActionValues(selected.textKey,{});if(values.code!=='OK')return {...values,...base};
   hauptaktion={elementId:selected.hauptaktion,textKey:selected.textKey,werte:values.werte,befehl:{datei:'src/app/actions/quotes.actions.ts',funktion:'readQuoteReplyTargetsAction',argumente:{sourceItemId:row.id,...(row.orderKind==='kv'&&row.orderId?{quoteId:row.orderId}:{})}},recht:selected.recht};
  }
 }else if(priority.code==='OK'&&priority.rank!==8)return {code:'SOURCE_INCOMPLETE' as const,missing:['MESSAGE_SPECIALIST_ACTION_BINDING'],prioritaet:priority.rank,...base};
 const first=readV45FirstLook('nachrichten',{
  'nachrichten.inhalt':{absenderName:row.senderName,absenderAdresse:row.senderAddress,betreff:row.subject,text:row.text,zeit:row.at,dateien:row.files},
  'nachrichten.kundenspalte':{id:row.customerId,name:row.customerName,typ:row.customerType},
  'nachrichten.hauptaktion':{elementId:hauptaktion?.elementId??null}
 });
 if(first.code!=='OK')return {...first,...base};
 return {code:'OK' as const,...base,prioritaet:priority.code==='OK'?priority.rank:null,erstblick:first.erstblick,hauptaktion,gesperrt,
  datenluecken:priority.code==='OK'?[]:priority.missing,weitereStatus:'SOURCE_INCOMPLETE' as const,
  quelle:{priority:'PL02:25',tone:'R13/PL22:06',elementeSha256:first.quelle.sha256}};
}
