// @vitest-environment node
// Real original issuance/cancellation/Auth/DB; cancellation is never a mail ACK.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readInvoiceMailCohort,readInvoiceMailUnacknowledged,readInvoiceMailOpenRemainder} from '@/lib/server/communicationDocumentPort';

it('K3/K6 keeps a cancelled unsent original unacknowledged, even though it is no longer eligible for sending',async()=>{
 const customerId=await customerFixture('TEST K3 immutable acknowledgement boundary');
 const first=await readyInvoiceOrder('TEST K3 first actual original','pickup',false,customerId);
 const second=await readyInvoiceOrder('TEST K3 second actual original','pickup',false,customerId);
 const ids=[first.invoice.invoiceId,second.invoice.invoiceId];
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_K3_SOURCE_AUTH');
 const read=()=>withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailUnacknowledged(tx,tenant,customerId,ids));
 expect(await read()).toEqual(ids);
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:second.invoice.invoiceId,expectedVersion:1,reason:'TEST K3 cancellation is not delivery',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const eligible=await withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailCohort(tx,tenant,customerId,'pickup',undefined,false,false,{snapshotIds:ids}));
 expect(eligible.map(row=>row.id)).toEqual([first.invoice.invoiceId]);
 expect(await read()).toEqual(ids);expect(await read()).toEqual(ids);
 expect(await withPrivilegedTenantTransaction(auth.data,tx=>readInvoiceMailOpenRemainder(tx,tenant,customerId,ids))).toEqual([first.invoice.invoiceId]);
});
