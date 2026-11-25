import {beforeEach,expect,it,vi} from 'vitest';
import {PACKAGE_SWITCHES,mapPackageSwitchRows} from '../featureCatalog';
const mocks=vi.hoisted(()=>({execute:vi.fn(),transaction:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/privilegedDb',()=>({withPrivilegedTenantTransaction:mocks.transaction}));
import {readPackageSwitches,readPackageSwitchValuesForTakt} from '../server/packageFeaturePort';
const context={tenantId:'TEST-package-source',actorId:'11111111-1111-4111-8111-111111111111',role:'meister' as const,canManage:true};
// Explicit synthetic rows exercise read failures; writes have real native tests.
const flags=()=>PACKAGE_SWITCHES.map(({id})=>({id,enabled:false,roles:[] as string[]}));
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.transaction.mockImplementation(async(_context,work)=>work({execute:mocks.execute}));
 mocks.execute.mockResolvedValue(flags());
});
it('projects validated config values without introducing a second role decision',async()=>{
 const rows=flags().map(row=>({...row,enabled:true,roles:row.id==='offline_24h'?['meister']:[]}));
 mocks.execute.mockResolvedValue(rows);
 expect(mapPackageSwitchRows(rows)).toMatchObject({offline_24h:true,p2_eingang:true});
 expect(await readPackageSwitches(context)).toMatchObject({code:'OK',switches:{offline_24h:true,p2_eingang:true}});
});
it('reads the same tenant package source for Takt without a write actor',async()=>{
 const values=await readPackageSwitchValuesForTakt(context.tenantId);
 expect(values.p4_lager).toBe(false);
 expect(mocks.transaction).toHaveBeenCalledWith({tenantId:context.tenantId},expect.any(Function));
 mocks.execute.mockResolvedValueOnce(flags().slice(1));
 await expect(readPackageSwitchValuesForTakt(context.tenantId)).rejects.toThrow('PACKAGE_SWITCH_SET_INCOMPLETE');
});
it('does not replace a missing flag source with false or an empty result',async()=>{
 mocks.execute.mockResolvedValue(flags().slice(1));
 expect(()=>mapPackageSwitchRows(flags().slice(1))).toThrow('PACKAGE_SWITCH_SET_INCOMPLETE');
 expect(await readPackageSwitches(context)).toMatchObject({code:'UNAVAILABLE'});
});
it('rejects a null value and an unexpected package role filter as unknown source',async()=>{
 mocks.execute.mockResolvedValue(flags().map(row=>row.id==='p2_eingang'?{...row,enabled:null}:row));
 expect(await readPackageSwitches(context)).toMatchObject({code:'UNAVAILABLE'});
 mocks.execute.mockResolvedValue(flags().map(row=>row.id==='p2_eingang'?{...row,roles:['meister']}:row));
 expect(await readPackageSwitches(context)).toMatchObject({code:'UNAVAILABLE'});
});
