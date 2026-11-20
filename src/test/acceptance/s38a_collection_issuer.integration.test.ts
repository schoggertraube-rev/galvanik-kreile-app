// @vitest-environment node
// Current-month boundary: genuine handovers/authorization/collection command/DB.
// This is NOT a positive collection-original issuance proof.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {issueCollectionInvoiceAction} from '@/app/actions/invoices.actions';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readEffectiveCustomerAgreement} from '@/lib/server/effectiveCustomerAgreementRead';

it('PL16:22 refuses a real current-month collection before number allocation; retries and missing price rights never create an original',async()=>{
 const customerId=await customerFixture('TEST S38a real current month');
 const order=await readyOrderForInvoice('TEST S38a current month goods','pickup',customerId);
 const saved=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST current-month collection'}));
 if(saved.code!=='OK')throw Error('TEST_COLLECTION_AGREEMENT_REQUIRED');
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID(),agreement:{id:saved.agreement.id,version:saved.agreement.version,type:'sammelrechnung'}}))).toMatchObject({code:'OK'});
 const memberTerms=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:45,reason:'TEST PL16:55 individual target is not the collection contract'}));
 if(memberTerms.code!=='OK')throw Error('TEST_MEMBER_TARGET_REQUIRED');
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_COLLECTION_AUTH_REQUIRED');
 const terms=await withPrivilegedTenantTransaction(auth.data,tx=>readEffectiveCustomerAgreement(tx,{tenantId:tenant,customerId,orderId:null,memberOrderIds:[order.orderId],lock:true}));
 expect(terms.agreement).toMatchObject({id:saved.agreement.id,type:'sammelrechnung',targetDays:30});
 expect(terms.ignored).toEqual([{id:memberTerms.agreement.id,orderId:order.orderId,type:'zahlungsziel',version:memberTerms.agreement.version}]);
 const rows=await sql`SELECT id::text,version,status,invoice_id FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${customerId}`;
 expect(rows).toHaveLength(1);
 const input={collectionId:rows[0].id,expectedVersion:rows[0].version,clientEventId:randomUUID()};
 const before=await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const refused=await withSession(full,()=>issueCollectionInvoiceAction(input));
 expect(refused,JSON.stringify(refused)).toEqual({code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionNotDue});
 expect(await withSession(full,()=>issueCollectionInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual(refused);
 const noPrice=await createFixture(['wartung'],'developer');
 expect(await withSession(noPrice,()=>issueCollectionInvoiceAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant}`).toHaveLength(0);
 expect(await sql`SELECT id::text,version,status,invoice_id FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toEqual(rows);
});
