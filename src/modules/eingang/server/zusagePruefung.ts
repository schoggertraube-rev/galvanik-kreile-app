import 'server-only';

import {ACCESS_AREA_LABELS,ROLE_LABELS,canAssignIntakeCustomer,canChangeOrderHandover,hasAuthorizationArea,hasLagerCapability,type AccessArea} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import type {IntakeSuggestionsInput,IntakeTermSuggestion,IntakePriceSuggestion,IntakeSuggestionReadOptions} from '@/lib/intakeSuggestionsContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {pruefeHerausgabe,type ZusageErgebnis} from '@/lib/server/commands/mailPromiseReleaseCommand';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {readIntakeCustomerDuplicate,searchOrderIntakeCustomers,type IntakeCustomerDuplicateDraft} from '@/lib/server/orderIntakeRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {normaliseOrderPositionUnit,orderPositionQuantityError,orderPositionUnitLabel} from '@/lib/orderPositionContract';
import type {QuoteReadback} from '@/modules/quotes/public';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {ORDER_STATION_COPY} from '@/ui/situationCatalog';
import {intakeCaptureSnapshot} from './intakeCapture';
import {readIntakeMessagesForAuthorization} from './intakeMessages';
import {readIntakeAutomaticReply} from './intakeOriginal';
import {readIncomingInvoice} from './incomingInvoice';
import {planeMailWirkungen} from './mailPlaene';
import {erlaubteWirkung} from './mailWirkungen';

export type ZusageInput={
  art:'herausgabe'|'termin'|'menge'|'auftrag_aus_kv'|'preis_im_text'|'storno'|'stammdaten'|'kanal_versand'|
    'zu_spaet'|'etikett'|'abholer'|'gewaehrleistung'|'preisquelle'|'dublette'|'beleg_dublette'|'abwesenheit'|'zahlungsavis';
  customerId?:string;
  orderId?:string;
  quoteId?:string;
  menge?:number;
  termin?:string;
  antwortBis?:string;
  sourceItemId?:string;
  sourceVersion?:number;
  kanal?:string;
  anliegen?:string;
  wirkung?:string;
  kundenentwurf?:IntakeCustomerDuplicateDraft;
  /** Positionen der vorhandenen Anfrage, sofern es noch keinen Auftrag oder KV gibt. */
  positionen?:IntakeSuggestionsInput['positions'];
};
export type {ZusageGrund,ZusageErgebnis} from '@/lib/server/commands/mailPromiseReleaseCommand';
export type ZusageLeser={
  termin:(auth:AuthorizationSnapshot,input:IntakeSuggestionsInput,options?:IntakeSuggestionReadOptions)=>Promise<{term:IntakeTermSuggestion|null;prices?:IntakePriceSuggestion[]}>;
  kv:(auth:AuthorizationSnapshot,quoteId:string)=>Promise<QuoteReadback|null>;
  verbrauch:(auth:AuthorizationSnapshot,orderId:string)=>Promise<readonly Materialverbrauch[]>;
  kunde:(auth:AuthorizationSnapshot,customerId:string)=>Promise<CustomerStoredProfile|null>;
};
type Materialverbrauch={wertEur:string|null;preisFehlt:boolean;vorlaeufig:boolean};

const unavailable={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable} as const;
const unknownTerm={frei:false,grund:'unbekannt_termin',text:MAIL_PROMISE_COPY.unknownTerm} as const;
const unknownQuote={frei:false,grund:'unbekannt_kv',text:MAIL_PROMISE_COPY.unknownQuote} as const;
const unknownChannel={frei:false,grund:'unbekannt_kanal',text:MAIL_PROMISE_COPY.unknownChannel} as const;
const unknownAbsence={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.abwesenheit} as const;
const unknownDocument={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.beleg_dublette} as const;
const unknownCustomer={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.dublette} as const;
const duplicateCustomer={frei:false,grund:'dublette',text:MAIL_PROMISE_COPY.duplicateCustomer} as const;
const foreignSender={frei:false,grund:'absender_fremd',text:MAIL_PROMISE_COPY.foreignSender} as const;
const optionalCustomer = (input:ZusageInput) => input.art==='preis_im_text'||input.art==='kanal_versand'||
  (input.art==='termin'&&!input.orderId&&!input.quoteId);

