import {completeU2Read} from '@/lib/domain/u2ReadContract';
import 'server-only';
import type {EvidenceReadRecord} from './evidenceRead';
import type {LiveOrderCard} from './orderCardRead';
import type {AuthorizationSnapshot} from './authorization';
import {canTransportInvoiceDocument} from '@/lib/auth/authorizationContract';
import type {readOrderInformed} from './orderReleaseRead';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45FirstLook} from './v45FirstLookRead';
import {readV45ActionValues} from './v45ActionValuesRead';
import {readV45ObjectActionAbsence} from './v45ObjectActionsRead';

type OrderCommand={datei:string;funktion:string;argumente:Readonly<Record<string,unknown>>};
type OrderContext={card:Pick<LiveOrderCard,'id'|'version'|'customerId'|'handoverMode'|'operationalFacts'>;part?:{id:string};invoiceMailOriginals?:readonly {id:string;orderId:string;version:number}[]};
const orderCommand=<N extends keyof typeof import('@/app/actions/orders.actions')>(funktion:N,argumente:Readonly<Record<string,unknown>>):OrderCommand=>({datei:'src/app/actions/orders.actions.ts',funktion,argumente});
const invoiceCommand=<N extends keyof typeof import('@/app/actions/invoices.actions')>(funktion:N,argumente:Readonly<Record<string,unknown>>):OrderCommand=>({datei:'src/app/actions/invoices.actions.ts',funktion,argumente});
const customerCommand=<N extends keyof typeof import('@/app/actions/customers.actions')>(funktion:N,argumente:Readonly<Record<string,unknown>>):OrderCommand=>({datei:'src/app/actions/customers.actions.ts',funktion,argumente});
/** PL04:16: one source-bound station/command table. Null keeps a not-yet-bound
 * command explicit; never substitute generic mail or unrelated goods return. */
const ORDER_U2_BINDINGS={
 stations:{angenommen:'wareneingang'} as Readonly<Record<string,string>>,
 commands:{
  'order.start':({card}:OrderContext)=>orderCommand('transitionWareneingangToGalvanikAction',{orderId:card.id,expectedVersion:card.version}),
  'order.photo':({card,part}:OrderContext):OrderCommand|null=>part?{datei:'src/app/warendurchlauf/actions.ts',funktion:'reserveGalvanikHandoffAttachmentAction' satisfies keyof typeof import('@/app/warendurchlauf/actions'),argumente:{orderId:card.id,expectedVersion:card.version,itemId:part.id}}:null,
  'order.parts':({card}:OrderContext)=>orderCommand('getLiveOrderCardAction',{orderId:card.id}),
  'order.finish':({card}:OrderContext)=>orderCommand('freezeOrderAction',{orderId:card.id,expectedVersion:card.version}),
  'order.prices':({card}:OrderContext)=>invoiceCommand('setInvoiceItemPricesAction',{orderId:card.id,expectedVersion:card.version}),
  'order.issue':({card}:OrderContext)=>invoiceCommand('issueInvoiceAction',{orderId:card.id,expectedVersion:card.version}),
  'order.customer_details':({card}:OrderContext)=>customerCommand('updateCustomerAction',{customerId:card.customerId}),
  'order.customer_debt':({card}:OrderContext)=>customerCommand('getCustomerSummaryAction',{customerId:card.customerId}),
  'complaint.open':({card}:OrderContext):OrderCommand=>({datei:'src/app/actions/complaints.actions.ts',funktion:'getComplaintDialogAction' satisfies keyof typeof import('@/app/actions/complaints.actions'),argumente:{orderId:card.id}}),
  'shipping.progress':({card}:OrderContext)=>orderCommand('getManualShippingAction',{orderId:card.id}),
  'order.ship_prepare':({card}:OrderContext)=>orderCommand('getManualShippingAction',{orderId:card.id}),
  'order.payment':({card}:OrderContext):OrderCommand=>({datei:'src/app/actions/payments.actions.ts',funktion:'getOrderPaymentStateAction' satisfies keyof typeof import('@/app/actions/payments.actions'),argumente:{orderId:card.id}}),
  'order.handover':({card}:OrderContext):OrderCommand|null=>card.handoverMode?{datei:'src/app/actions/goodsOut.actions.ts',funktion:'recordGoodsOutAction' satisfies keyof typeof import('@/app/actions/goodsOut.actions'),argumente:{orderId:card.id,expectedVersion:card.version,mode:card.handoverMode==='shipping'?'versand':'abholung'}}:null,
  'order.notify':({card,invoiceMailOriginals}:OrderContext):OrderCommand|null=>{const original=invoiceMailOriginals?.find(row=>row.orderId===card.id);return original?{datei:'src/app/actions/communications.actions.ts',funktion:'sendCustomerMailAction' satisfies keyof typeof import('@/app/actions/communications.actions'),argumente:{targetType:'ORDER',targetId:card.id,attachment:{kind:'INVOICE',documentId:original.id},expectedInvoiceIds:invoiceMailOriginals!.map(row=>row.id)}}:null;},
  'work.remaining_return':({card}:OrderContext):OrderCommand|null=>card.operationalFacts?.rework===true&&card.operationalFacts.reworkComplaintId?{datei:'src/app/actions/complaints.actions.ts',funktion:'getComplaintDialogAction' satisfies keyof typeof import('@/app/actions/complaints.actions'),argumente:{complaintId:card.operationalFacts.reworkComplaintId}}:null,
  'order.followup_settings':():OrderCommand=>({datei:'src/app/actions/settings.actions.ts',funktion:'readSettingsAction' satisfies keyof typeof import('@/app/actions/settings.actions'),argumente:{}}),
  'shipping.return_receive':null,'work.resolve':null,'order.delivery':null,'order.term_notify':null,'work.update_customer':null,'order.extra_request':null,'order.collect':null,'shipping.cost':null,'order.apply_credit':null,'order.remind':null,'order.dunning':null,'order.ship_photo':null,
 } satisfies Record<string,((context:OrderContext)=>OrderCommand|null)|null>
};

