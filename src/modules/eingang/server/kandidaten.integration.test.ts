// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-i2-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from '../../../../e2e/ablauf/replayHarness';
import { resolveAuthorization } from '@/lib/server/authorization';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { leseKandidatenQuellenInTransaction } from './kandidaten';

it('liest gespeicherte Absenderdaten und lässt einen widersprüchlichen Lieferantenhinweis offen', async () => {
  const itemId = randomUUID();
  const secondHint = randomUUID();
  await withSession(full, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error('TEST_I2_AUTH');
    await sql`INSERT INTO public.intake_item
      (id,tenant_id,client_key,kanal,quelle,erstellt_von,absender_adresse,absender_name,absender_telefon,version)
      VALUES (${itemId},${tenant},${itemId},'mail','mailabruf',${auth.data.userId},
        'rechnung@ablauf.example','Galvano Huber','0711 123456',4)`;
    await sql`INSERT INTO public.intake_suggestion (id,tenant_id,item_id,feld,wert,sicherheit,status) VALUES
      (${randomUUID()},${tenant},${itemId},'lieferant.name','"Galvano Huber"','vorschlag','offen'),
      (${randomUUID()},${tenant},${itemId},'lieferant.ustid','"DE000000001"','sicher','uebernommen'),
      (${secondHint},${tenant},${itemId},'lieferant.ustid','"DE000000002"','vorschlag','offen'),
      (${randomUUID()},${tenant},${itemId},'lieferant.name','"Alte Fassung"','vorschlag','verworfen')`;

    const read = (id: string) => withPrivilegedTenantTransaction(auth.data,
      tx => leseKandidatenQuellenInTransaction(tx, auth.data.tenantId, id));
    expect(await read(itemId)).toEqual({
      version: 4, zuordnung: 'offen', hinweiseVollstaendig: false,
      eingang: {
        absenderAdresse: 'rechnung@ablauf.example', absenderName: 'Galvano Huber', absenderTelefon: '0711 123456',
        lieferantenUstId: null, lieferantenName: 'Galvano Huber',
      },
    });

    await sql`UPDATE public.intake_suggestion SET status='verworfen'
      WHERE tenant_id=${tenant} AND id=${secondHint}`;
    expect(await read(itemId)).toMatchObject({ hinweiseVollstaendig: true, eingang: { lieferantenUstId: 'DE000000001' } });
    expect(await read(randomUUID())).toBeNull();
  });
});
