// @vitest-environment node
// One isolated TEST scenario. Every fiscal original is issued by the real Actions;
// setup steps stay below the unchanged per-test limit, no cloned invoice/PDF rows.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {requestMailStep} from '../../../e2e/ablauf/requestMailStep';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';

let customerId:string;
const originals:string[]=[];
type MailCommandArgs=Pick<Parameters<typeof sendCustomerMailAction>[0],'targetType'|'targetId'|'attachment'|'expectedInvoiceIds'>;
let firstInput:Parameters<typeof sendCustomerMailAction>[0]|undefined;
const sentHashes:string[]=[];
const sentSizes:number[]=[];
function retainActualBoundaryBytes(expectedCount:number){
  const mails=vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&String(url).endsWith('/sendMail')&&init?.method==='POST')
    .map(([,init])=>JSON.parse(String(init?.body)).message.attachments as Array<{contentBytes:string}>);
  expect(mails).toHaveLength(1);
  expect(mails[0]).toHaveLength(expectedCount);
  sentSizes.push(mails[0].length);
  sentHashes.push(...mails[0].map(file=>createHash('sha256').update(Buffer.from(file.contentBytes,'base64')).digest('hex')));
}
beforeAll(async()=>{
  const url=process.env.DATABASE_URL;
  if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/postgres')throw Error('TEST_OVERFLOW_LOOPBACK_REQUIRED');
  customerId=await customerFixture('TEST S38 overflow 102 actual originals');
});

it.each(Array.from({length:102},(_,index)=>index))('prepares real immutable fiscal source %i for the one overflow scenario',async index=>{
  const source=await readyInvoiceOrder('TEST overflow '+index,'pickup',false,customerId);
  expect(originals).toHaveLength(index);
  expect(originals).not.toContain(source.invoice.invoiceId);
  originals.push(source.invoice.invoiceId);
  const stored=await sql`SELECT id::text,encode(sha256(pdf_content),'hex')=pdf_sha256 AS original_ok
    FROM public.invoices WHERE tenant_id=${tenant} AND id=${source.invoice.invoiceId}::uuid`;
  expect(stored).toEqual([{id:source.invoice.invoiceId,original_ok:true}]);
});

it('binds exactly the oldest101 while retaining all102 original sources',async()=>{
  expect(originals).toHaveLength(102);
  const before=await withSession(full,()=>getCustomerSummaryAction({customerId}));
  if(before.code!=='OK')throw Error('TEST_OVERFLOW_OVERVIEW_REQUIRED');
  expect(before.data.invoiceUnsentCount).toBe(102);
  expect(before.data.invoiceUnsentOriginals?.map(row=>row.id)).toEqual(originals);
  const command=before.data.nextActionRule?.hauptaktion;
  if(!command||!('befehl'in command))throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
  const args=JSON.parse(JSON.stringify(command.befehl.argumente)) as MailCommandArgs;
  expect(args.expectedInvoiceIds).toEqual(originals.slice(0,101));
  expect(args.attachment).toEqual({kind:'INVOICE',documentId:originals[0]});
  firstInput={...args,clientRequestId:randomUUID(),subject:'TEST oldest 101 originals',body:'TEST gespeicherte Originalgruppe'};
});

it('sends the actual101 original group once and replays the identical saved group',async()=>{
  const input=firstInput;
  if(!input)throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
  await requestMailStep('S38-overflow-first-group');
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  retainActualBoundaryBytes(101);
});

it('makes the remaining original reachable by a fresh actual read and sends only that original',async()=>{
  await requestMailStep('S38-overflow-remainder');
  const after=await withSession(full,()=>getCustomerSummaryAction({customerId}));
  if(after.code!=='OK')throw Error('TEST_OVERFLOW_REMAINING_REQUIRED');
  expect(after.data.invoiceUnsentCount).toBe(1);
  expect(after.data.invoiceUnsentOriginals?.map(row=>row.id)).toEqual([originals[101]]);
  const next=after.data.nextActionRule?.hauptaktion;
  if(!next||!('befehl'in next))throw Error('TEST_OVERFLOW_REMAINING_COMMAND_REQUIRED');
  const remaining=JSON.parse(JSON.stringify(next.befehl.argumente)) as MailCommandArgs;
  expect(remaining.expectedInvoiceIds).toEqual([originals[101]]);
  expect(await withSession(full,()=>sendCustomerMailAction({...remaining,clientRequestId:randomUUID(),subject:'TEST remaining original',body:'TEST gespeichertes Restoriginal'}))).toMatchObject({code:'OK'});
  retainActualBoundaryBytes(1);
});

it('reads no unsent remainder and verifies every actual transmitted PDF against its immutable original',async()=>{
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:0,invoiceUnsentOriginals:[]}});
  expect(sentSizes).toEqual([101,1]);
  const hashes=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId} ORDER BY issued_at,id`;
  expect(sentHashes.slice().sort()).toEqual(hashes.map(row=>row.pdf_sha256).sort());
});
