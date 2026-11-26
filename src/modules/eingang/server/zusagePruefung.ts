import 'server-only';

import {canChangeOrderHandover,hasAuthorizationArea,hasLagerCapability} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import type {IntakeSuggestionsInput,IntakeTermSuggestion} from '@/lib/intakeSuggestionsContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {pruefeHerausgabe,type ZusageErgebnis} from '@/lib/server/commands/mailPromiseReleaseCommand';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {normaliseOrderPositionUnit,orderPositionQuantityError,orderPositionUnitLabel} from '@/lib/orderPositionContract';
import type {QuoteReadback} from '@/modules/quotes/public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {ORDER_STATION_COPY} from '@/ui/situationCatalog';
import {intakeCaptureSnapshot} from './intakeCapture';
import {readIntakeMessagesForAuthorization} from './intakeMessages';

export type ZusageInput={
  art:'herausgabe'|'termin'|'menge'|'auftrag_aus_kv'|'preis_im_text'|'storno'|'stammdaten'|'kanal_versand';
  customerId?:string;
  orderId?:string;
  menge?:number;
  termin?:string;
  sourceItemId?:string;
  kanal?:string;
};
export {recordZusageAusnahmeInTransaction,type ZusageGrund,type ZusageErgebnis} from '@/lib/server/commands/mailPromiseReleaseCommand';
export type ZusageLeser={
  termin:(auth:AuthorizationSnapshot,input:IntakeSuggestionsInput)=>Promise<{term:IntakeTermSuggestion|null}>;
  kv:(auth:AuthorizationSnapshot,quoteId:string)=>Promise<QuoteReadback|null>;
  verbrauch:(auth:AuthorizationSnapshot,orderId:string)=>Promise<readonly Materialverbrauch[]>;
};
type Materialverbrauch={wertEur:string|null;preisFehlt:boolean;vorlaeufig:boolean};

const unavailable={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable} as const;
const permission={frei:false,grund:'recht',text:MAIL_PROMISE_COPY.handoverRight} as const;

async function readPromiseOrder(auth:AuthorizationSnapshot,input:ZusageInput){
  if(!input.orderId)return null;
  const source=await readLiveOrderCard(auth,{orderId:input.orderId});
  return source.code==='OK'&&(!input.customerId||input.customerId===source.data.customerId)?source.data:null;
}

async function pruefeTermin(auth:AuthorizationSnapshot,input:ZusageInput,readTerm:ZusageLeser['termin']):Promise<ZusageErgebnis>{
  if(!input.termin)return unavailable;
  const card=await readPromiseOrder(auth,input);
  if(!card)return unavailable;
  if(!card.handoverMode||card.items.some(item=>item.unitPriceCents===null))return unavailable;
  const suggested=await readTerm(auth,{kind:'ORDER',customerId:card.customerId,wishDate:input.termin,
    handoverMode:card.handoverMode,positions:card.items.map(item=>({
      key:item.id,catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,
      surfaceRequested:item.surfaceRequested,unit:item.unit,unitPriceCents:item.unitPriceCents,
    }))});
  const term=suggested.term;
  if(!term?.achievableDate||!term.rating)return unavailable;
  if(term.rating==='nicht_machbar'||term.rating==='unmoeglich')return {
    frei:false,grund:'termin',text:MAIL_PROMISE_COPY.earliestTerm(input.termin,term.achievableDate),
  };
  return {frei:true};
}

type PromisePosition={quantity:number;unit?:string|null};
// The existing position contract admits up to three decimal places.
const quantityMilli=(quantity:number)=>Math.round(quantity*1000);

function requestedQuantityBlock(requested:number|undefined,positions:readonly PromisePosition[]):ZusageErgebnis|null{
  if(requested===undefined)return null;
  const unit=normaliseOrderPositionUnit(positions[0]?.unit);
  if(!unit||orderPositionQuantityError(requested,unit)||positions.some(position=>normaliseOrderPositionUnit(position.unit)!==unit))return unavailable;
  const total=positions.reduce((sum,position)=>sum+quantityMilli(position.quantity),0);
  return quantityMilli(requested)===total?null:{frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityMismatch(requested,total/1000)};
}

async function pruefeMenge(auth:AuthorizationSnapshot,input:ZusageInput):Promise<ZusageErgebnis>{
  const card=await readPromiseOrder(auth,input);
  if(!card?.items.length)return unavailable;
  const groups=new Map<string,{ware:string;fertig:number;gesamt:number}>();
  for(const item of card.items){
    if(orderPositionQuantityError(item.quantity,item.unit))return unavailable;
    const unit=normaliseOrderPositionUnit(item.unit);
    const key=JSON.stringify([item.name,unit]);
    const group=groups.get(key)??{ware:unit?`${orderPositionUnitLabel(unit)} ${item.name}`:item.name,fertig:0,gesamt:0};
    const amount=quantityMilli(item.quantity);
    group.gesamt+=amount;
    if(item.finished)group.fertig+=amount;
    groups.set(key,group);
  }
  const notReady=[...groups.values()].filter(group=>group.fertig<group.gesamt);
  if(notReady.length)return {frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityNotReady(notReady.map(group=>({
    ...group,fertig:group.fertig/1000,gesamt:group.gesamt/1000,
  })))};
  return requestedQuantityBlock(input.menge,card.items)??{frei:true};
}

