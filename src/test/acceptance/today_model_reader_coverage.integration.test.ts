// @vitest-environment node
// E-G2 native relation counters, without resetting shared statistics. Acceptance
// already runs one immutable worker at a time; no other local test runs alongside this probe.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {rebuildTodayModel} from '@/lib/server/todayProjection';

const statistics=()=>sql`SELECT schemaname||'.'||relname AS name,(seq_scan+coalesce(idx_scan,0))::text AS reads FROM pg_stat_user_tables WHERE schemaname IN ('public','private') ORDER BY schemaname,relname`;
// PostgreSQL publishes idle-backend statistics asynchronously; this is not a
// business timeout, reset, retry of the rebuild or a replacement data source.
const published=()=>new Promise<void>(resolve=>setTimeout(resolve,1200));
const exceptions=new Map([
 ['private.today_source_v1','Derived model being rebuilt, never an independent business input'],
 ['private.today_tenant_v1','Derived lease and tenant epoch being rebuilt'],
]);

it('E-G2 gives every relation actually read by a full productive rebuild all three invalidation triggers',async()=>{
 await readyInvoiceOrder('TEST read dependency pickup');
 await readyInvoiceOrder('TEST read dependency shipping','shipping');
 await published();
 const before=new Map((await statistics()).map(row=>[row.name,BigInt(row.reads)]));
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 await published();
 const reads=(await statistics()).filter(row=>BigInt(row.reads)>(before.get(row.name)??BigInt(0))).map(row=>row.name);
 const triggers=await sql`SELECT n.nspname||'.'||c.relname AS name,count(*)::integer AS operations FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND t.tgname IN ('today_mark_insert_v1','today_mark_update_v1','today_mark_delete_v1') GROUP BY n.nspname,c.relname`;
 const covered=new Set(triggers.filter(row=>row.operations===3).map(row=>row.name));
 expect(reads).toEqual(expect.arrayContaining(['public.orders','public.items','public.events','public.app_users','public.app_user_rights']));
 expect(reads.filter(name=>!covered.has(name)&&!exceptions.has(name)),'read relation without INSERT/UPDATE/DELETE invalidation').toEqual([]);
});