/** Facts exposed by the existing versioned card. Missing shipment, financial
 * and approval evidence deliberately stays unknown, never a false calm state.
 * This is the rule seam for U2, not its complete presentation contract. */
export function v45OrderFacts(card:Pick<LiveOrderCard,'station'|'handoverMode'|'items'|'operationalFacts'>):Readonly<Record<string,unknown>>{
 const shipping=card.handoverMode===null?{}:{shipping:card.handoverMode==='shipping'};
 // The persisted 'abgeholt' station is shared by pickup and carrier handover.
 // It proves customer receipt only for a known pickup, never for shipping.
 const transportUnknown=card.station==='versendet'||card.station==='abgeholt'&&card.handoverMode!=='pickup';
 // Existing start command consumes the persisted angenommen station; V45 names it wareneingang.
 return {station:ORDER_U2_BINDINGS.stations[card.station]??card.station,...shipping,...(card.operationalFacts?{rework:card.operationalFacts.rework,...(typeof card.operationalFacts.pricesMissing==='boolean'?{pricesMissing:card.operationalFacts.pricesMissing}:{}),...(typeof card.operationalFacts.complaint==='boolean'?{complaint:card.operationalFacts.complaint}:{})}:{}),
  ...(!transportUnknown?{closed:card.station==='abgeholt',inTransit:false,returning:false}:{}),
  ...(card.operationalFacts?.rework===false?{reworkRemainder:false}:{}),
  allDone:card.items.length>0&&card.items.every(item=>item.finished)};
}
type ReleaseSource={orderId:string;value:Awaited<ReturnType<typeof readOrderInformed>>};
/** Reuse the already-qualified release reader from the very same card version.
 * A failed or stale read supplies no negative facts and no money is projected. */
