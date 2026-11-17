// @vitest-environment node
// Real Auth/transactions/diagnostic sink. Only external Graph is doubled.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sql as statement} from 'drizzle-orm';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readCustomerCredit} from '@/modules/accounting/server-public';
import {readLinkedIntakeMails} from '@/modules/eingang/server-public';
import {observeAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {OFFLINE_RECONCILIATION_COPY} from '@/ui/situationCatalog';
import {sendCommunicationMail} from '@/lib/server/communicationPort';
import {searchTenantAction} from '@/app/actions/search.actions';
import {canSearchTenant,hasAuthorizationArea} from '@/lib/auth/authorizationContract';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S47A_OWN_REPLAY_REQUIRED');

it('S47a 1 persists one content-free diagnostic after a real read transaction fails; the existing result is unchanged',async()=>{
 const result=await withSession(full,()=>observeAction('TEST_s47_credit',{type:'action',id:'TEST_s47_credit'},async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH');
  return readCustomerCredit(auth.data,'TEST-customer',async tx=>{await tx.execute(statement`SELECT 1/0`);throw Error('TEST_UNREACHABLE');});
 },readLoggingSettings));
 expect(result).toMatchObject({code:'UNAVAILABLE'});
 const rows=await sql`SELECT command,user_id::text,subject_id,reason FROM public.technical_protocol WHERE tenant_id=${tenant} AND command='CUSTOMER_CREDIT_READ_FAILED'`;
 expect(rows).toEqual([{command:'CUSTOMER_CREDIT_READ_FAILED',user_id:full.actorId,subject_id:'TEST_s47_credit',reason:'UNKNOWN'}]);
});

it('S47a 3 provides the PL catalog text at the existing version-conflict consumer',()=>{
 expect(OFFLINE_RECONCILIATION_COPY.noteChanged).toBe('Deine Notiz wurde inzwischen geändert · neuen Stand laden und erneut speichern');
 expect(readFileSync('src/modules/eingang/server/intakeCapture.ts','utf8')).toContain('failure("CONFLICT",OFFLINE_RECONCILIATION_COPY.noteChanged)');
});

it('S47a 4 writes the real PREPARE in UTC even in a Berlin transaction; midnight keeps the original UTC day',async()=>{
 const customerId=await customerFixture('S47a Berlin'),clientRequestId=randomUUID();
 const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-s47-provider-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});
  return nativeFetch(input,init);
 });
 try{
  const result=await withSession(full,async()=>{
   const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH');
   return sendCommunicationMail(auth.data,{targetType:'CUSTOMER',targetId:customerId,clientRequestId,subject:'TEST S47 UTC',body:'TEST S47 body',beforePrepare:async tx=>{
    await tx.execute(statement`SELECT set_config('TimeZone','Europe/Berlin',true)`);return true;
   }});
  });
  expect(result).toMatchObject({code:'OK'});
  const [proof]=await sql`SELECT abs(extract(epoch FROM (created_at-(statement_timestamp() AT TIME ZONE 'UTC'))))<60 AS utc FROM public.events WHERE tenant_id=${tenant} AND correlation_id=${clientRequestId}::uuid AND event_type='COMMUNICATION_MAIL_PREPARED_V1'`;
  expect(proof).toEqual({utc:true});
  await sql.begin(async tx=>{
   await tx`SET LOCAL TIME ZONE 'Europe/Berlin'`;
   expect(await tx`SELECT to_char(timestamptz '2026-11-17 23:30:00+00' AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS utc,to_char(timestamptz '2026-11-17 23:30:00+00','YYYY-MM-DD HH24:MI') AS berlin`).toEqual([{utc:'2026-11-17 23:30',berlin:'2026-11-18 00:30'}]);
  });
  const writer=readFileSync('src/lib/server/communicationPort.ts','utf8');
  for(const kind of ['COMMUNICATION_MAIL_PREPARED_V1','COMMUNICATION_MAIL_RESEND_CONFIRMED_V1']){
   const insert=writer.slice(writer.indexOf("'"+kind+"'",writer.indexOf('INSERT INTO public.events',writer.indexOf(kind==='COMMUNICATION_MAIL_PREPARED_V1'?'const prepBytes=':'if(!input.confirmedResend)return'))));
   expect(insert.slice(0,insert.indexOf('RETURNING id'))).toContain("statement_timestamp() AT TIME ZONE 'UTC'");
  }
 }finally{transport.mockRestore();}
});

it('S47a 5 returns null for missing address metadata rather than a display label',async()=>{
 const customerId=await customerFixture('S47a address');
 // Explicit synthetic historical mail metadata, only for this read boundary.
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,zuordnung,einsatz,graph_message_id,absender_adresse) VALUES(${randomUUID()}::uuid,${tenant},${randomUUID()},'mail','rein','outlook',${full.actorId}::uuid,'TEST historical mail',${customerId},'hand','info',${'TEST-s47-'+randomUUID()},NULL)`;
 const result=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH');return readLinkedIntakeMails(auth.data,{targetType:'CUSTOMER',targetId:customerId});});
 expect(result).toMatchObject({code:'OK',data:[{senderAddress:null}]});
});

it('S47a 6 the existing shared search gate accepts a real Leitstand login without Kunden',async()=>{
 const customerId=await customerFixture('S47a search'),order=await intakeOrderFixture('S47a search',customerId),login=await createFixture(['auftraege']);
 await withSession(login,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH');
  expect(canSearchTenant(auth.data)).toBe(true);expect(hasAuthorizationArea(auth.data,'kunden')).toBe(false);
  expect(await searchTenantAction(order.receipt.orderNumber)).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({id:order.receipt.orderId,type:'ORDER'})])});
 });
});
