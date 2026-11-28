// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {chooseIntakeCaptureKindAction,finishIntakeFileAction,getGoodsReceiptsAction,getIntakeCaptureAction,getIntakeMessagesAction,
 legePaketOhneBezugAbAction,verknuepfePaketOhneBezugAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {projiziereEingangTagFakten} from '@/lib/server/todayDashboard';
import {customerFixture,intakeOrderFixture} from '../../e2e/ablauf/orderFixture';
import {storeIntakeGoodsPhoto} from '../../e2e/ablauf/photoFixture';

const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'){
 throw Error('I3_WARE_LOOPBACK_REQUIRED');
}

it('legt das Original am angegebenen Ort ab und verbindet es später einmalig mit dem echten Auftrag',async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',false)
  ON CONFLICT(tenant,feature_id) DO UPDATE SET enabled=false`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E01',true)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,
  material_aufschlag_prozent,lager_regelversion,eingang_liegefrist_arbeitsstunden,ki_sicherheitsschwelle)
  VALUES (${randomUUID()},${tenant},'TEST Kreile','TEST Weg 1','70176','Stuttgart','DE',0,'TEST-I3',24,0.95)`;
 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I3_TAG_AUTH');
 const auth=session.data;
 const paketZeilen=async()=>{
  const tag=await withSession(full,()=>getIntakeMessagesAction({purpose:'tag',jetzt:new Date()}));
  if(tag.code!=='OK'||!tag.tagFakten)throw Error('TEST_I3_TAG_LESEN');
  const lesestand=projiziereEingangTagFakten(auth,tag.tagFakten);
  if(lesestand.code!=='OK')throw Error('TEST_I3_TAG_QUELLE');
  return lesestand.zeilen.filter(eintrag=>eintrag.quelleId==='eingang.paketohnebezug');
 };
 const {itemId,fileId}=await storeIntakeGoodsPhoto();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
 const lesen=()=>withSession(full,()=>getIntakeCaptureAction(itemId,undefined,{packageExpectation:false}));
 const davor=await lesen();
 if(davor.code!=='OK')throw Error('TEST_I3_PAKET_QUELLE:'+davor.code);
 expect(davor.capture.concerns).toContain('ware_ohne_bezug');
 expect(await paketZeilen()).toEqual([]);
 const ware=await withSession(full,()=>chooseIntakeCaptureKindAction({itemId,version:davor.capture.version,
  clientEventId:randomUUID(),kind:'ware'}));
 if(ware.code!=='OK')throw Error('TEST_I3_PAKET_ART:'+ware.code);
 const ablage={itemId,version:ware.capture.version,befehlId:randomUUID(),ort:'TEST Regal 2'};
 expect(await withSession(full,()=>legePaketOhneBezugAbAction({...ablage,ort:''}))).toMatchObject({code:'VALIDATION_ERROR'});
 const abgelegt=await withSession(full,()=>legePaketOhneBezugAbAction(ablage));
 expect(abgelegt).toMatchObject({code:'OK',paket:{itemId,ort:ablage.ort,auftragId:null,verknuepftAm:null},wiederholt:false});
 if(abgelegt.code!=='OK')throw Error('TEST_I3_PAKET_ABLAGE:'+abgelegt.code);
 expect(await paketZeilen()).toMatchObject([{key:'eingang.paketohnebezug:'+abgelegt.paket.id,
  gegenstand:'Paket ohne Bezug liegt in TEST Regal 2',ziel:'/nachrichten'}]);
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await paketZeilen()).toEqual([]);
 await sql`UPDATE public.tenant_features SET enabled=true WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await withSession(full,()=>legePaketOhneBezugAbAction({...ablage})))
  .toEqual({...abgelegt,wiederholt:true});
 expect(await lesen()).toMatchObject({code:'OK',capture:{orderId:null,concerns:expect.arrayContaining(['ware_ohne_bezug']),
  files:[{id:fileId,secured:true}]}});
 const kunde=await customerFixture('I3 Paket'),auftrag=await intakeOrderFixture('I3 Paket',kunde);
 const bindung={goodsReceiptId:abgelegt.paket.id,version:abgelegt.paket.version,befehlId:randomUUID(),auftragId:auftrag.receipt.orderId};
 expect(await withSession(full,()=>verknuepfePaketOhneBezugAction({...bindung,auftragId:randomUUID()})))
  .toMatchObject({code:'VALIDATION_ERROR'});
 const gebunden=await withSession(full,()=>verknuepfePaketOhneBezugAction(bindung));
 expect(gebunden).toMatchObject({code:'OK',paket:{id:abgelegt.paket.id,ort:ablage.ort,auftragId:bindung.auftragId,
  version:abgelegt.paket.version+1,verknuepftAm:expect.any(String)},wiederholt:false});
 expect(await withSession(full,()=>verknuepfePaketOhneBezugAction({...bindung}))).toEqual({...gebunden,wiederholt:true});
 expect(await paketZeilen()).toEqual([]);
 expect(await lesen()).toMatchObject({code:'OK',capture:{orderId:bindung.auftragId,files:[{id:fileId,secured:true}]}});
 expect(await withSession(full,()=>getGoodsReceiptsAction(bindung.auftragId))).toMatchObject({code:'OK',receipts:[]});
 expect(await sql`SELECT art,befehl_id AS befehl,nachher->'paket'->>'ort' AS ort FROM public.intake_event
  WHERE tenant_id=${tenant} AND item_id=${itemId} AND art='ware' ORDER BY zeit`)
  .toEqual([{art:'ware',befehl:ablage.befehlId,ort:ablage.ort},{art:'ware',befehl:bindung.befehlId,ort:ablage.ort}]);
});
