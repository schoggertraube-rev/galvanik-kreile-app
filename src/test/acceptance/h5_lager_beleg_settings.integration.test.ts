// @vitest-environment node
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {sql} from '../../../e2e/ablauf/replayHarness';
import {invoiceCompanySettingsFixture} from '../../../e2e/ablauf/orderFixture';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readLagerBelegEinstellungen} from '@/modules/fundament/server-public';

it('liest offene und gespeicherte Lagerbelegwerte aus den Einstellungen des Betriebs',async()=>{
  const empty={lager_beleg_preisabweichung_prozent:null,lager_beleg_abgleich_tage:null};
  expect(await readLagerBelegEinstellungen(tenant)).toMatchObject(empty);
  await invoiceCompanySettingsFixture();
  expect(await readLagerBelegEinstellungen(tenant)).toMatchObject(empty);

  // Isolated fixture values. The reader uses the same stored row and has no substitute defaults.
  const values={lager_beleg_preisabweichung_prozent:0,lager_beleg_abgleich_tage:14,ki_sicherheitsschwelle:0.8};
  const written=await sql`UPDATE public.company_settings
    SET lager_beleg_preisabweichung_prozent=0,lager_beleg_abgleich_tage=14,ki_sicherheitsschwelle=0.8
    WHERE tenant_id=${tenant} RETURNING tenant_id`;
  expect(written).toEqual([{tenant_id:tenant}]);
  expect(await readLagerBelegEinstellungen(tenant)).toEqual(values);
  await withPrivilegedTenantTransaction({tenantId:tenant},async tx=>{
    expect(await readLagerBelegEinstellungen(tenant,tx)).toEqual(values);
    await expect(readLagerBelegEinstellungen(tenant+'-other',tx)).rejects.toThrow('S16D_FIRMENDATEN_NICHT_EINDEUTIG');
  });
  await expect(sql`UPDATE public.company_settings SET lager_beleg_preisabweichung_prozent=-1 WHERE tenant_id=${tenant}`)
    .rejects.toMatchObject({code:'23514'});
  await expect(sql`UPDATE public.company_settings SET lager_beleg_abgleich_tage=0 WHERE tenant_id=${tenant}`)
    .rejects.toMatchObject({code:'23514'});
  expect(await readLagerBelegEinstellungen(tenant)).toEqual(values);
});
