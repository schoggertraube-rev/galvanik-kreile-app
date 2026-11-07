export type GoodsReceiptPhotoKind="uebersicht"|"teile"|"abweichung";
export type GoodsReceiptOrderRead={id:string;number:string|null;customerId:string;customerName:string|null;title:string|null;note:string|null;version:number;station:string;status:string;ware:string;fromQuote:boolean;items:Array<{id:string;name:string;quantity:number;unit:string|null;surface:string|null;note:string|null}>};
export type GoodsReceiptRecord={id:string;client_key:string;item_id:string|null;auftrag_id:string|null;kv_id?:string|null;kv_fassung?:number|null;lagerort?:string|null;gesperrt?:boolean;modus:"erwartet"|"erfassung";status:"entwurf"|"angenommen"|"galvanik";version:number;karte:number;packstuecke_da:number|null;packstuecke_gesamt:number|null;zustand:GoodsReceiptInput["condition"];abweichung:string[];abgestellt:boolean;fund_zeit:string|null;verfahren_wie_kv:GoodsReceiptInput["procedure"];verfahren_abweichung:string|null;fotos:GoodsReceiptInput["photos"];mengen:Array<{teil_id:string;kv_position?:number;erwartet:number;bestaetigt:number|null;geaendert:boolean;hinweis:string|null}>;offen:string[];bestaetigt_von:string|null};
export type GoodsReceiptFailure={code:"UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"VALIDATION_ERROR"|"CONFLICT"|"UNAVAILABLE";message:string};
export type GoodsReceiptReadResult={code:"OK";order:GoodsReceiptOrderRead;receipts:GoodsReceiptRecord[];canStartGalvanik:boolean}|GoodsReceiptFailure;
export type GoodsReceiptInput={
 id:string;clientKey:string;clientEventId:string;itemId:string|null;orderId:string;expectedOrderVersion:number;expectedVersion:number;
 mode:"erwartet"|"erfassung";command:"draft"|"accept"|"galvanik";card:number;
 packagesReceived:number|null;packagesTotal:number|null;condition:"unauffaellig"|"abweichung"|"teillieferung"|"gefahr"|null;
 deviations:string[];foundUnattended:boolean;foundAt:string|null;procedure:"stimmt"|"abweichend"|null;procedureNote:string|null;
 photos:Array<{fileId:string;kind:GoodsReceiptPhotoKind}>;
 quantities:Array<{itemId:string;expected:number;received:number|null;confirmed:boolean;note:string|null}>;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseGoodsReceiptInput(value:unknown):GoodsReceiptInput|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as GoodsReceiptInput;
 if(![v.id,v.clientKey,v.clientEventId].every(id=>typeof id==="string"&&UUID.test(id))||!(v.itemId===null||typeof v.itemId==="string"&&UUID.test(v.itemId))||typeof v.orderId!=="string"||!v.orderId.trim()||v.orderId.length>128
  ||!Number.isSafeInteger(v.expectedOrderVersion)||v.expectedOrderVersion<1||!Number.isSafeInteger(v.expectedVersion)||v.expectedVersion<0
  ||!['erwartet','erfassung'].includes(v.mode)||!['draft','accept','galvanik'].includes(v.command)||!Number.isSafeInteger(v.card)||v.card<0||v.card>20
  ||![v.packagesReceived,v.packagesTotal].every(n=>n===null||Number.isSafeInteger(n)&&n>=1&&n<=999)
  ||(v.packagesReceived!==null&&v.packagesTotal!==null&&v.packagesReceived>v.packagesTotal)
  ||!(v.condition===null||['unauffaellig','abweichung','teillieferung','gefahr'].includes(v.condition))
  ||!Array.isArray(v.deviations)||v.deviations.length>6||new Set(v.deviations).size!==v.deviations.length||v.deviations.some(reason=>!['beschädigt','nass/verschmutzt','verunreinigt','Menge stimmt nicht','falsche Teile','Paket offen'].includes(reason))
  ||typeof v.foundUnattended!=="boolean"||!(v.foundAt===null||typeof v.foundAt==="string"&&Number.isFinite(Date.parse(v.foundAt)))||v.foundUnattended!==(v.foundAt!==null)
  ||!(v.procedure===null||['stimmt','abweichend'].includes(v.procedure))||!(v.procedureNote===null||typeof v.procedureNote==="string"&&v.procedureNote.trim().length>0&&v.procedureNote.length<=500)
  ||!Array.isArray(v.photos)||v.photos.length>100||new Set(v.photos.map(photo=>photo?.fileId)).size!==v.photos.length
  ||v.photos.some(photo=>!photo||!UUID.test(photo.fileId)||!['uebersicht','teile','abweichung'].includes(photo.kind))
  ||!Array.isArray(v.quantities)||v.quantities.length>20||new Set(v.quantities.map(row=>row?.itemId)).size!==v.quantities.length
  ||v.quantities.some(row=>!row||typeof row.itemId!=="string"||!row.itemId.trim()||!Number.isFinite(row.expected)||row.expected<=0
    ||!(row.received===null||Number.isFinite(row.received)&&row.received>=0)||typeof row.confirmed!=="boolean"
    ||!(row.note===null||typeof row.note==="string"&&row.note.length<=500)))return null;
 return v;
}
export function goodsReceiptGaps(input:GoodsReceiptInput,fromQuote:boolean):string[]{
 const missing:string[]=[];
 if(!input.condition)missing.push('Zustand');
 if(input.packagesReceived===null||input.packagesTotal===null)missing.push('Packstücke');
 if(input.condition==='abweichung'||input.condition==='gefahr'){
  if(!input.deviations.length)missing.push('Abweichungsgrund');
  if(!input.photos.some(photo=>photo.kind==='abweichung'))missing.push('Foto der Abweichung');
 }else if(!input.photos.length)missing.push('Foto Paket oder Teile');
 if(input.quantities.some(row=>!row.confirmed&&row.received===null))missing.push('Positionen prüfen');
 if(fromQuote&&(!input.procedure||input.procedure==='abweichend'&&!input.procedureNote))missing.push('Verfahren/Termin wie im KV');
 return missing;
}
export function goodsReceiptWare(input:GoodsReceiptInput):"erwartet"|"teilweise"|"da"|"abweichung"{
 if(input.condition==='gefahr'||input.deviations.includes('verunreinigt')||input.deviations.includes('Menge stimmt nicht')||input.deviations.includes('falsche Teile'))return 'abweichung';
 if(input.condition==='teillieferung'||input.packagesReceived!==input.packagesTotal)return 'teilweise';
 if(input.condition==='abweichung'&&!input.quantities.every(row=>row.confirmed))return 'abweichung';
 return 'da';
}

/** Same inspection fields; the business reference is a KV until conversion. */
export type QuoteGoodsReceiptInput=Omit<GoodsReceiptInput,'orderId'|'expectedOrderVersion'|'command'>&{quoteId:string;expectedQuoteVersion:number;sourceVersion:number;location:string;command:'accept'};
export function parseQuoteGoodsReceiptInput(value:unknown):QuoteGoodsReceiptInput|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as QuoteGoodsReceiptInput;
 if(typeof row.quoteId!=='string'||!UUID.test(row.quoteId)||!Number.isSafeInteger(row.expectedQuoteVersion)||row.expectedQuoteVersion<1||!Number.isSafeInteger(row.sourceVersion)||row.sourceVersion<1||typeof row.location!=='string'||row.location.trim()!==row.location||!row.location||row.location.length>120||row.command!=='accept'||!row.itemId)return null;
 const keys=['id','clientKey','clientEventId','itemId','expectedVersion','mode','command','card','packagesReceived','packagesTotal','condition','deviations','foundUnattended','foundAt','procedure','procedureNote','photos','quantities','quoteId','expectedQuoteVersion','sourceVersion','location'];
 if(Object.keys(row).sort().join('|')!==keys.sort().join('|'))return null;
 // Reuse only the existing pure inspection validator; no synthetic order is stored.
 if(!parseGoodsReceiptInput({...row,orderId:row.quoteId,expectedOrderVersion:row.expectedQuoteVersion}))return null;
 return row;
}
