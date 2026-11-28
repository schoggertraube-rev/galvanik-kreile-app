// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({KREILE_TENANT_SLUG:tenant}));

import {full,sql} from '../../e2e/ablauf/replayHarness';
import {liesEingangHinweise} from '@/lib/server/todayProjection';

it('liest die gespeicherte Liegefrist und blendet den deaktivierten Eingang aus',async()=>{
 const seit='2026-11-23T08:00:00+01:00', jetzt=new Date('2026-11-24T09:00:00+01:00');
 const id=randomUUID();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,
  material_aufschlag_prozent,lager_regelversion,eingang_liegefrist_arbeitsstunden)
  VALUES (${randomUUID()},${tenant},'TEST Kreile','TEST Weg 1','70176','Stuttgart','DE',0,'TEST-I2',24)`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E01',true)`;
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,quelle,erstellt_von,wartet_seit)
  VALUES (${id},${tenant},${id},'datei','geraet',${full.actorId},${seit}::timestamptz)`;
 const read=()=>liesEingangHinweise({tenantId:tenant},jetzt);
 expect((await read()).filter(zeile=>zeile.quelleId==='eingang.offen')).toMatchObject([{key:'eingang.offen:datei'}]);
 await sql`UPDATE public.company_settings SET eingang_liegefrist_arbeitsstunden=48 WHERE tenant_id=${tenant}`;
 expect((await read()).filter(zeile=>zeile.quelleId==='eingang.offen')).toEqual([]);
 await sql`UPDATE public.company_settings SET eingang_liegefrist_arbeitsstunden=24 WHERE tenant_id=${tenant}`;
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await read()).toEqual([]);
});