async function pruefeKVAuftrag(auth:AuthorizationSnapshot,input:ZusageInput,readQuote:ZusageLeser['kv']):Promise<ZusageErgebnis>{
  if(!input.orderId)return unavailable;
  const quote=await readQuote(auth,input.orderId);
  if(!quote||input.customerId&&input.customerId!==quote.customerId)return unavailable;
  if(quote.linkedOrderId){
    const linked=await readPromiseOrder(auth,{...input,orderId:quote.linkedOrderId,customerId:quote.customerId});
    return linked?{frei:false,grund:'kv_schon_auftrag',text:MAIL_PROMISE_COPY.quoteAlreadyOrder(quote.quoteNumber,linked.orderNumber)}:unavailable;
  }
  const lifecycle=quote.lifecycle;
  if(lifecycle?.stage==='abgelaufen')return {frei:false,grund:'kv_abgelaufen',text:MAIL_PROMISE_COPY.quoteExpired(quote.quoteNumber)};
  if(!quote.positions.length||quote.positions.some(position=>orderPositionQuantityError(position.quantity,position.unit??null)))return unavailable;
  const difference=requestedQuantityBlock(input.menge,quote.positions);
  if(difference)return difference;
  return lifecycle?.stage==='zugesagt'&&lifecycle.acceptedEdition===lifecycle.edition?{frei:true}:unavailable;
}

function materialkosten(rows:readonly Materialverbrauch[]):string|null{
  let cents=0;
  for(const row of rows){
    if(row.preisFehlt||row.vorlaeufig||row.wertEur===null)return null;
    const digits=/^(\d+)(?:\.(\d{1,2}))?$/.exec(row.wertEur);
    if(!digits)return null;
    cents+=Number(digits[1]+(digits[2]??'').padEnd(2,'0'));
    if(!Number.isSafeInteger(cents))return null;
  }
  return rows.length?formatEuro(cents):null;
}

async function pruefeStorno(auth:AuthorizationSnapshot,input:ZusageInput,readVerbrauch:ZusageLeser['verbrauch']):Promise<ZusageErgebnis>{
  const card=await readPromiseOrder(auth,input);
  if(!card)return unavailable;
  const costs=auth.packageSwitches?.p4_lager===true&&hasLagerCapability(auth,'lager.werte')
    ?materialkosten(await readVerbrauch(auth,card.id)):null;
  return {frei:false,grund:'storno',text:MAIL_PROMISE_COPY.cancellation(card.orderNumber,ORDER_STATION_COPY[card.station]??ORDER_STATION_COPY.unknown,costs)};
}

async function pruefeStammdaten(auth:AuthorizationSnapshot,input:ZusageInput):Promise<ZusageErgebnis>{
  if(!input.sourceItemId)return unavailable;
  const result=await readIntakeMessagesForAuthorization(auth,'alle',input.sourceItemId);
  if(result.code!=='OK'||result.messages.length!==1)return unavailable;
  const [original]=result.messages;
  if(original.channel!=='mail'||original.direction!=='rein'||input.customerId&&original.customerId!==input.customerId)return unavailable;
  const capture=await intakeCaptureSnapshot(auth,original.id);
  if(capture.code!=='OK'||capture.capture.version!==original.version||
    !capture.capture.files.some(file=>file.mime==='message/rfc822'&&file.secured===true))return unavailable;
  const sender=original.senderName?.trim()||original.senderAddress?.trim();
  if(!sender)return unavailable;
  const text=MAIL_PROMISE_COPY.verifyBankDetails(sender);
  return {frei:false,grund:'stammdaten',text,ausweg:{befehl:'saveIntakeTaskAction',text}};
}

/** Mail uses the established payment and goods-out evidence before making a promise. */
export async function pruefeZusage(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser):Promise<ZusageErgebnis>{
  if(!hasAuthorizationArea(auth,'mails'))return permission;
  if(input.art==='preis_im_text')return hasAuthorizationArea(auth,'preise')?{frei:true}:
    {frei:false,grund:'preisrecht',text:MAIL_PROMISE_COPY.priceRight};
  if(input.art==='kanal_versand')return input.kanal==='mail'?{frei:true}:unavailable;
  try{
    if(input.art==='stammdaten')return await pruefeStammdaten(auth,input);
    if(!canChangeOrderHandover(auth,'mail'))return permission;
    if(input.art==='storno')return await pruefeStorno(auth,input,leser.verbrauch);
    if(input.art==='termin')return await pruefeTermin(auth,input,leser.termin);
    if(input.art==='menge')return await pruefeMenge(auth,input);
    if(input.art==='auftrag_aus_kv')return await pruefeKVAuftrag(auth,input,leser.kv);
    if(input.art!=='herausgabe'||!input.customerId||!input.orderId)return unavailable;
    const {customerId,orderId}=input;
    return await withPrivilegedTenantTransaction(auth,tx=>pruefeHerausgabe(tx,auth,{customerId,orderId}));
  }catch(error){
    console.error('[MAIL_PROMISE_SOURCE_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');
    return unavailable;
  }
}
