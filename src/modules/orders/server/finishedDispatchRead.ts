import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {getPaymentState} from '@/lib/server/paymentSummaryRead';
import {readInvoiceTruth} from '@/lib/server/invoiceTruthRead';
import {readInvoiceSentProofInTransaction} from '@/lib/server/communicationPort';
import {deriveFinishedDispatch,type FinishedDispatch} from '../domain/finishedDispatch';
export async function readFinishedDispatch(auth:AuthorizationSnapshot,orderId:string,deps:{readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,id:string)=>Promise<{email:string|null}|null>;readShippingEvidence?:(tx:PrivilegedTenantTransaction,tenantId:string,shipmentIds:string[])=>Promise<Array<{kind:'packed'|'delivered';shipmentId:string;eventId:string}>>}):Promise<{code:'OK';projection:FinishedDispatch}|{code:'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'UNAVAILABLE';message:string}>{
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'geld'))return {code:'FORBIDDEN',message:'Fertig-Ausgabe benötigt Aufträge und Geld.'};
 const card=await readLiveOrderCard(auth,{orderId});if(card.code!=='OK')return card;
 const [payment,invoices]=await Promise.all([getPaymentState(auth,orderId),readInvoiceTruth(auth,{customerId:card.data.customerId})]);if(payment.code!=='OK')return payment;if(invoices.code!=='OK')return invoices;
 if(card.data.version!==payment.data.orderVersion)return {code:'UNAVAILABLE',message:'Auftrag ist während des Lesens geändert · neu lesen.'};
 const own=invoices.data.filter(invoice=>invoice.orderId===orderId&&invoice.status==='issued');if(own.length!==(payment.data.invoiceState==='issued'?1:0))return {code:'UNAVAILABLE',message:'Rechnungsbeleg ist nicht eindeutig.'};
 if(own[0]){const summary=payment.data.payment;if(!summary||summary.invoiceId!==own[0].invoiceId||summary.status!==own[0].paymentStatus||summary.openAmountCents!==own[0].openAmountCents||summary.paidAmountCents!==own[0].paidAmountCents||summary.totalAmountCents!==own[0].grossAmountCents)return {code:'UNAVAILABLE',message:'Zahlungsstand ist während des Lesens geändert · neu lesen.'};}
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const [current]=await tx.execute<{version:number}>(sql`SELECT version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${orderId}`);if(!current||current.version!==card.data.version)throw Error('FINISHED_ORDER_CHANGED');
  const [clock]=await tx.execute<{today:string;now:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today,statement_timestamp()::text AS now`);
  const customer=await deps.readCustomer(tx,auth.tenantId,card.data.customerId);if(!customer)throw Error('FINISHED_CUSTOMER_MISSING');
  const shipments=await tx.execute<{id:string;tracking:string|null;label:string|null;delivered:string|null}>(sql`SELECT id::text,tracking_number AS tracking,label_url AS label,delivered_at::text AS delivered FROM public.shipments WHERE tenant_id=${auth.tenantId} AND order_id=${orderId} AND status NOT IN ('cancelled','storniert') ORDER BY id LIMIT 101`);if(shipments.length>100)throw Error('FINISHED_SHIPMENT_LIMIT');
  // The carrier/packing owner is not connected yet. Never invent event names or
  // treat legacy delivered_at / label status as authenticated delivery evidence.
  const proofs=deps.readShippingEvidence?await deps.readShippingEvidence(tx,auth.tenantId,shipments.map(shipment=>shipment.id)):[];
  if(proofs.some(proof=>!['packed','delivered'].includes(proof.kind)||!shipments.some(shipment=>shipment.id===proof.shipmentId)||!proof.eventId))throw Error('FINISHED_SHIPPING_PROOF_INVALID');
  const packed=shipments.length>0&&shipments.every(shipment=>proofs.some(proof=>proof.kind==='packed'&&proof.shipmentId===shipment.id));
  const labelReady=shipments.length>0&&shipments.every(shipment=>Boolean(shipment.label&&shipment.tracking));
  const delivered=shipments.length>0&&shipments.every(shipment=>Boolean(shipment.delivered)&&proofs.some(proof=>proof.kind==='delivered'&&proof.shipmentId===shipment.id));
  const invoiceSentAt=own[0]?await readInvoiceSentProofInTransaction(tx,auth,own[0].invoiceId):null;
  return {code:'OK' as const,projection:deriveFinishedDispatch({card:card.data,payment:payment.data,invoices:invoices.data,today:clock.today,now:clock.now,customerEmail:customer.email,invoiceSentAt,packed,labelReady,delivered,evidenceGaps:card.data.handoverMode==='shipping'&&!deps.readShippingEvidence?['SHIPPING_PROOF_PORT_NOT_CONNECTED']:[]})};
 });}catch(error){console.error('[FINISHED_DISPATCH_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Fertig-Ausgabe konnte nicht sicher gelesen werden.'};}
}
