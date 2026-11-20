// @vitest-environment node
// Real invoice actions/Auth/DB; the transaction proxy only counts actual SQL calls.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readUnsentInvoiceMailGroups,readInvoiceMailCohort} from '@/lib/server/communicationDocumentPort';
import {historicalCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
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
  {customerId:customerA,id:first.invoice.invoiceId,ids:[first.invoice.invoiceId,second.invoice.invoiceId],count:2},
  {customerId:customerB,id:third.invoice.invoiceId,ids:[third.invoice.invoiceId],count:1},
 ]);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_INVOICE_GROUP_AUTH');
 for(const group of actual.groups){
  const canonical=await withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailCohort(tx,tenant,group.customerId,'pickup',undefined,false,false,{all:true}));
  expect(group.ids).toEqual(canonical.map(row=>row.id));
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
