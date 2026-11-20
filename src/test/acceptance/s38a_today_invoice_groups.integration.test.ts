// @vitest-environment node
// Real invoice actions/Auth/DB; the transaction proxy only counts actual SQL calls.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readUnsentInvoiceMailGroups,readInvoiceMailCohort} from '@/lib/server/communicationDocumentPort';
import {historicalCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {issueCollectionInvoiceAction} from '@/app/actions/invoices.actions';

async function readGroupsInOneQuery(){
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_INVOICE_GROUP_AUTH');
 return withPrivilegedTenantTransaction(auth.data,async tx=>{
  let executions=0;
  const counted=new Proxy(tx,{get(target,key,receiver){
   if(key==='execute')return (...args:Parameters<typeof tx.execute>)=>{executions++;return Reflect.apply(target.execute,target,args);};
   return Reflect.get(target,key,receiver);
  }});
  const result=await readUnsentInvoiceMailGroups(counted,tenant);
  expect(executions).toBe(1);return result;
 });
}

it('H3 reads zero, one and several actual invoice groups in one SQL query with the sender eligibility',async()=>{
 const read=readGroupsInOneQuery;
 expect(await read()).toEqual({groups:[],missing:[]});
 const customerA=await customerFixture('TEST H3 customer A');
 const first=await readyInvoiceOrder('TEST H3 first','pickup',false,customerA);
 expect(await read()).toMatchObject({groups:[{customerId:customerA,ids:[first.invoice.invoiceId],count:1}],missing:[]});
 const second=await readyInvoiceOrder('TEST H3 second','pickup',false,customerA);
 const customerB=await customerFixture('TEST H3 customer B');
 const third=await readyInvoiceOrder('TEST H3 third','pickup',false,customerB);
 const actual=await read();
 expect(actual.missing).toEqual([]);
 expect(actual.groups).toMatchObject([
  {customerId:customerA,id:first.invoice.invoiceId,ids:[first.invoice.invoiceId],count:1},
  {customerId:customerA,id:second.invoice.invoiceId,ids:[second.invoice.invoiceId],count:1},
  {customerId:customerB,id:third.invoice.invoiceId,ids:[third.invoice.invoiceId],count:1},
 ]);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_INVOICE_GROUP_AUTH');
 for(const group of actual.groups){
  const canonical=await withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailCohort(tx,tenant,group.customerId,'pickup',undefined,false,false,{all:true}));
  expect(canonical.map(row=>row.id)).toContain(group.id);
  expect(actual.groups.filter(row=>row.customerId===group.customerId).map(row=>row.id)).toEqual(canonical.map(row=>row.id));
 }
 expect(await read()).toEqual(actual);
});

it('H3 includes the real issued native original, using explicitly synthetic initial historical TEST sources',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(issued).toMatchObject({code:'OK',replayed:false});if(issued.code!=='OK')throw Error('TEST_NATIVE_GROUP_ISSUE');
 const result=await readGroupsInOneQuery();
 expect(result.missing).toEqual([]);
 const group=result.groups.find(row=>row.customerId===source.customerId);
 expect(group).toMatchObject({orderId:null,ids:[issued.receipt.invoiceId],count:1});
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_NATIVE_GROUP_AUTH');
 const canonical=await withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailCohort(tx,tenant,source.customerId,null,undefined,true,false,{all:true}));
 expect(group?.ids).toEqual(canonical.map(row=>row.id));
 expect(await readGroupsInOneQuery()).toEqual(result);
});


it('H2 shows separate V45-bound rows and sends only the selected original through the same sender, then rereads and retries',async()=>{
 const customerId=await customerFixture('TEST H2 single-original rows');
 const first=await readyInvoiceOrder('TEST H2 selected','pickup',false,customerId);
 const second=await readyInvoiceOrder('TEST H2 remaining','pickup',false,customerId);
 const {readTodayDashboard}=await import('@/lib/server/todayDashboard');
 const {getComplaints}=await import('@/app/actions/complaints.actions');
 const {getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
 const day=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_H2_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const before=await day();
 const rows=before.items.filter(row=>row.invoiceMail?.customerId===customerId);
 expect(rows).toHaveLength(2);
 expect(rows.map(row=>row.invoiceMail?.expectedInvoiceIds)).toEqual([[first.invoice.invoiceId],[second.invoice.invoiceId]]);
 expect(rows.map(row=>row.primaryActionLabel)).toEqual(rows.map(row=>`Rechnung ${row.invoiceMail!.number} an ${row.meta} senden`));
 const selected=rows[0].invoiceMail!;
 let sends=0;const attachments:unknown[][]=[];
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-H2-single-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;attachments.push(JSON.parse(String(init?.body)).message.attachments);return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const input={targetType:'CUSTOMER' as const,targetId:customerId,subject:'TEST single original',body:'TEST stored original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:selected.documentId},expectedInvoiceIds:selected.expectedInvoiceIds,singleInvoice:selected.singleInvoice};
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(sends).toBe(1);expect(attachments[0]).toHaveLength(1);
  const after=await day();
  expect(after.items.filter(row=>row.invoiceMail?.customerId===customerId).map(row=>row.invoiceId)).toEqual([second.invoice.invoiceId]);
  const next=after.items.find(row=>row.invoiceMail?.customerId===customerId)!.invoiceMail!;
  expect(await withSession(full,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID(),attachment:{kind:'INVOICE',documentId:next.documentId},expectedInvoiceIds:next.expectedInvoiceIds}))).toMatchObject({code:'OK'});
  expect(sends).toBe(2);expect(attachments[1]).toHaveLength(1);
  expect((await day()).items.filter(row=>row.invoiceMail?.customerId===customerId)).toEqual([]);
 }finally{provider.mockRestore();}
});
