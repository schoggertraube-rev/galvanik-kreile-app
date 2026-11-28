// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {confirmIntakeOriginalAction,finishIntakeFileAction,getIntakeMessagesAction,openIntakeOriginalAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {createAdminClient} from '@/lib/supabase/admin';
import {projiziereEingangTagFakten} from '@/lib/server/todayDashboard';
import {projectIntakeMessageSources,readIntakeMessagesForAuthorization} from '@/modules/eingang/server-public';
import {readTodayReadSettings} from '@/modules/fundament/server-public';

it('liest die gespeicherte Liegefrist und blendet den deaktivierten Eingang aus',async()=>{
 const seit='2026-11-23T08:00:00+01:00', jetzt=new Date('2026-11-24T09:00:00+01:00');
 const id=randomUUID();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,
  material_aufschlag_prozent,lager_regelversion,eingang_liegefrist_arbeitsstunden)
  VALUES (${randomUUID()},${tenant},'TEST Kreile','TEST Weg 1','70176','Stuttgart','DE',0,'TEST-I2',24)`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E01',true)`;
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,quelle,erstellt_von,wartet_seit)
  VALUES (${id},${tenant},${id},'datei','geraet',${full.actorId},${seit}::timestamptz)`;
 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I2_TAG_AUTH');
 const auth=session.data;
 const readLive=()=>withSession(full,()=>getIntakeMessagesAction({purpose:'tag',jetzt}));
 const read=async()=>{
  const result=await readLive();
  if(result.code!=='OK'||!result.tagFakten)throw Error('TEST_I2_TAG_FAKTEN');
  return result.tagFakten;
 };
 const live=await readLive();
 const source=await readIntakeMessagesForAuthorization(authorizationReadContext(auth),'offen',undefined,undefined,
  {jetzt,leseEinstellungen:readTodayReadSettings});
 const gelesen=projectIntakeMessageSources(auth,JSON.parse(JSON.stringify(source)));
 if(live.code!=='OK'||!live.tagFakten||gelesen.code!=='OK'||!gelesen.tagFakten)throw Error('TEST_I2_TAG_FAKTEN');
 const erwartung={code:'OK',zeilen:[{key:'eingang.offen:datei',ziel:'/nachrichten',befehl:null}]};
 expect(projiziereEingangTagFakten(auth,live.tagFakten)).toMatchObject(erwartung);
 expect(projiziereEingangTagFakten(auth,gelesen.tagFakten)).toMatchObject(erwartung);
 const ohneMail=await withSession(await createFixture(['eingang']),resolveAuthorization);
 if(!ohneMail.ok)throw Error('TEST_I2_TAG_AUTH_NUR_EINGANG');
 expect(projectIntakeMessageSources(ohneMail.data,source)).toMatchObject({code:'FORBIDDEN'});
 await sql`UPDATE public.company_settings SET eingang_liegefrist_arbeitsstunden=48 WHERE tenant_id=${tenant}`;
 expect(await read()).toEqual({code:'OK',fakten:[]});
 await sql`UPDATE public.company_settings SET eingang_liegefrist_arbeitsstunden=24 WHERE tenant_id=${tenant}`;
 const alt=randomUUID(),itemId=randomUUID(),fileId=randomUUID();
 // Isolierter historischer Eingang ohne belegten Beginn, auch wenn sein Erfassungsdatum alt ist.
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,quelle,erstellt_von,erstellt_am)
  VALUES (${alt},${tenant},${alt},'datei','geraet',${full.actorId},${seit}::timestamptz)`;
 const bytes=readFileSync('e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_liegefrist.xml',mime:'application/xml',
  bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I2_TAG_UPLOAD');
 expect((await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,
  {contentType:'application/xml',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
 const [erfassung]=await sql`SELECT wartet_seit::text AS beginn FROM public.intake_item WHERE tenant_id=${tenant} AND id=${itemId}::uuid`;
 expect(erfassung.beginn).toEqual(expect.any(String));
 const spaeter=await withSession(full,()=>getIntakeMessagesAction({purpose:'tag',jetzt:new Date(Date.parse(erfassung.beginn)+7*86400000)}));
 if(spaeter.code!=='OK'||spaeter.tagFakten?.code!=='OK')throw Error('TEST_I2_TAG_WARTET');
 expect(spaeter.tagFakten.fakten).toEqual(expect.arrayContaining([expect.objectContaining({id:itemId,art:'offen'})]));
 expect(spaeter.tagFakten.fakten).not.toEqual(expect.arrayContaining([expect.objectContaining({id:alt,art:'offen'})]));
 // Synthetische Anbietergrenze: ein lesbares Original mit einem ausdrücklich unsicheren Feld.
 const [unsicher]=await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,regel,grund,status)
  VALUES (${tenant},${itemId}::uuid,${fileId}::uuid,'beleg.nummer','"TEST unklar"'::jsonb,'unsicher','TEST','TEST Anbieterwert','offen') RETURNING id`;
 expect(await read()).toMatchObject({code:'OK',fakten:expect.arrayContaining([expect.objectContaining({id:itemId,art:'unklar'})])});
 expect(await withSession(full,()=>openIntakeOriginalAction({fileId,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>confirmIntakeOriginalAction({fileId,clientEventId:randomUUID()}))).toMatchObject({code:'OK',count:1});
 const nachPruefung=await read();
 if(nachPruefung.code!=='OK')throw Error('TEST_I2_TAG_UNKLAR');
 expect(nachPruefung.fakten).not.toEqual(expect.arrayContaining([expect.objectContaining({id:itemId,art:'unklar'})]));
 expect(await sql`SELECT status,geprueft_am::text AS zeitreferenz FROM public.intake_suggestion WHERE id=${unsicher.id}`)
  .toEqual([{status:'offen',zeitreferenz:expect.any(String)}]);
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await read()).toEqual({code:'OK',fakten:null});
});
