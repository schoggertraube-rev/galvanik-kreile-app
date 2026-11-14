import {randomUUID} from 'node:crypto';
import {berlinCalendarDay,previousWorkingDay} from '../../src/lib/domain/workingDays';
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

/** PL14Nov02:00: read DB time once at the beginning of this TEST case.
 * No UPDATE/DELETE, trigger override, JS clock freeze or provider fiction. */
export async function readHistoricalDispatchClock(sql:typeof replaySql,tenantId:string,actorId:string){
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||!tenantId.startsWith('TEST-'))throw Error('TEST_HISTORICAL_DISPATCH_LOOPBACK_REQUIRED');
 const [clock]=await sql`SELECT statement_timestamp()::text AS now`;
 if(!clock||!Number.isFinite(Date.parse(clock.now)))throw Error('TEST_DATABASE_CLOCK_REQUIRED');
 const databaseNow=new Date(clock.now).toISOString();
 return {databaseNow,async addNotice(orderId:string,days=1,holidays:readonly string[]=[]){
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
