// @vitest-environment node
// Actual invoice writer/Auth/DB/Storage. No synthetic original or VAT insert.
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {readInvoiceVat} from '@/modules/accounting/server-public';
it('S05K A4 canonical VAT reader consumes the actual stored original without changing it',async()=>{
 const fixture=await readyInvoiceOrder('A4 VAT reader');
 const [before]=await sql`SELECT snapshot,pdf_sha256,net_amount_cents,vat_rate_basis_points,vat_amount_cents,gross_amount_cents FROM public.invoices WHERE tenant_id=${tenant} AND id=${fixture.invoice.invoiceId}::uuid`;
 expect(readInvoiceVat(before.snapshot)).toMatchObject({netAmountCents:fixture.invoice.netAmountCents,vatAmountCents:fixture.invoice.vatAmountCents,grossAmountCents:fixture.invoice.grossAmountCents,groups:[{rateBp:1900}]});
 expect(readInvoiceVat(before)).toEqual(readInvoiceVat(before.snapshot));
 expect(readInvoiceVat(JSON.parse(JSON.stringify(before.snapshot)))).toEqual(readInvoiceVat(before.snapshot));
 const [after]=await sql`SELECT snapshot,pdf_sha256,net_amount_cents,vat_rate_basis_points,vat_amount_cents,gross_amount_cents FROM public.invoices WHERE tenant_id=${tenant} AND id=${fixture.invoice.invoiceId}::uuid`;
 expect(after).toEqual(before);
 const cancel={invoiceId:fixture.invoice.invoiceId,expectedVersion:1,reason:'TEST A4 VAT Storno',clientEventId:globalThis.crypto.randomUUID()};
 expect(await withSession(full,()=>cancelInvoiceAction(cancel))).toMatchObject({code:'OK',receipt:{invoiceId:fixture.invoice.invoiceId,status:'cancelled'}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(cancel))))).toMatchObject({code:'OK',replayed:true});

});
