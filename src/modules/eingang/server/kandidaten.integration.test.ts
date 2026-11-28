// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from '../../../../e2e/ablauf/replayHarness';
import { createCustomerAction } from '@/app/actions/customers.actions';
import { resolveAuthorization } from '@/lib/server/authorization';
import { searchOrderIntakeCustomers } from '@/lib/server/orderIntakeRead';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { leseKandidatenQuellenInTransaction, sucheKandidatenInTransaction } from './kandidaten';

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
      version: 4, zuordnung: 'offen', hinweiseVollstaendig: false, kundeId: null, kanal: 'mail', ware: false, teile: [],
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

it('ordnet einen belegten Kunden einmal zu und lässt bei zwei gleich sicheren Treffern die Auswahl offen', async () => {
  const domain = 'i2-' + randomUUID() + '.example.invalid';
  const email = 'rechnung@' + domain;
  await withSession(full, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error('TEST_I2_AUTH');
    const customer = async (name: string, address: string, phone: string) => {
      const result = await createCustomerAction({
        clientEventId: randomUUID(), customerType: 'business', companyName: 'TEST ' + name,
        salutation: 'frau', firstName: 'TEST', lastName: name, phone,
        email: address, street: 'TEST Weg', houseNumber: '1', zipCode: '70176', city: 'Stuttgart',
        country: 'DE', paymentPreference: 'vorkasse', handoverPreference: 'shipping',
      });
      if (result.code !== 'OK') throw Error('TEST_I2_CUSTOMER_REQUIRED:'+result.code);
      return result.customer.id;
    };
    const source = async () => {
      const id = randomUUID();
      await sql`INSERT INTO public.intake_item (id,tenant_id,client_key,kanal,quelle,erstellt_von,absender_adresse)
        VALUES (${id},${tenant},${id},'datei','geraet',${auth.data.userId},${email})`;
      return id;
    };
    const run = (itemId: string) => withPrivilegedTenantTransaction(auth.data, tx => sucheKandidatenInTransaction(tx,
      { tenantId: tenant, akteur: auth.data.userId }, itemId, randomUUID(),
      {
        eingang_vorschlaege_max: 1, ki_sicherheitsschwelle: 1,
        eingang_kandidat_stufen: { ustid: 1, adresse: 1, domain: 1, name: 0.6, telefon: 0.8, mailfaden: 1, teil: 0.8, ware_erwartet: 0.6 },
      }, {
        firma: async () => ({ name: 'TEST anderer Betrieb', ustId: null }),
        leseKunden: async (nested, query, _absender, options) => {
          const kunden = await searchOrderIntakeCustomers(auth.data, { query }, options, nested);
          return { kunden, vollstaendig: kunden.length < 10 };
        },
      }));
    const read = (id: string) => sql`SELECT kunde_id,zuordnung FROM public.intake_item WHERE tenant_id=${tenant} AND id=${id}`;
    const readVorschlaege = (id: string) => sql`SELECT wert,grund,regel,status,sicherheit FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND item_id=${id} AND feld='kunde'`;

    const firstCustomer = await customer('Galvano Muster', email, '+49 711 5550101');
    const unique = await source();
    expect(await run(unique)).toBe('ok');
    expect(await run(unique)).toBe('keine');
    expect(await read(unique)).toEqual([{ kunde_id: firstCustomer, zuordnung: 'automatisch' }]);
    expect(await readVorschlaege(unique)).toEqual([{ wert: firstCustomer, grund: 'E-Mail-Adresse stimmt', regel: 'adresse', status: 'uebernommen', sicherheit: 'sicher' }]);
    expect(await sql`SELECT von,nachher->>'kundeId' AS kunde FROM public.intake_event WHERE tenant_id=${tenant}
      AND item_id=${unique} AND art='zugeordnet'`).toEqual([{ von: 'system', kunde: firstCustomer }]);

    await customer('Zink Muster', 'lager@' + domain, '+49 711 5550102');
    const choice = await source();
    expect(await run(choice)).toBe('ok');
    expect(await run(choice)).toBe('ok');
    expect(await read(choice)).toEqual([{ kunde_id: null, zuordnung: 'offen' }]);
    const stored = await readVorschlaege(choice);
    expect(stored.filter(v => v.status === 'offen')).toHaveLength(1);
    expect(stored.filter(v => v.status === 'verworfen')).toHaveLength(1);
  });
});