function fehlendesRecht(auth:AuthorizationSnapshot,art:ZusageInput['art']):AccessArea|null{
  if(!auth.active||!hasAuthorizationArea(auth,'mails'))return 'mails';
  switch(art){
    case 'herausgabe': case 'menge': case 'zu_spaet': case 'etikett': case 'abholer':
      return canChangeOrderHandover(auth,'mail')?null:'auftraege';
    case 'termin': case 'storno':
      return hasAuthorizationArea(auth,'auftraege')?null:'auftraege';
    case 'auftrag_aus_kv':
      return hasAuthorizationArea(auth,'auftraege')&&quoteOperationContext(auth).capabilities.canConvertQuote?null:'auftraege';
    case 'preis_im_text': case 'preisquelle':
      return hasAuthorizationArea(auth,'preise')?null:'preise';
    case 'zahlungsavis':
      return hasAuthorizationArea(auth,'zahlungen')?null:'zahlungen';
    case 'beleg_dublette':
      return hasAuthorizationArea(auth,'buchhaltung')?null:'buchhaltung';
    case 'dublette':
      return canAssignIntakeCustomer(auth)?null:hasAuthorizationArea(auth,'kunden')?'eingang':'kunden';
    default: return null;
  }
}

async function readIncomingOriginal(auth:AuthorizationSnapshot,input:ZusageInput){
  if(!input.sourceItemId)return null;
  const result=await readIntakeMessagesForAuthorization(auth,'alle',input.sourceItemId);
  if(result.code!=='OK'||result.messages.length!==1)return null;
  const [original]=result.messages;
  if(original.direction!=='rein'||input.sourceVersion!==undefined&&input.sourceVersion!==original.version)return null;
  const capture=await intakeCaptureSnapshot(auth,original.id);
  if(capture.code!=='OK'||capture.capture.version!==original.version)return null;
  const mime=capture.capture.files.filter(file=>file.mime==='message/rfc822'&&file.secured===true);
  if(original.channel==='mail'&&mime.length!==1)return null;
  return {...original,mimeFileId:original.channel==='mail'?mime[0].id:null};
}

async function qualifyCustomer(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser){
  const original=await readIncomingOriginal(auth,input);
  if(!original||!input.customerId||original.customerId!==input.customerId||
    original.assignment!=='bestaetigt'&&original.assignment!=='hand')return null;
  if(input.orderId&&original.orderId&&(original.orderKind!=='auftrag'||original.orderId!==input.orderId))return null;
  if(input.quoteId&&original.orderId&&(original.orderKind!=='kv'||original.orderId!==input.quoteId))return null;
  const customer=await leser.kunde(auth,input.customerId);
  const sender=original.senderAddress?.trim().toLowerCase();
  if(!customer||customer.id!==input.customerId||!sender)return null;
  const contacts=[customer.email,customer.billingEmail,customer.phone];
  return contacts.some(address=>address?.trim().toLowerCase()===sender)?{...original,customer}:null;
}

async function pruefeBelegDublette(auth:AuthorizationSnapshot,original:NonNullable<Awaited<ReturnType<typeof qualifyCustomer>>>):Promise<ZusageErgebnis>{
  const {customer}=original;
  if(customer.customerType!=='lieferant')return unknownDocument;
  const result=await readIncomingInvoice({id:original.id},{
    findSuppliers:(reader,query,by)=>searchOrderIntakeCustomers(reader,{query},{exactSupplier:by}),
    readCustomer:async(_tx,tenant,id)=>tenant===auth.tenantId&&id===customer.id?customer:null,
  },auth);
  if(result.code!=='OK')return unknownDocument;
  const {view}=result;
  if(view.item.id!==original.id||view.item.version!==original.version||view.supplier?.id!==customer.id||
    !view.fileId||!view.originals.some(file=>file.id===view.fileId)||!view.fields.nummer.trim())return unknownDocument;
  if(view.invoice||view.duplicate)return {frei:false,grund:'beleg_dublette',text:MAIL_PROMISE_COPY.duplicateDocument};
  return view.uncertain===0&&!view.conflict?{frei:true}:unknownDocument;
}

async function pruefeNeukundenDublette(auth:AuthorizationSnapshot,input:ZusageInput):Promise<ZusageErgebnis>{
  if(!Number.isSafeInteger(input.sourceVersion)||!input.kundenentwurf)return unknownCustomer;
  const original=await readIncomingOriginal(auth,input);
  if(!original||original.customerId||original.assignment!=='offen'||!original.openConcerns.includes('kv_anfrage'))return unknownCustomer;
  const observed=await readIntakeCustomerDuplicate(auth,input.kundenentwurf,original.senderAddress);
  if(observed==='missing')return unknownCustomer;
  return observed==='match'?duplicateCustomer:{frei:true};
}

