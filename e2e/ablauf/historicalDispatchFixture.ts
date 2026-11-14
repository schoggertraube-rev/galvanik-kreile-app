import {randomUUID,createHash} from 'node:crypto';
import {berlinCalendarDay,previousWorkingDay,plusWorkingDays} from '../../src/lib/domain/workingDays';
import type {sql as replaySql} from './replayHarness';

/** Explicitly synthetic deadline source, never a historical product-writer proof.
 * N counts completed workdays, so N=0 on Sunday anchors on the last workday. */
export function historicalDispatchDate(databaseNow:string,days:number,holidays:readonly string[]=[]):string{
 const now=new Date(databaseNow);
 if(!Number.isFinite(now.getTime())||!Number.isSafeInteger(days)||days<0||days>1000)throw Error('TEST_HISTORICAL_DATE_INVALID');
 const before=(day:string)=>{const date=new Date(day+'T12:00:00.000Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);};
 const working=(day:string)=>{
  let result=previousWorkingDay(day);if(!result)throw Error('TEST_WORKDAY_INVALID');
  while(holidays.includes(result)){result=previousWorkingDay(before(result));if(!result)throw Error('TEST_WORKDAY_INVALID');}
  return result;
 };
 let day=working(berlinCalendarDay(now));
 for(let n=0;n<days;n++)day=working(before(day));
 // Never a future source, including Monday 00:30 Berlin before UTC midnight.
 return new Date(Math.min(now.getTime(),Date.parse(day+'T00:00:00.000Z'))).toISOString();
}

export function dispatchFollowupBoundary(sentAt:string,days:number,databaseNow:string,holidays:readonly string[]=[]){
 const due=plusWorkingDays(berlinCalendarDay(new Date(sentAt)),days,holidays);
 if(!due||!Number.isFinite(Date.parse(databaseNow)))throw Error('TEST_FOLLOWUP_CALENDAR_INVALID');
 return {due,state:due>berlinCalendarDay(new Date(databaseNow))?'WAIT' as const:'DUE' as const};
}

/** PL14Nov02:00: read DB time once at the beginning of this TEST case.
 * No UPDATE/DELETE, trigger override, JS clock freeze or provider fiction. */
export async function readHistoricalDispatchClock(sql:typeof replaySql,tenantId:string,actorId:string){
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||!tenantId.startsWith('TEST-'))throw Error('TEST_HISTORICAL_DISPATCH_LOOPBACK_REQUIRED');
 const [clock]=await sql`SELECT statement_timestamp()::text AS now`;
 if(!clock||!Number.isFinite(Date.parse(clock.now)))throw Error('TEST_DATABASE_CLOCK_REQUIRED');
 const databaseNow=new Date(clock.now).toISOString();
 return {databaseNow,async readSentFollowup(key:string,days:number,holidays:readonly string[]=[]){
  const rows=await sql`SELECT created_at::text AS sent_at FROM public.events WHERE tenant_id=${tenantId} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${key}::uuid`;
  if(rows.length!==1)throw Error('TEST_ACTUAL_REMINDER_RECEIPT_REQUIRED');
  return dispatchFollowupBoundary(rows[0].sent_at,days,databaseNow,holidays);
 },async addReminder(customerId:string,orderIds:string[],stage:'E1'|'E2',days:number){
  if(!orderIds.length||new Set(orderIds).size!==orderIds.length)throw Error('TEST_HISTORICAL_COHORT_REQUIRED');
  const recordedAt=historicalDispatchDate(databaseNow,days),threadId=randomUUID(),messageId=randomUUID(),key=randomUUID(),stageKey=randomUUID();
  const subject='TEST synthetisches historisches '+stage+'-Original',body='TEST synthetischer Ausgangsfakt; kein Versandnachweis des Produkt-Writers';
  await sql.begin(async tx=>{
   const orders=await tx`SELECT id,order_number AS number,version FROM public.orders WHERE tenant_id=${tenantId} AND customer_id=${customerId} AND station='fertig' AND id=ANY(${orderIds}::text[]) ORDER BY id`;
   if(orders.length!==orderIds.length)throw Error('TEST_REAL_REMINDER_ORDERS_REQUIRED');
   const meta={stage,customerId,handover:'pickup',dueDate:berlinCalendarDay(new Date(recordedAt)),stageKey,intent:createHash('sha256').update('TEST_SYNTHETIC:'+key).digest('hex'),orders:orders.map(row=>({id:row.id,number:row.number,version:row.version})),customerMessage:{subject,body},moneyRequired:true};
   await tx`INSERT INTO public.communication_threads(id,tenant_id,customer_id,order_id,source,subject,status,created_by,created_at,updated_at)
    VALUES(${threadId}::uuid,${tenantId},${customerId},NULL,${'MS_GRAPH_OUT:'+key},${subject},'sent',${actorId}::uuid,${recordedAt}::timestamptz,${recordedAt}::timestamptz)`;
   await tx`INSERT INTO public.communication_messages(id,tenant_id,thread_id,direction,channel,body,created_by,created_at)
    VALUES(${messageId}::uuid,${tenantId},${threadId}::uuid,'outgoing','email',${body},${actorId}::uuid,${recordedAt}::timestamptz)`;
   const prepared={meta,threadId,bodySha256:createHash('sha256').update(body).digest('hex')};
   const sent={threadId,messageId,intent:meta.intent,meta,prepareActorId:actorId,clickedBy:actorId};
   await tx`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
    VALUES(${randomUUID()},${tenantId},'ORDER_COLLECTION_REMINDER_PREPARED_V1',${subject},${tx.json(prepared)},'success',${actorId}::uuid,${stageKey}::uuid,${key}::uuid,1,${recordedAt}::timestamptz),
    (${randomUUID()},${tenantId},'ORDER_COLLECTION_REMINDER_SENT_V1',${subject},${tx.json(sent)},'success',${actorId}::uuid,${randomUUID()}::uuid,${key}::uuid,1,${recordedAt}::timestamptz)`;
  });
  return {threadId,messageId,key,stageKey,recordedAt};
 },async addNotice(orderId:string,days=1,holidays:readonly string[]=[]){
  // This raw TEST connection has no app.tenant_id setting. The existing real
  // notification is our source, not an empty scope-dependent view or a new ID.
  const [freeze]=await sql`SELECT event.payload->'receipt'->>'freezeId' AS freeze_id FROM public.events event
   JOIN public.orders orders ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
   WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1'
    AND event.status='success' AND orders.station='fertig' ORDER BY event.created_at DESC,event.id DESC LIMIT 1`;
  if(!freeze||typeof freeze.freeze_id!=='string'||!/^[a-f0-9-]{36}$/.test(freeze.freeze_id))throw Error('TEST_REAL_FREEZE_REQUIRED');
  const recordedAt=historicalDispatchDate(databaseNow,days,holidays),eventId=randomUUID(),key=randomUUID();
  const receipt={eventId,orderId,freezeId:freeze.freeze_id,actorId,channel:'telefon',recordedAt,threadId:null};
  await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
   VALUES(${eventId},${tenantId},${orderId},'ORDER_CUSTOMER_INFORMED_V1','TEST synthetischer historischer Frist-Ausgangsfakt',${sql.json({intent:'TEST_SYNTHETIC_HISTORICAL_NOTICE',receipt})},'success',${actorId}::uuid,${key}::uuid,${key}::uuid,1,${recordedAt}::timestamptz)`;
  return receipt;
 }};
}
