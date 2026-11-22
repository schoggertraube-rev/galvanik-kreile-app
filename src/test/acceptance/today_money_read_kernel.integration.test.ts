// @vitest-environment node
// Isolated TEST tenant; real immutable invoice writer and existing money SQL.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext,type AuthorizedReadContext} from '@/lib/server/authorizationReadContext';
import {readTodayMoneySupport,todaySourceAccess} from '@/lib/server/todayDashboard';

it('retains 0/1/multiple actual invoice originals and applies the same payment/mail gates without personal data',async()=>{
 const fixtures=[full,await createFixture(['zahlungen']),await createFixture(['preise']),await createFixture(['auftraege']),await createFixture(['mails'])];
 const ids:string[]=[];
 const [clock]=await sql`SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS today`;
 for(let count=0;count<=2;count++){
  if(count){const created=await readyInvoiceOrder('TEST shared money source '+count);ids.push(created.invoice.invoiceId);}
  const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
  for(const fixture of fixtures){
   const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_MONEY_SOURCE_AUTH');
   const callback=authorizationReadContext(result.data),areas=new Set(result.data.areas);
   const projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.has(area)};
   const live=await readTodayMoneySupport(result.data,clock.today,todaySourceAccess(callback));
   expect(await readTodayMoneySupport(callback,clock.today)).toEqual(live);
   expect(await readTodayMoneySupport(projection,JSON.parse(JSON.stringify(clock.today)))).toEqual(live);
   expect(live).not.toHaveProperty('currentLogin');expect(live).not.toHaveProperty('preferences');expect(live).not.toHaveProperty('reminders');expect(live).not.toHaveProperty('assignments');
   expect(live.invoiceSource.code).toBe('OK');expect(live.prepaymentSource.code).toBe('OK');expect(live.collectionSource.code).toBe('OK');
   expect(live.invoices.map(row=>row.id).sort()).toEqual(callback.canReadArea('zahlungen')?[...ids].sort():[]);
   if(callback.canReadArea('preise')){
    expect(live.invoiceMailSource.code).toBe('OK');
    if(live.invoiceMailSource.code!=='OK')throw Error('TEST_INVOICE_ORIGINAL_SOURCE');
    expect(live.invoiceMailSource.data.groups.flatMap(group=>group.ids).sort()).toEqual([...ids].sort());
   }else expect(live.invoiceMailSource).toEqual({code:'OK',data:{groups:[],missing:[]}});
  }
  expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
 }
});
