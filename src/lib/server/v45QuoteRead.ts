import {completeU2Read} from '@/lib/domain/u2ReadContract';
import 'server-only';
import type {QuoteReadback} from '@/modules/quotes/public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45FirstLook} from './v45FirstLookRead';
import {readV45QuoteCommand} from './v45QuoteCommandRead';
import {readV45ActionValues} from './v45ActionValuesRead';
import {V45_SOURCE_HASHES} from '@/ui/v45.generated';
import {readV45ObjectActionAbsence} from './v45ObjectActionsRead';

/** V45 quoteFacts, projected from the existing validated quote read port.
 * Historical editions never stand in for the current promise. Missing lifecycle
 * evidence stays missing; the ordered rule reader decides whether it is needed.
 */
export function v45QuoteFacts(quote:Pick<QuoteReadback,'linkedOrderId'|'validUntil'|'lifecycle'>,now=new Date()):Readonly<Record<string,unknown>>{
 const life=quote.lifecycle,converted=Boolean(quote.linkedOrderId);
 const past=quote.validUntil!==null&&quote.validUntil<berlinCalendarDay(now);
 const facts:Record<string,unknown>={converted,...(!past||converted?{expired:false}:{})};
 if(!life)return facts;
 const conditional=life.conditional?.edition===life.edition;
 const accepted=life.acceptedEdition===life.edition&&!conditional;
 // PL 11.11.09:00: validity only limits acceptance, not an existing promise.
 // Keep frozen V45 files untouched; the PL records this in NACHTRAG_PL.
 return {...facts,expired:past&&!converted&&!accepted,rejected:life.declinedAt!==null,conditional,sent:life.sentEdition===life.edition,accepted,
  ...(Array.isArray(life.goods)?{goods:life.goods.length>0}:{})};
}

/** Server-only U2 composition seam, receiving the validated operational readback
 * from the existing quote action. Only whitelisted display values escape;
 * financial fields use the same canonical quote capability as that action.
 * First-look order comes from V45 metadata, values from this same readback.
 * Commands remain the existing action boundaries; this reader never calls them.
 */
function readV45QuoteRuleRaw(auth:AuthorizationSnapshot,quote:QuoteReadback,capabilities:{financial:boolean;commandRights:Readonly<Record<string,boolean>>}){
 const source={kind:'quote' as const,id:quote.quoteId,version:quote.version,edition:quote.lifecycle?.edition??null};
 const rule=readAuthorizedV45Rule(auth,'kv',v45QuoteFacts(quote),capabilities.commandRights);

 const financial=hasAuthorizationArea(auth,'geld');
 const values:Record<string,Readonly<Record<string,unknown>>>={
  'kv.lage':{nummer:quote.quoteNumber,fassung:quote.lifecycle?.edition??null,zustand:rule.code==='OK'?rule.zustand:null},
  'kv.teile':{teile:quote.positions.map(part=>({id:part.id,name:part.name,menge:part.quantity,material:part.material,oberflaeche:part.surfaceRequested,...(part.unit!==undefined?{einheit:part.unit}:{})}))},
  'kv.termin':{datum:quote.dueDate,terminstatus:quote.termStatus,gueltigBis:quote.validUntil},
  'kv.hauptaktion':{elementId:rule.code==='OK'?rule.hauptaktion:null}
 };
 if(financial)values['kv.kalkulation']={nettoCents:quote.totalNetCents};
 const first=readV45FirstLook('kv',values,financial?[]:['kv.kalkulation'],rule.code==='OK'?rule.zustand:undefined,true);if(first.code!=='OK')return {...first,source};
 const presentation={datenluecken:first.datenluecken,erstblick:first.erstblick,source};
 const withheld={...presentation,erstblick:first.erstblick.map(field=>field.key==='kv.hauptaktion'?{...field,werte:{elementId:null}}:field),hauptaktion:null};
 if(rule.code!=='OK')return {...rule,...withheld};
 if(!quote.lifecycle)return {code:'SOURCE_INCOMPLETE' as const,missing:['QUOTE_LIFECYCLE'],...withheld};
 const objectActions=readV45ObjectActionAbsence('kv',rule.zustand);if(objectActions.code!=='OK')return {...objectActions,...withheld};
 let hauptaktion:null|{elementId:string;textKey:string;werte:Record<string,string|number>;befehl:NonNullable<ReturnType<typeof readV45QuoteCommand>>;recht:string|null}=null;
 if(rule.hauptaktion!==null){
  if(!('textKey' in rule)||typeof rule.textKey!=='string'||!('recht' in rule)||rule.recht!==null&&typeof rule.recht!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA'],...withheld};
  const befehl=readV45QuoteCommand(rule.hauptaktion,quote);if(!befehl)return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_COMMAND'],...withheld};
  // V45 kern.js/mainVars: current edition and first actual stored goods location.
  // Missing location stays absent; there is no empty preview fallback.
  const parameters=readV45ActionValues(rule.textKey,{number:quote.quoteNumber,name:quote.customerDisplayName,edition:quote.lifecycle.edition,...(quote.lifecycle.goods?.[0]?{location:quote.lifecycle.goods[0].location}:{})});
  if(parameters.code!=='OK')return {...parameters,...withheld};
  hauptaktion={elementId:rule.hauptaktion,textKey:rule.textKey,werte:parameters.werte,befehl,recht:rule.recht};
 }
 return {code:'OK' as const,ruleId:rule.ruleId,zustand:rule.zustand,farbe:rule.farbe,aktionsfarbe:rule.aktionsfarbe,erstblick:first.erstblick,datenluecken:first.datenluecken,hauptaktion,weitere:objectActions.weitere,gesperrt:rule.gesperrt,quelle:{...rule.quelle,elementeSha256:first.quelle.sha256,texteSha256:V45_SOURCE_HASHES['texte.json'],erwartungSha256:objectActions.quelle.sha256},source};
}

export function readV45QuoteRule(...args:Parameters<typeof readV45QuoteRuleRaw>){return completeU2Read(readV45QuoteRuleRaw(...args));}
