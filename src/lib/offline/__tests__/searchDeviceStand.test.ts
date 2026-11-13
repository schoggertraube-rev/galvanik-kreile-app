import {afterEach,expect,it,vi} from 'vitest';
import {searchDeviceStand} from '../searchDeviceStand';
import {SEARCH_NAME_MATCH_COPY} from '@/ui/situationCatalog';
const state=vi.hoisted(()=>({login:'a'.repeat(64)}));
const ports=vi.hoisted(()=>({stand:vi.fn(),read:vi.fn()}));
vi.mock('../cacheScopeMarker',()=>({readCacheScopeMarker:()=>state.login}));
vi.mock('../devicePortRead',()=>({readDeviceStandResponse:ports.stand,readDevicePortResponse:ports.read}));
afterEach(()=>{vi.resetAllMocks();state.login='a'.repeat(64);});
// Explicit synthetic cache-boundary fixtures. Matching/ranking is the real search engine.
function source(){
 const stamp='2026-11-12T08:00:00.000Z';
 ports.stand.mockResolvedValue({code:'OK',serverReadAt:stamp,cacheGeneration:3});
 ports.read.mockImplementation(async(_scope,_enabled,target)=>target.port==='orders.list'?{code:'OK',value:{port:target.port,response:{result:{ok:true,data:[]}}}}:{code:'OK',value:{port:target.port,response:{result:{ok:true,data:[{id:'TEST-customer',name:'Müller',customerNumber:'K-TEST-1',type:'business',companyName:'TEST Müller GmbH',city:'Fürth'}]}}}});
 return stamp;
}
it('uses the canonical phonetic reason on the actual cached name, including an old readable stand',async()=>{
 const stamp=source(),result=await searchDeviceStand('b'.repeat(64),true,'Müler');
 expect(result).toMatchObject({code:'OK',checkedAt:stamp,checkedSources:['Auftragsbestand','Kundenstamm'],hits:[{id:'TEST-customer',type:'CUSTOMER',matchKind:'phonetic',matchLabel:SEARCH_NAME_MATCH_COPY.phonetic}]});
});
it('a denied cached source is unavailable rather than searched with zero hits',async()=>{
 source();ports.read.mockResolvedValueOnce({code:'OK',value:{port:'orders.list',response:{result:{ok:true,data:[]}}}}).mockResolvedValueOnce({code:'OK',value:{port:'customers.list',response:{result:{ok:false,error:'FORBIDDEN',message:'TEST denied'}}}});
 expect(await searchDeviceStand('b'.repeat(64),true,'Müler')).toMatchObject({code:'OK',checkedSources:['Auftragsbestand'],failedSources:['Kundenstamm'],coverage:{truncated:true}});
});
it('a late reply after login or generation change never publishes old hits',async()=>{
 const stamp=source();ports.stand.mockResolvedValueOnce({code:'OK',serverReadAt:stamp,cacheGeneration:3}).mockResolvedValueOnce({code:'OK',serverReadAt:stamp,cacheGeneration:4});
 expect(await searchDeviceStand('b'.repeat(64),true,'Müler')).toMatchObject({code:'UNAVAILABLE'});
 source();ports.stand.mockImplementationOnce(async()=>({code:'OK',serverReadAt:stamp,cacheGeneration:3})).mockImplementationOnce(async()=>{state.login='c'.repeat(64);return {code:'OK',serverReadAt:stamp,cacheGeneration:3};});
 expect(await searchDeviceStand('b'.repeat(64),true,'Müler')).toMatchObject({code:'UNAVAILABLE'});
});
it('disabled or incomplete device storage is explicit and never falls back to a network search',async()=>{
 expect(await searchDeviceStand('b'.repeat(64),false,'Müler')).toMatchObject({code:'UNAVAILABLE'});expect(ports.read).not.toHaveBeenCalled();
 ports.stand.mockResolvedValue({code:'EMPTY',reason:'NO_COMPLETION'});
 expect(await searchDeviceStand('b'.repeat(64),true,'Müler')).toMatchObject({code:'UNAVAILABLE'});expect(ports.read).not.toHaveBeenCalled();
});
