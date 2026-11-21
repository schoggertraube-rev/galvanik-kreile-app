// @vitest-environment node
// Explicit synthetic rows and RSC dispatcher; production cache implementation is React's own.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {readPageReadSettings,readCompanyLetterSettings} from '../server/systemSettingsPort';

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

async function render<T>(work:()=>Promise<T>):Promise<T>{
 if(!test.server)throw Error('TEST_REACT_SERVER_REQUIRED');
 const internals=test.server.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,previous=internals.A;
 const cache=new Map<()=>unknown,unknown>();
 internals.A={getCacheForType<T>(factory:()=>T):T{if(!cache.has(factory))cache.set(factory,factory());return cache.get(factory) as T;}};
 try{return await work();}finally{internals.A=previous;}
}
beforeEach(()=>{
 vi.clearAllMocks();
 test.settings.mockResolvedValue([{page_read_source:{hasQueryTimeout:true,hasInvoiceBatchLimit:true,queryTimeoutMs:10000,invoiceMailBatchLimit:101}}]);
});
afterEach(()=>vi.restoreAllMocks());

it('shares page settings only for the same tenant in the same render and rereads actions',async()=>{
 await render(async()=>{
  const context={tenantId:KREILE_TENANT_SLUG};
  expect(await Promise.all([readPageReadSettings(context),readPageReadSettings({...context})])).toEqual([
   {queryTimeoutMs:10000,invoiceMailBatchLimit:101},{queryTimeoutMs:10000,invoiceMailBatchLimit:101},
  ]);
  expect(test.settings).toHaveBeenCalledTimes(1);
  await readPageReadSettings({tenantId:'TEST-other-tenant'});expect(test.settings).toHaveBeenCalledTimes(2);
 });
 await readPageReadSettings({tenantId:KREILE_TENANT_SLUG});
 await readPageReadSettings({tenantId:KREILE_TENANT_SLUG});
 expect(test.settings).toHaveBeenCalledTimes(4);
});

it('retains letter permission checks before caching and separates each requested identity projection',async()=>{
 test.settings.mockResolvedValue([{companyName:'TEST Firma',street:'TEST Weg',zip:'12345',city:'TEST Ort',country:'Deutschland'}]);
 const context={tenantId:KREILE_TENANT_SLUG,actorId:'TEST-cache-user',canRead:true};
 await render(async()=>{
  expect(await readCompanyLetterSettings({...context,canRead:false})).toEqual({code:'FORBIDDEN'});
  expect(test.settings).not.toHaveBeenCalled();
  expect(await readCompanyLetterSettings(context)).toMatchObject({code:'OK'});
  expect(await readCompanyLetterSettings({...context})).toMatchObject({code:'OK'});
  expect(test.settings).toHaveBeenCalledTimes(1);
  expect(await readCompanyLetterSettings({...context,includeDeliveryNoteIdentity:true})).toMatchObject({code:'OK'});
  expect(test.settings).toHaveBeenCalledTimes(2);
  expect(await readCompanyLetterSettings({...context,canRead:false})).toEqual({code:'FORBIDDEN'});
  expect(test.settings).toHaveBeenCalledTimes(2);
 });
 await readCompanyLetterSettings(context);expect(test.settings).toHaveBeenCalledTimes(3);
});
