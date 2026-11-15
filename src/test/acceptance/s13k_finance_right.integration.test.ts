// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {createFixture,withSession,sql} from '../../../e2e/ablauf/replayHarness';
import {resolveAuthorization,hasAuthorizationArea} from '@/lib/server/authorization';

it('K13K-2 existing finance SQL permission follows actual geld rights, not the login role',async()=>{
 const denied=await createFixture([],'developer');
 const allowed=await createFixture(['geld'],'werkstatt');
 for(const fixture of [denied,allowed]){
  const authorization=await withSession(fixture,()=>resolveAuthorization());
  expect(authorization.ok).toBe(true);if(!authorization.ok)throw Error('TEST_AUTHORIZATION_REQUIRED');
  const expected=hasAuthorizationArea(authorization.data,'geld');
  const rows=await sql.begin(async tx=>{
   await tx`SELECT set_config('request.jwt.claim.sub',${fixture.actorId},true)`;
   await tx.unsafe('SET LOCAL ROLE authenticated');
   return tx`SELECT private.current_user_can_view_finance(${tenant}) AS allowed,
    private.current_user_can_view_finance(${tenant+'-other'}) AS other`;
  });
  expect(rows[0]).toEqual({allowed:expected,other:false});
 }
 const anonymous=await sql.begin(async tx=>{
  await tx`SELECT set_config('request.jwt.claim.sub','',true)`;
  await tx.unsafe('SET LOCAL ROLE authenticated');
  return tx`SELECT private.current_user_can_view_finance(${tenant}) AS allowed`;
 });
 expect(anonymous[0].allowed).toBe(false);
 const [grants]=await sql`SELECT has_function_privilege('anon','private.current_user_can_view_finance(text)','EXECUTE') AS anon,
  has_function_privilege('authenticated','private.current_user_can_view_finance(text)','EXECUTE') AS authenticated`;
 expect(grants).toEqual({anon:false,authenticated:true});
});
