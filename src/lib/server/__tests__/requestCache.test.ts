// @vitest-environment node
// Explicit synthetic rows and RSC dispatcher; production cache implementation is React's own.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PACKAGE_SWITCHES} from '@/modules/fundament/public';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {resolveAuthorization} from '../authorization';

type Dispatcher={getCacheForType:<T>(factory:()=>T)=>T};
const test=vi.hoisted(()=>({
 where:vi.fn(),session:vi.fn(),settings:vi.fn(),attempt:vi.fn(),observed:vi.fn(),
 server:null as null|{__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{A:Dispatcher|null}},
}));
vi.mock('react',async original=>{
 const {createRequire}=await import('node:module');
 const {join}=await import('node:path');
 const require=createRequire(import.meta.url);
 const server=require(join(process.cwd(),'node_modules/react/cjs/react.react-server.development.js'));
 test.server=server;
 return {...await original<typeof import('react')>(),cache:server.cache};
});
vi.mock('@/db',()=>({db:{select:()=>({from:()=>({where:test.where})})}}));
vi.mock('@/lib/server/appSession',()=>({readAppSession:test.session}));
vi.mock('@/lib/server/actionObservation',()=>({observeAuthorizationAttempt:test.attempt,observeResolvedAuthorization:test.observed,reportObservedTechnical:vi.fn()}));
vi.mock('@/lib/server/privilegedDb',()=>({
 withPrivilegedTenantTransaction:async(_context:unknown,work:(tx:{execute:typeof test.settings})=>unknown)=>work({execute:test.settings}),
 withTenantSavepoint:async(tx:unknown,work:(tx:unknown)=>unknown)=>work(tx),
}));

const session=()=>({ok:true as const,session:{userId:'TEST-cache-user',tenantId:KREILE_TENANT_SLUG,role:'werkstatt',displayName:'TEST Cache',issuedAt:1000,expiresAt:Date.now()+10000}});
const user=()=>({id:'TEST-cache-user',tenantId:KREILE_TENANT_SLUG,fullName:'TEST Cache',role:'werkstatt',active:true,areas:['auftraege'],updatedAt:new Date(0),packageFlags:PACKAGE_SWITCHES.map(({id})=>({id,enabled:false,roles:[]}))});
async function render<T>(work:()=>Promise<T>):Promise<T>{
 if(!test.server)throw Error('TEST_REACT_SERVER_REQUIRED');
 const internals=test.server.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,previous=internals.A;
 const cache=new Map<()=>unknown,unknown>();
 internals.A={getCacheForType<T>(factory:()=>T):T{if(!cache.has(factory))cache.set(factory,factory());return cache.get(factory) as T;}};
 try{return await work();}finally{internals.A=previous;}
}
beforeEach(()=>{
 vi.clearAllMocks();
 test.session.mockResolvedValue(session());test.where.mockResolvedValue([user()]);
 test.settings.mockResolvedValue([{page_read_source:{hasQueryTimeout:true,hasInvoiceBatchLimit:true,queryTimeoutMs:10000,invoiceMailBatchLimit:101}}]);
});
afterEach(()=>vi.restoreAllMocks());

it('shares only the raw rights row within an RSC request and still checks every session and role',async()=>{
 await render(async()=>{
  const results=await Promise.all(Array.from({length:5},()=>resolveAuthorization()));
  expect(results.every(result=>result.ok)).toBe(true);
  expect(test.where).toHaveBeenCalledTimes(1);expect(test.session).toHaveBeenCalledTimes(5);
  expect(test.attempt).toHaveBeenCalledTimes(5);expect(test.observed).toHaveBeenCalledTimes(5);
  test.session.mockResolvedValue({...session(),session:{...session().session,role:'admin'}});
  expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'ROLE_MISMATCH'});
  expect(test.where).toHaveBeenCalledTimes(1);expect(test.session).toHaveBeenCalledTimes(6);
 });
});

it('does not carry a row across renders or actions and observes deactivation and issued-at revocation',async()=>{
 expect(await render(()=>resolveAuthorization())).toMatchObject({ok:true});
 test.where.mockResolvedValue([{...user(),active:false}]);
 expect(await render(()=>resolveAuthorization())).toMatchObject({ok:false,reason:'USER_INACTIVE'});
 test.where.mockResolvedValue([{...user(),updatedAt:new Date(2000)}]);
 expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'SESSION_REVOKED'});
 test.where.mockResolvedValue([user()]);
 expect(await resolveAuthorization()).toMatchObject({ok:true});
 expect(test.where).toHaveBeenCalledTimes(4);
});

it('keys the raw row by real user and tenant and never caches a session failure',async()=>{
 await render(async()=>{
  expect(await resolveAuthorization()).toMatchObject({ok:true});
  test.session.mockResolvedValue({...session(),session:{...session().session,userId:'TEST-second-user'}});
  test.where.mockResolvedValue([{...user(),id:'TEST-second-user'}]);
  expect(await resolveAuthorization()).toMatchObject({ok:true,data:{userId:'TEST-second-user'}});
  test.session.mockResolvedValue({ok:false,reason:'NO_COOKIE'});
  expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'NO_SESSION'});
  test.session.mockResolvedValue({...session(),session:{...session().session,tenantId:'TEST-other-tenant'}});
  expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'INVALID_SESSION'});
  expect(test.where).toHaveBeenCalledTimes(2);expect(test.session).toHaveBeenCalledTimes(4);
 });
});

it('reuses a rejected row only inside its request and fails closed on every caller',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>undefined);
 test.where.mockRejectedValue(new Error('TEST raw rights source failure'));
 await render(async()=>{
  expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'AUTHORIZATION_UNAVAILABLE'});
  expect(await resolveAuthorization()).toMatchObject({ok:false,reason:'AUTHORIZATION_UNAVAILABLE'});
  expect(test.where).toHaveBeenCalledTimes(1);
 });
 test.where.mockResolvedValue([user()]);
 expect(await render(()=>resolveAuthorization())).toMatchObject({ok:true});
 expect(test.where).toHaveBeenCalledTimes(2);expect(log).toHaveBeenCalledTimes(2);
});
