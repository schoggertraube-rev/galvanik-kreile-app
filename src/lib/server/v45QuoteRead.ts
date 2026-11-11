import 'server-only';
import type {QuoteReadback} from '@/modules/quotes/public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import type {AuthorizationSnapshot} from './authorization';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45FirstLook} from './v45FirstLookRead';
import {quoteCommandContext} from './quoteAuthorization';
import {readV45QuoteCommand} from './v45QuoteCommandRead';
import {readV45ActionValues} from './v45ActionValuesRead';
import {V45_SOURCE_HASHES} from '@/ui/v45.generated';

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
export function readV45QuoteRule(auth:AuthorizationSnapshot,quote:QuoteReadback){
 const source={kind:'quote' as const,id:quote.quoteId,version:quote.version,edition:quote.lifecycle?.edition??null};
 const rule=readAuthorizedV45Rule(auth,'kv',v45QuoteFacts(quote));if(rule.code!=='OK')return {...rule,source};
 if(!quote.lifecycle)return {code:'SOURCE_INCOMPLETE' as const,missing:['QUOTE_LIFECYCLE'],source};
 const financial=quoteCommandContext(auth).capabilities.canReadQuote;
 const values:Record<string,Readonly<Record<string,unknown>>>={
  'kv.lage':{nummer:quote.quoteNumber,fassung:quote.lifecycle.edition,zustand:rule.zustand},
  'kv.teile':{teile:quote.positions.map(part=>({id:part.id,name:part.name,menge:part.quantity,material:part.material,oberflaeche:part.surfaceRequested,...(part.unit!==undefined?{einheit:part.unit}:{})}))},
  'kv.termin':{datum:quote.dueDate,terminstatus:quote.termStatus,gueltigBis:quote.validUntil},
  'kv.hauptaktion':{elementId:rule.hauptaktion}
 };
 if(financial)values['kv.kalkulation']={nettoCents:quote.totalNetCents};
 const first=readV45FirstLook('kv',values,financial?[]:['kv.kalkulation']);if(first.code!=='OK')return {...first,source};
 let hauptaktion:null|{elementId:string;textKey:string;werte:Record<string,string|number>;befehl:NonNullable<ReturnType<typeof readV45QuoteCommand>>;recht:string|null}=null;
 if(rule.hauptaktion!==null){
  if(!('textKey' in rule)||typeof rule.textKey!=='string'||!('recht' in rule)||rule.recht!==null&&typeof rule.recht!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA'],source};
  const befehl=readV45QuoteCommand(rule.hauptaktion);if(!befehl)return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_COMMAND'],source};
  // V45 kern.js/mainVars: current edition and first actual stored goods location.
  // Missing location stays absent; there is no empty preview fallback.
  const parameters=readV45ActionValues(rule.textKey,{number:quote.quoteNumber,name:quote.customerDisplayName,edition:quote.lifecycle.edition,...(quote.lifecycle.goods?.[0]?{location:quote.lifecycle.goods[0].location}:{})});
  if(parameters.code!=='OK')return {...parameters,source};
  hauptaktion={elementId:rule.hauptaktion,textKey:rule.textKey,werte:parameters.werte,befehl,recht:rule.recht};
 }
 return {code:'OK' as const,ruleId:rule.ruleId,zustand:rule.zustand,farbe:rule.farbe,aktionsfarbe:rule.aktionsfarbe,erstblick:first.erstblick,hauptaktion,gesperrt:rule.gesperrt,quelle:{...rule.quelle,elementeSha256:first.quelle.sha256,texteSha256:V45_SOURCE_HASHES['texte.json']},source};
}
