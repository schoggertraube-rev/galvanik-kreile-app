// @vitest-environment node
// Real customer Actions/Auth/DB and existing terms writer, isolated TEST tenant.
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {createCustomerAction,readCustomerCreateReceiptAction,updateCustomerAction} from '@/app/actions/customers.actions';
import {enableCustomerInvoiceTermsCommand} from '@/modules/customers/server-public';
import {resolveAuthorization,getAuthorizationActionGrants,hasAuthorizationArea} from '@/lib/server/authorization';
import {withRestoredTestSource} from '@/test/fixtures/restoredTestSource';

function input(){return {clientEventId:randomUUID(),customerType:'business' as const,companyName:'TEST belegte Zielfreigabe '+randomUUID(),salutation:'frau' as const,firstName:'TEST',lastName:'Person',phone:'+49 711 5550189',email:'TEST-'+randomUUID()+'@example.invalid',street:'TEST Weg',houseNumber:'1',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'vorkasse',handoverPreference:'shipping' as const};}
async function enable(customerId:string){return withSession(full,async()=>{
 const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_REAL_AUTH_REQUIRED');
 return enableCustomerInvoiceTermsCommand({tenantId:auth.data.tenantId,userId:auth.data.userId,capabilities:{canCreateCustomer:getAuthorizationActionGrants(auth.data).createCustomer,canManageMoney:hasAuthorizationArea(auth.data,'zahlungen')}},{customerId,targetDays:14,cashDiscountPercent:2,cashDiscountDays:7,clientEventId:randomUUID()});
});}
async function preserve(customerId:string,work:()=>Promise<void>){return withRestoredTestSource({label:'TEST vollständige Kundenzeile',read:async()=>{
 const [row]=await sql`SELECT to_jsonb(customer) AS original FROM public.customers customer WHERE tenant_id=${tenant} AND id=${customerId}`;
 if(!row)throw Error('TEST_CUSTOMER_REQUIRED');
 const original=(typeof row.original==='string'?JSON.parse(row.original):row.original) as Record<string,unknown>;
 if(!original||typeof original!=='object'||Array.isArray(original))throw Error('TEST_COMPLETE_CUSTOMER_ROW_REQUIRED');
 writeFileSync('.git/kreile-customer-readback-'+customerId+'-original.json',JSON.stringify(original));return original;
},restore:async original=>{
 const columns=Object.keys(original).map(key=>'"'+key.replaceAll('"','""')+'"').join(',');
 await sql`UPDATE public.customers SET ${sql.unsafe('('+columns+')')}=(SELECT ${sql.unsafe(columns)} FROM jsonb_populate_record(NULL::public.customers,${sql.json(original as never)}::jsonb)) WHERE tenant_id=${tenant} AND id=${customerId}`;
}},work);}

it('PL19:53 customer creation retries keep the same immutable original after a real invoice-terms release',async()=>{
 const request=input(),created=await withSession(full,()=>createCustomerAction(request));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('TEST_REAL_CUSTOMER_CREATE_REQUIRED');
 expect(await enable(created.receipt.customerId)).toMatchObject({code:'OK',replayed:false});
 const retry=await withSession(full,()=>createCustomerAction(JSON.parse(JSON.stringify(request))));
 expect(retry).toMatchObject({code:'OK',replayed:true,receipt:created.receipt,customer:{id:created.receipt.customerId,paymentPreference:'rechnung',invoiceTermsEnabled:true}});
 expect(await withSession(full,()=>readCustomerCreateReceiptAction(structuredClone(request)))).toMatchObject({code:'OK',receipt:created.receipt});
 expect(await sql`SELECT count(*)::int AS n FROM public.customers WHERE tenant_id=${tenant} AND id=${created.receipt.customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM private.customer_create_receipts WHERE tenant_id=${tenant} AND customer_id=${created.receipt.customerId}`).toEqual([{n:1}]);
 expect(await withSession(full,()=>createCustomerAction({...request,phone:'+49 711 5550199'}))).toMatchObject({code:'CONFLICT'});
 await preserve(created.receipt.customerId,async()=>{
  await sql`UPDATE public.customers SET email='TEST-unbelegter-kontakt@example.invalid' WHERE tenant_id=${tenant} AND id=${created.receipt.customerId}`;
  expect(await withSession(full,()=>createCustomerAction(structuredClone(request)))).toMatchObject({code:'UNAVAILABLE'});
 });
 expect(await withSession(full,()=>createCustomerAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true,receipt:created.receipt});
});

it('a real contact update before the release keeps its own profile proof and the original create identity',async()=>{
 const request=input(),created=await withSession(full,()=>createCustomerAction(request));
 if(created.code!=='OK')throw Error('TEST_REAL_CUSTOMER_CREATE_REQUIRED');
 const phone='+49 711 5550199';
 expect(await withSession(full,()=>updateCustomerAction({...request,customerId:created.receipt.customerId,phone,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await enable(created.receipt.customerId)).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>createCustomerAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true,receipt:created.receipt,customer:{phone,paymentPreference:'rechnung'}});
});

it('an unproved invoice preference cannot validate an old create original, and full-row restoration preserves the real retry',async()=>{
 const request=input(),created=await withSession(full,()=>createCustomerAction(request));
 if(created.code!=='OK')throw Error('TEST_REAL_CUSTOMER_CREATE_REQUIRED');
 await preserve(created.receipt.customerId,async()=>{
  // Explicitly synthetic corruption, no release event, only this TEST customer.
  await sql`UPDATE public.customers SET payment_preference='rechnung',ziel_freigeschaltet=true,ziel_tage=14,skonto_prozent=2,skonto_tage=7 WHERE tenant_id=${tenant} AND id=${created.receipt.customerId}`;
  expect(await withSession(full,()=>createCustomerAction(structuredClone(request)))).toMatchObject({code:'UNAVAILABLE'});
 });
 expect(await withSession(full,()=>createCustomerAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true,receipt:created.receipt});
});
