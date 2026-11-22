// @vitest-environment node
// PLAN_LADEZEIT E-B/E1: isolated TEST tenant, actual commands/Auth/DB/Storage.
// Direct no-op SQL below is explicitly a schema/rollback probe, not a command proof.
import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';

it('creates only private tenant-keyed derived sources with no public read or delete privilege',async()=>{
 const tables=await sql`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relname IN ('today_source_v1','today_tenant_v1') ORDER BY c.relname`;
 expect(tables).toEqual([{relname:'today_source_v1',relrowsecurity:true},{relname:'today_tenant_v1',relrowsecurity:true}]);
 expect(await sql`SELECT has_table_privilege('anon','private.today_source_v1','SELECT') AS anon_read,has_table_privilege('authenticated','private.today_source_v1','SELECT') AS authenticated_read,has_table_privilege('service_role','private.today_source_v1','DELETE') AS can_delete,has_table_privilege('service_role','private.today_source_v1','UPDATE') AS can_refresh`).toEqual([{anon_read:false,authenticated_read:false,can_delete:false,can_refresh:true}]);
 const triggers=await sql`SELECT n.nspname AS schema,c.relname AS name,count(*)::integer AS operations FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND t.tgname IN ('today_mark_insert_v1','today_mark_update_v1','today_mark_delete_v1') GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname`;
 expect(triggers).toHaveLength(39);expect(triggers.every(row=>row.operations===3)).toBe(true);
 expect(triggers).toEqual(expect.arrayContaining([{schema:'public',name:'events',operations:3},{schema:'public',name:'orders',operations:3},{schema:'public',name:'intake_item',operations:3},{schema:'private',name:'evidence_domain_links',operations:3}]));
});

it('marks actual intake, completion, freeze, invoice and settings writes in the same tenant without caching invented payloads',async()=>{
 const result=await readyInvoiceOrder('TEST Today actual invalidation');
 const [source]=await sql`SELECT source_seq::integer,built_seq::integer,status,payload,source_version FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${result.orderId}`;
 expect(source).toMatchObject({built_seq:0,status:'PENDING',payload:null,source_version:null});
 expect(source.source_seq).toBeGreaterThan(1);
 const lists=await sql`SELECT kind,source_id FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'order' ORDER BY kind`;
 expect(lists).toEqual(expect.arrayContaining([{kind:'orders',source_id:'*'},{kind:'money',source_id:'*'}]));
 const [settings]=await sql`SELECT today_read_source,today_refresh_batch_limit,today_refresh_lease_seconds,today_stale_poll_ms,nav_prefetch_max_age_seconds FROM public.company_settings WHERE tenant_id=${tenant}`;
 expect(settings).toEqual({today_read_source:'modell',today_refresh_batch_limit:20,today_refresh_lease_seconds:30,today_stale_poll_ms:1500,nav_prefetch_max_age_seconds:60});
 expect(await sql`SELECT tenant_seq::integer FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{tenant_seq:expect.any(Number)}]);
});

it('rolls source marks back with the original write and deduplicates old/new statement keys',async()=>{
 const [source]=await sql`SELECT source_id,source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' ORDER BY source_id LIMIT 1`;
 expect(source).toBeDefined();
 const original=await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${source.source_id}`;
 const rollback=new Error('TEST_ABORT_TODAY_SOURCE_AND_BUSINESS_WRITE');
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${source.source_id}`;
  expect(await tx`SELECT source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${source.source_id}`).toEqual([{source_seq:source.source_seq+1}]);
  throw rollback;
 })).rejects.toBe(rollback);
 expect(await sql`SELECT source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${source.source_id}`).toEqual([{source_seq:source.source_seq}]);
 expect(await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${source.source_id}`).toEqual(original);
});

it('ignores unchanged role/name/active fields during a PIN-only app-user update',async()=>{
 const before=await sql`SELECT tenant_seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 await sql`UPDATE public.app_users SET pin_hash=pin_hash WHERE tenant_id=${tenant}`;
 expect(await sql`SELECT tenant_seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual(before);
});

it('explicitly classifies every production versioned constant and keeps unknown event types tenant-stale',async()=>{
 const [definition]=await sql`SELECT pg_get_functiondef('private.today_event_scope_v1(text)'::regprocedure) AS source`;
 const files=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n').filter(path=>/\.[cm]?[jt]sx?$/.test(path)&&!/(?:^|\/)(?:test|__tests__)\/|\.(?:test|spec)\.|v45\.generated/.test(path));
 const types=new Set<string>();
 for(const file of files)for(const match of readFileSync(file,'utf8').matchAll(/['"`]([A-Z][A-Z0-9_]*_V\d+)['"`]/g))types.add(match[1]);
 for(const type of types)expect(definition.source,`missing explicit event scope: ${type}`).toContain("'"+type+"'");
 expect(await sql`SELECT private.today_event_scope_v1('TEST_UNKNOWN_FUTURE_V999') AS unknown_scope,private.today_event_scope_v1('USER_LAST_SEEN_RECORDED_V1') AS seen_scope,private.today_event_scope_v1(NULL) AS null_scope`).toEqual([{unknown_scope:'tenant',seen_scope:'none',null_scope:'tenant'}]);
});
