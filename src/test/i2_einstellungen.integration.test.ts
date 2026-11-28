// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {liesNachrichtenFuerTag} from '@/lib/server/todayProjection';
import {projiziereEingangTagFakten} from '@/lib/server/todayDashboard';
import {projectIntakeMessageSources,readIntakeMessagesForAuthorization} from '@/modules/eingang/server-public';

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
 const read=async()=>{
  const result=await liesNachrichtenFuerTag(auth,jetzt);
  if(result.code!=='OK'||!result.tagFakten)throw Error('TEST_I2_TAG_FAKTEN');
  return result.tagFakten;
 };
 const live=await liesNachrichtenFuerTag(auth,jetzt);
 const source=await readIntakeMessagesForAuthorization(authorizationReadContext(auth),'offen',undefined,undefined,read);
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
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await read()).toEqual({code:'OK',fakten:null});
});