export function v45OrderReleaseFacts(card:{id:string;version:number},source?:ReleaseSource):Readonly<Record<string,unknown>>{
 if(!source||source.orderId!==card.id||source.value.code!=='OK'||source.value.orderVersion!==card.version)return {};
 const value=source.value,facts:Record<string,unknown>={};
 if(value.invoiceState==='issued'||value.invoiceState==='not_issued')facts.invoiceIssued=value.invoiceState==='issued';
 if(typeof value.paymentReady==='boolean')facts.paymentReady=value.paymentReady;
 if(value.informed===null)facts.noticeSent=false;
 else if(value.informed.orderId===card.id&&value.informed.freezeId===value.freezeId)facts.noticeSent=true;
 if(Array.isArray(value.complaintIds)&&value.complaintIds.every(id=>typeof id==='string'))facts.complaint=value.complaintIds.length>0;
 return facts;
}
function readV45OrderRuleRaw(auth:AuthorizationSnapshot,card:Pick<LiveOrderCard,'id'|'version'|'orderNumber'|'customerId'|'title'|'dueAt'|'station'|'handoverMode'|'items'|'operationalFacts'>,release?:ReleaseSource,evidence?:{orderId:string;records:readonly EvidenceReadRecord[]}){
 const source={kind:'order' as const,id:card.id,version:card.version};
 const missingPhotoItems=evidence?.orderId===card.id?card.items.filter(item=>!evidence.records.some(record=>record.source==='ORDER_STATION_ATTACHMENT'&&record.original.state==='VERIFIED'&&['image/jpeg','image/png','image/webp'].includes(record.original.mimeType??'')&&record.targets.some(target=>target.targetType==='ORDER'&&target.targetId===card.id)&&record.targets.some(target=>target.targetType==='ORDER_ITEM'&&target.targetId===item.id))):null;
 const rule=readAuthorizedV45Rule(auth,'auftrag',{...v45OrderFacts(card),...v45OrderReleaseFacts(card,release),...(missingPhotoItems!==null?{photosMissing:missingPhotoItems.length>0}:{})},undefined,['workProblem','deliveryRequest','termUpdatePending','workUpdatePending','extraPending']);
 const first=readV45FirstLook('auftrag',{
  'auftrag.lage':{nummer:card.orderNumber,station:card.station},
  'auftrag.termin':{datum:card.dueAt},
  'auftrag.teile':{teile:card.items.map(item=>({id:item.id,name:item.name,menge:item.quantity,material:item.material,oberflaeche:item.surfaceRequested,fertig:item.finished,einheit:item.unit}))},
  'auftrag.hauptaktion':{elementId:rule.code==='OK'?rule.hauptaktion:null},
  ...(rule.code==='OK'&&rule.zustand==='photo'&&missingPhotoItems!==null?{'auftrag.blocker':{textKey:'order.photo_required',teilIds:missingPhotoItems.map(item=>item.id)}}:{})
 },rule.code==='OK'&&(rule.zustand==='work'||rule.zustand==='finish')?['auftrag.blocker']:[],rule.code==='OK'&&(rule.zustand==='work'||rule.zustand==='finish')?undefined:rule.code==='OK'?rule.zustand:undefined,true);
 // A state requiring an as-yet unbound blocker stays incomplete, never calm.
 if(first.code!=='OK')return {...first,source};
 if(rule.code!=='OK')return {...rule,source,erstblick:first.erstblick,datenluecken:first.datenluecken};
 const actions=readV45ObjectActionAbsence('auftrag',rule.zustand);
 const part=rule.hauptaktion==='order.photo'?missingPhotoItems?.[0]:undefined;
 const binding=rule.hauptaktion&&Object.hasOwn(ORDER_U2_BINDINGS.commands,rule.hauptaktion)?ORDER_U2_BINDINGS.commands[rule.hauptaktion as keyof typeof ORDER_U2_BINDINGS.commands]:null;
 const invoiceMailOriginals=canTransportInvoiceDocument(auth)&&release?.orderId===card.id&&release.value.code==='OK'&&release.value.orderVersion===card.version?release.value.invoiceMailOriginals:undefined;
 const befehl=binding?binding({card,part,invoiceMailOriginals}):null;
 let hauptaktion:null|{ziel?:{tab:'parts'};elementId:string;textKey:string;werte:Record<string,string|number>;recht:string|null;befehl:OrderCommand}=null;
 const bindingGaps:string[]=[];
 if(rule.hauptaktion!==null){
  if(!befehl)bindingGaps.push('ORDER_ACTION_BINDING:'+rule.hauptaktion);
  else if(!('textKey'in rule)||typeof rule.textKey!=='string'||!('recht'in rule))bindingGaps.push('ORDER_ACTION_METADATA');
  else{
   const parameters=readV45ActionValues(rule.textKey,{number:card.orderNumber,title:card.title,...(part?{part:part.name}:{})});
   if(parameters.code!=='OK')bindingGaps.push(...parameters.missing);
   else hauptaktion={elementId:rule.hauptaktion,textKey:rule.textKey,werte:parameters.werte,recht:rule.recht,befehl,...(rule.hauptaktion==='order.parts'?{ziel:{tab:'parts' as const}}:{})};
  }
 }
 const erstblick=hauptaktion||rule.hauptaktion===null?first.erstblick:first.erstblick.map(field=>field.key==='auftrag.hauptaktion'?{...field,werte:{elementId:null}}:field);
 const datenluecken=[...first.datenluecken,...(rule.datenluecken??[]),...bindingGaps,...(actions.code==='OK'?[]:actions.missing)];
 return {...rule,hauptaktion,erstblick,weitere:actions.code==='OK'?actions.weitere:null,...(datenluecken.length?{datenluecken}:{}),quelle:{...rule.quelle,elementeSha256:first.quelle.sha256,...(actions.code==='OK'?{erwartungSha256:actions.quelle.sha256}:{})},source};
}

export function readV45OrderRule(...args:Parameters<typeof readV45OrderRuleRaw>){return completeU2Read(readV45OrderRuleRaw(...args));}
