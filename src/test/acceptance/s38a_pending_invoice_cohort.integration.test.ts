// @vitest-environment node
// Real original Actions/Auth/DB/Storage; only the external Graph boundary is doubled.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';

it('preserves the saved pending group when another real original arrives and retains the remainder until actual acknowledgement',async()=>{
  const first=await readyInvoiceOrder('TEST pending original group');
  let attempts=0;
  const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
    const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-pending-cohort-provider-token'.repeat(4),expires_in:3600});
    if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){attempts++;throw new TypeError('TEST external reply lost');}
    if(url.hostname==='graph.microsoft.com')return Response.json({value:[]});
    return nativeFetch(request,init);
  });
  try{
    const originalInput={targetType:'CUSTOMER' as const,targetId:first.customerId,
      attachment:{kind:'INVOICE' as const,documentId:first.invoice.invoiceId},expectedInvoiceIds:[first.invoice.invoiceId],
      subject:'TEST pending saved group',body:'TEST unveraendertes Original',clientRequestId:randomUUID()};
    expect((await withSession(full,()=>sendCustomerMailAction(originalInput))).code).not.toBe('OK');
    const second=await readyInvoiceOrder('TEST later original after PREPARE','pickup',false,first.customerId);
    const reread=await withSession(full,()=>getCustomerSummaryAction({customerId:first.customerId}));
    expect(reread).toMatchObject({code:'OK',data:{invoiceUnsentCount:2,
      invoiceUnsentOriginals:[{id:first.invoice.invoiceId},{id:second.invoice.invoiceId}],
      invoiceSendGroupIds:[first.invoice.invoiceId],nextActionRule:{hauptaktion:{befehl:{argumente:{
        attachment:{kind:'INVOICE',documentId:first.invoice.invoiceId},expectedInvoiceIds:[first.invoice.invoiceId],
      }}}}}});
    if(reread.code!=='OK'||!reread.data.nextActionRule?.hauptaktion||!('befehl'in reread.data.nextActionRule.hauptaktion))throw Error('TEST_PENDING_SAVED_GROUP_REQUIRED');
    const args=JSON.parse(JSON.stringify(reread.data.nextActionRule.hauptaktion.befehl.argumente)) as Pick<typeof originalInput,'targetType'|'targetId'|'attachment'|'expectedInvoiceIds'>;
    expect((await withSession(full,()=>sendCustomerMailAction({...originalInput,...args,clientRequestId:randomUUID()}))).code).not.toBe('OK');
    expect((await withSession(full,()=>sendCustomerMailAction({...originalInput,
      attachment:{kind:'INVOICE',documentId:second.invoice.invoiceId},expectedInvoiceIds:[second.invoice.invoiceId],
      clientRequestId:randomUUID()}))).code).not.toBe('OK');
    expect(attempts).toBe(1);
  }finally{provider.mockRestore();}
});
