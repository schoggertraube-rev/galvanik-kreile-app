// @vitest-environment node
// Isolated synthetic TEST tenant; real settings/Auth/DB, only Microsoft HTTP doubled.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readPageReadSettingsAction} from '@/app/actions/orders.actions';
import {readMicrosoftGraphSentMailByRequest} from '@/lib/server/microsoftGraph';
import {readPageReadSettings} from '@/modules/fundament/server-public';

it('does not contact Graph with a fabricated default when the tenant settings source is absent',async()=>{
 const fetchPort=vi.fn();
 const result=await withSession(full,()=>readMicrosoftGraphSentMailByRequest({clientRequestId:randomUUID(),recipient:'TEST-recipient@example.invalid',preparedAt:new Date().toISOString()},process.env,fetchPort,()=>readPageReadSettings({tenantId:tenant})));
 expect(result.code).toBe('UNAVAILABLE');
 expect(fetchPort).not.toHaveBeenCalled();
});

it('uses the persisted tenant deadline to cancel a real Graph read and reads successfully on retry',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,seiten_abfrage_ms,rechnung_mail_grenze) VALUES(${randomUUID()},${tenant},'TEST Graph deadline',50,101)`;
 expect(await withSession(full,()=>readPageReadSettingsAction())).toEqual({code:'OK',settings:{queryTimeoutMs:50,invoiceMailBatchLimit:101}});
 const input={clientRequestId:randomUUID(),recipient:'TEST-recipient@example.invalid',preparedAt:new Date().toISOString()};
 let dispatched=0,aborted=false;
 const fetchPort=vi.fn(async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  if(String(url).startsWith('https://login.microsoftonline.com/'))return Response.json({access_token:'TEST-token'.repeat(5)});
  dispatched++;
  if(dispatched>1)return Response.json({value:[]});
  return new Promise<Response>((_resolve,reject)=>{
   const signal=init?.signal;
   if(!signal)throw Error('TEST_GRAPH_ABORT_SIGNAL_REQUIRED');
   const abort=()=>{aborted=true;reject(signal.reason);};
   if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  });
 });
 const started=performance.now();
 const result=await withSession(full,()=>readMicrosoftGraphSentMailByRequest(input,process.env,fetchPort,()=>readPageReadSettings({tenantId:tenant})));
 expect(result.code).toBe('UNAVAILABLE');
 expect(aborted).toBe(true);expect(dispatched).toBe(1);
 expect(performance.now()-started).toBeLessThan(2000);
 expect(await withSession(full,()=>readMicrosoftGraphSentMailByRequest(JSON.parse(JSON.stringify(input)),process.env,fetchPort,()=>readPageReadSettings({tenantId:tenant})))).toEqual({code:'OK',data:{notFound:true}});
 expect(dispatched).toBe(2);
 expect(await sql`SELECT seiten_abfrage_ms FROM public.company_settings WHERE tenant_id=${tenant}`).toEqual([{seiten_abfrage_ms:50}]);
});
