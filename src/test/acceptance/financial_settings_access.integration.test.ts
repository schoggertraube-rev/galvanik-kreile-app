// @vitest-environment node
// Isolated TEST tenant, real existing settings/rate Actions, Auth, Postgres and retry.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readSettingsAction,readShippingSettingsAction,saveShippingSettingsAction,saveCatalogServiceAction} from '@/app/actions/settings.actions';
import {getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {emptyDispatchPolicy} from '@/modules/fundament/public';

it('financial settings separate price rates and shipping fees from payment storage charges, preserving operational reads and retries',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST getrennte Einstellungen')`;
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${KREILE_TENANT_SLUG},${feature.id},false)`;
 const prices=await createFixture(['einstellungen','preise','auftraege']),payments=await createFixture(['einstellungen','zahlungen','auftraege']),operator=await createFixture(['einstellungen','auftraege']);
 const read=()=>withSession(full,()=>readShippingSettingsAction());
 const initial=await read();if(initial.code!=='OK')throw Error('TEST_REAL_SETTINGS');
 const request=(row:typeof initial.settings)=>({service:row.service,numberPattern:row.numberPattern,numberHint:row.numberHint,trackingUrl:row.trackingUrl,expectedUpdatedAt:row.updatedAt});
 const policy={...emptyDispatchPolicy(),storageWeeklyCents:3456};
 expect(await withSession(full,()=>saveShippingSettingsAction({...request(initial.settings),shippingFeeCents:7890,dispatchPolicy:policy}))).toMatchObject({code:'OK'});
 const visiblePrices=await withSession(prices,()=>readShippingSettingsAction());if(visiblePrices.code!=='OK')throw Error('TEST_PRICE_SETTINGS');
 expect(visiblePrices.settings.shippingFeeCents).toBe(7890);expect(visiblePrices.settings.dispatchPolicy).not.toHaveProperty('storageWeeklyCents');
 const visiblePayments=await withSession(payments,()=>readShippingSettingsAction());if(visiblePayments.code!=='OK')throw Error('TEST_PAYMENT_SETTINGS');
 expect(visiblePayments.settings).not.toHaveProperty('shippingFeeCents');expect(visiblePayments.settings.dispatchPolicy).toHaveProperty('storageWeeklyCents',3456);
 expect(await withSession(payments,()=>saveShippingSettingsAction({...request(visiblePayments.settings),shippingFeeCents:100}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(prices,()=>saveShippingSettingsAction({...request(visiblePrices.settings),dispatchPolicy:{...policy,storageWeeklyCents:999}}))).toMatchObject({code:'FORBIDDEN'});
 const priceInput={...request(visiblePrices.settings),shippingFeeCents:8000,dispatchPolicy:visiblePrices.settings.dispatchPolicy};
 expect(await withSession(prices,()=>saveShippingSettingsAction(priceInput))).toMatchObject({code:'OK'});
 expect(await withSession(prices,()=>saveShippingSettingsAction(structuredClone(priceInput)))).toMatchObject({code:'OK',replayed:true});
 const next=await read();if(next.code!=='OK')throw Error('TEST_SETTINGS_REREAD');expect(next.settings.dispatchPolicy).toHaveProperty('storageWeeklyCents',3456);
 const payInput={...request(next.settings),dispatchPolicy:{...policy,storageWeeklyCents:4567}};
 expect(await withSession(payments,()=>saveShippingSettingsAction(payInput))).toMatchObject({code:'OK',settings:{dispatchPolicy:{storageWeeklyCents:4567}}});
 expect(await withSession(payments,()=>saveShippingSettingsAction(structuredClone(payInput)))).toMatchObject({code:'OK',replayed:true});
 const stale=await withSession(prices,()=>saveShippingSettingsAction({...priceInput,shippingFeeCents:9000}));expect(stale).toMatchObject({code:'CONFLICT'});
 if(stale.code!=='CONFLICT'||!stale.current)throw Error('TEST_CONFLICT_SOURCE');expect(stale.current.dispatchPolicy).not.toHaveProperty('storageWeeklyCents');
 const hidden=await withSession(operator,()=>readSettingsAction());expect(hidden).toMatchObject({code:'OK',catalogLocked:'Recht Preise & Rechnungen fehlt.',snapshot:{capabilities:{canManageFinancial:false}},services:[]});
 const rateInput={rateId:randomUUID(),expectedVersion:0,hourlyRateCents:12345,clientEventId:randomUUID()};
 expect(await withSession(operator,()=>setExtraWorkHourlyRateAction(rateInput))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(payments,()=>setExtraWorkHourlyRateAction(rateInput))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(prices,()=>setExtraWorkHourlyRateAction(rateInput))).toMatchObject({code:'OK'});
 expect(await withSession(prices,()=>setExtraWorkHourlyRateAction(structuredClone(rateInput)))).toMatchObject({code:'OK',replayed:true});
 const hiddenAfter=await withSession(operator,()=>readSettingsAction());expect(hiddenAfter).toMatchObject({code:'OK',catalogLocked:'Recht Preise & Rechnungen fehlt.',snapshot:{extraWorkHourlyRate:{hourlyRateCents:null}}});
 const priceAfter=await withSession(prices,()=>readSettingsAction());expect(priceAfter).toMatchObject({code:'OK',snapshot:{capabilities:{canManageFinancial:true},extraWorkHourlyRate:{hourlyRateCents:12345}}});
 const master=await withSession(operator,()=>getExtraWorkMasterDataAction());expect(master).toMatchObject({code:'OK',data:{currentRate:{id:rateInput.rateId,hourlyRateCents:null,version:1}}});
 expect(await withSession(prices,()=>getExtraWorkMasterDataAction())).toMatchObject({code:'OK',data:{currentRate:{id:rateInput.rateId,hourlyRateCents:12345}}});
});

it.each([false,true])('K9 settings stay readable; catalog price permission=%s',async prices=>{
 // Explicit TEST setup for this reader, independent of the other scenario.
 const companies=await sql`SELECT company_name FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 if(companies.length===0)await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST K9 Firma')`;
 const [company]=await sql`SELECT company_name FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 if(!company||companies.length>1)throw Error('TEST_K9_COMPANY_SOURCE');
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${KREILE_TENANT_SLUG},${feature.id},false) ON CONFLICT(tenant,feature_id) DO NOTHING`;
 const input={id:null,name:'TEST K9 Katalog '+randomUUID().slice(0,8),surface:'Verchromen',unit:'Stück',netPriceCents:12800,vatRateBasisPoints:1900 as const,standardLeadTimeWorkingDays:6,active:true};
 const saved=await withSession(full,()=>saveCatalogServiceAction(input));
 expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_K9_CATALOG_SETUP:'+saved.code);
 const actor=await createFixture(prices?['einstellungen','preise']:['einstellungen']);
 const read=await withSession(actor,()=>readSettingsAction());
 expect(read).toMatchObject({code:'OK',catalogLocked:prices?null:'Recht Preise & Rechnungen fehlt.',snapshot:{company:{companyName:company.company_name},capabilities:{canManageCompany:true,canManageFinancial:prices}}});
 if(read.code!=='OK')throw Error('TEST_K9_SETTINGS_READ:'+read.code);
 if(prices)expect(read.services).toEqual(expect.arrayContaining([expect.objectContaining({name:input.name,netPriceCents:input.netPriceCents})]));
 else expect(read.services).toEqual([]);
});
