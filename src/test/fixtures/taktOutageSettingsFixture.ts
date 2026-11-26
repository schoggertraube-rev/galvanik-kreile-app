import {randomUUID} from 'node:crypto';
import {sql} from '../../../e2e/ablauf/replayHarness';

/** Isolated TEST settings for a genuine Takt read. Company settings are outside the Takt module. */
export function createTaktOutageSettingsFixture(tenantId: string) {
  if (!tenantId.startsWith('TEST-ablauf-takt-stoerung-')) throw Error('TEST_TAKT_SETTINGS_TENANT_REQUIRED');
  return {
    async create(hours: number) {
      await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,dienst_ausfall_toleranz_stunden,
        material_aufschlag_prozent,lager_regelversion)
        VALUES(${randomUUID()}::uuid,${tenantId},'TEST Takt und Neustart',${hours},20,'TEST-Ablauf')`;
    },
    async setTolerance(hours: number) {
      await sql`UPDATE public.company_settings SET dienst_ausfall_toleranz_stunden=${hours} WHERE tenant_id=${tenantId}`;
    },
    async remove() {
      await sql`DELETE FROM public.company_settings WHERE tenant_id=${tenantId}`;
    },
  };
}
