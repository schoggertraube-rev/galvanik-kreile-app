import 'server-only';
import {readBetriebswaechterEinstellungenInTransaction,readLoggingSettings,readPackageSwitchValuesForTakt} from '@/modules/fundament/server-public';
import type {PackageSwitchId,PackageSwitchValues} from '@/modules/fundament/public';
import {taktJobs as loggingTaktJobs} from '@/modules/logging/server-public';
import {HEUTE_TAKT_JOBS} from '@/lib/today/taktJobs';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {TaktJob, TaktLeser} from './public';

/** One list for the runner; Fach modules own their individual jobs. */
export const TAKT_JOBS = [...HEUTE_TAKT_JOBS, ...loggingTaktJobs] as const satisfies readonly TaktJob[];

export async function liesTaktAusfallToleranzInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const settings = await readBetriebswaechterEinstellungenInTransaction(tx, tenantId);
  return settings.dienst_ausfall_toleranz_stunden;
}

/** One lazy read per tenant pass, shared by every package-bound job. */
export function bauePaketAktiv(tenantId:string,read:(tenantId:string)=>Promise<PackageSwitchValues>=readPackageSwitchValuesForTakt){
 let values:Promise<PackageSwitchValues>|undefined;
 return async(paket:PackageSwitchId):Promise<boolean>=>{
  values??=read(tenantId);
  return (await values)[paket]===true;
 };
}

/** Settings stay behind the one Fundament reader and retain the tenant scope. */
export function baueTaktLeser(
  tenantId: string,
  readSettings: (context: {tenantId: string}) => Promise<{retentionDays: number | null} | null> = readLoggingSettings,
): TaktLeser {
  let aufbewahrung: Promise<number | null> | undefined;
  return {
    protokollAufbewahrungTage: () => aufbewahrung ??= readSettings({tenantId}).then(settings => {
      if (!settings) throw new Error('TAKT_LOG_SETTINGS_INCOMPLETE');
      return settings.retentionDays;
    }),
  };
}