async function readPromiseOrder(auth:AuthorizationSnapshot,input:ZusageInput){
  if(!input.orderId)return null;
  const source=await readLiveOrderCard(auth,{orderId:input.orderId});
  return source.code==='OK'&&(!input.customerId||input.customerId===source.data.customerId)?source.data:null;
}

async function readSuggestionInput(auth:AuthorizationSnapshot,input:ZusageInput,readQuote:ZusageLeser['kv']):Promise<IntakeSuggestionsInput|null>{
  if(input.orderId){
    const card=await readPromiseOrder(auth,input);
    if(!card?.handoverMode||!card.items.length)return null;
    return {kind:'ORDER',customerId:card.customerId,wishDate:input.termin??null,
      handoverMode:card.handoverMode,positions:card.items.map(item=>({
      key:item.id,catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,
      surfaceRequested:item.surfaceRequested,unit:item.unit,unitPriceCents:item.unitPriceCents,
    }))};
  }
  if(input.quoteId){
    const quote=await readQuote(auth,input.quoteId);
    if(!quote?.positions.length||quote.customerId!==input.customerId)return null;
    return {kind:'QUOTE',customerId:quote.customerId,wishDate:input.termin??null,positions:quote.positions.map(item=>({
      key:item.id,catalogServiceId:null,name:item.name,quantity:item.quantity,
      surfaceRequested:item.surfaceRequested,unit:item.unit??null,unitPriceCents:item.unitPriceCents,
      effortMinutes:item.plannedMinutes??null,
    }))};
  }
  if(!input.positionen?.length)return null;
  return {kind:'QUOTE',customerId:input.customerId??null,wishDate:input.termin??null,positions:input.positionen};
}

async function pruefeTermin(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser):Promise<ZusageErgebnis>{
  if(!input.termin)return unknownTerm;
  const request=await readSuggestionInput(auth,input,leser.kv);
  if(!request)return unknownTerm;
  const suggested=await leser.termin(auth,request);
  const term=suggested.term;
  if(!term?.achievableDate||!term.rating)return unknownTerm;
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
  if(!input.quoteId)return unknownQuote;
  const quote=await readQuote(auth,input.quoteId);
  if(!quote)return unknownQuote;
  if(input.customerId!==quote.customerId)return foreignSender;
  if(quote.linkedOrderId){
    const linked=await readPromiseOrder(auth,{...input,orderId:quote.linkedOrderId,customerId:quote.customerId});
    return linked?{frei:false,grund:'kv_schon_auftrag',text:MAIL_PROMISE_COPY.quoteAlreadyOrder(quote.quoteNumber,linked.orderNumber)}:unknownQuote;
  }
  const lifecycle=quote.lifecycle;
  if(lifecycle?.stage==='abgelaufen')return {frei:false,grund:'kv_abgelaufen',text:MAIL_PROMISE_COPY.quoteExpired(quote.quoteNumber)};
  if(!quote.positions.length||quote.positions.some(position=>orderPositionQuantityError(position.quantity,position.unit??null)))return unknownQuote;
  const difference=requestedQuantityBlock(input.menge,quote.positions);
  if(difference)return difference;
  return lifecycle?.stage==='zugesagt'&&lifecycle.acceptedEdition===lifecycle.edition?{frei:true}:unknownQuote;
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
  return {frei:false,grund:'storno',text:MAIL_PROMISE_COPY.cancellation(input.antwortBis),
    hinweis:MAIL_PROMISE_COPY.cancellationHint(card.orderNumber,ORDER_STATION_COPY[card.station]??ORDER_STATION_COPY.unknown,costs)};
}

function pruefeStammdaten(original:NonNullable<Awaited<ReturnType<typeof readIncomingOriginal>>>):ZusageErgebnis{
  const sender=original.senderName?.trim()||original.senderAddress?.trim();
  if(!sender||!planeMailWirkungen('A29',['bankverbindung_telefonisch_bestaetigen'],{}).length)return unavailable;
  const text=MAIL_PROMISE_COPY.verifyBankDetails(sender);
  return {frei:false,grund:'stammdaten',text,ausweg:{befehl:'saveIntakeTaskAction',text}};
}

async function pruefeFachZusage(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser):Promise<ZusageErgebnis>{
  if(input.art==='preis_im_text')return {frei:true};
  if(input.art==='kanal_versand')return input.kanal==='mail'?{frei:true}:unknownChannel;
  try{
    if(input.art==='dublette'&&!input.customerId)return await pruefeNeukundenDublette(auth,input);
    const customerRequired=!optionalCustomer(input);
    const original=customerRequired?await qualifyCustomer(auth,input,leser):null;
    if(customerRequired&&!original)return foreignSender;
    if(input.art==='dublette')return duplicateCustomer;
    if(input.art==='stammdaten'&&original)return pruefeStammdaten(original);
    if(input.art==='beleg_dublette'&&original)return await pruefeBelegDublette(auth,original);
    if(input.art==='abwesenheit'){
      if(!original?.mimeFileId)return unknownAbsence;
      const automatic=await readIntakeAutomaticReply(auth,{itemId:original.id,fileId:original.mimeFileId,version:original.version});
      return automatic===true?{frei:false,grund:'abwesenheit',text:MAIL_PROMISE_COPY.automaticReply}:unknownAbsence;
    }
    if(input.art==='storno')return await pruefeStorno(auth,input,leser.verbrauch);
    if(input.art==='termin')return await pruefeTermin(auth,input,leser);
    if(input.art==='menge')return await pruefeMenge(auth,input);
    if(input.art==='auftrag_aus_kv')return await pruefeKVAuftrag(auth,input,leser.kv);
    if(input.art==='zahlungsavis')return {frei:false,grund:'zahlungsavis',text:MAIL_PROMISE_COPY.paymentNotice};
    if(input.art==='preisquelle'){
      const request=await readSuggestionInput(auth,input,leser.kv);
      const prices=request?(await leser.termin(auth,request,{documentedPricesOnly:true})).prices:undefined;
      return request&&prices&&request.positions.every(position=>prices.some(price=>price.positionKey===position.key&&(price.source==='gleich'||price.source==='katalog')))
        ?{frei:true}:{frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unknownPriceSource};
    }
    if(input.art==='herausgabe'||input.art==='abholer'){
      if(!input.customerId||!input.orderId)return unavailable;
      const {customerId,orderId,antwortBis}=input;
      const result=await withPrivilegedTenantTransaction(auth,tx=>pruefeHerausgabe(tx,auth,{customerId,orderId,antwortBis}));
      return input.art==='abholer'&&result.frei?{...unavailable,text:MAIL_PROMISE_COPY.pending.abholer}:result;
    }
    if(Object.hasOwn(MAIL_PROMISE_COPY.pending,input.art)) return {frei:false,grund:'unbekannt',
      text:MAIL_PROMISE_COPY.pending[input.art as keyof typeof MAIL_PROMISE_COPY.pending]};
    return unavailable;
  }catch(error){
    console.error('[MAIL_PROMISE_SOURCE_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');
    if(input.art==='abwesenheit')return unknownAbsence;
    if(input.art==='beleg_dublette')return unknownDocument;
    if(input.art==='dublette')return unknownCustomer;
    return input.art==='termin'?unknownTerm:input.art==='auftrag_aus_kv'?unknownQuote:unavailable;
  }
}

/** An approved effect needs both its business evidence and its permitted mail action. */
export async function pruefeZusage(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser):Promise<ZusageErgebnis>{
  const recht=fehlendesRecht(auth,input.art);
  if(recht)return {frei:false,grund:recht==='preise'?'preisrecht':'recht',
    text:MAIL_PROMISE_COPY.roleRight(ROLE_LABELS[auth.role],ACCESS_AREA_LABELS[recht].text)};
  const {anliegen,wirkung}=input;
  if(anliegen===undefined&&wirkung===undefined)return pruefeFachZusage(auth,input,leser);
  if(typeof anliegen!=='string'||typeof wirkung!=='string')return unavailable;
  const ergebnis=await pruefeFachZusage(auth,input,leser);
  if(!ergebnis.frei)return ergebnis;
  return erlaubteWirkung(anliegen,wirkung,{
    preisrecht:hasAuthorizationArea(auth,'preise'),
    ...(input.art==='preisquelle'?{preisquelle:true}:{}),
    ...(input.art==='auftrag_aus_kv'?{kvAuftrag:true}:{}),
    ...(input.art==='dublette'&&!input.customerId?{dublette:false}:{}),
    ...(input.art==='beleg_dublette'&&wirkung==='rechnung_im_belegzugang_ablegen'?{belegDublette:false}:{}),
  })?ergebnis:unavailable;
}
