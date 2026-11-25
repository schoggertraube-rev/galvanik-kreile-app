import 'server-only';
import {sql} from 'drizzle-orm';
import {taeglichFaelligAb} from '@/lib/domain/workingDays';
import {withPrivilegedTenantTransaction, withTaktStatementTimeout} from '@/lib/server/privilegedDb';

type AufbewahrungsLeser = Readonly<{protokollAufbewahrungTage: () => Promise<number | null>}>;

/** The daily job is the sole retention writer; an absent setting retains all rows. */
export const taktJobs = [{
  schluessel: 'protokoll_aufbewahrung',
  paket: null,
  faellig: (jetzt: Date, letzterTermin: string | null) => taeglichFaelligAb(jetzt, letzterTermin, '03:00'),
  fristMs: 25_000,
  ausfuehren: async (tenantId: string, signal: AbortSignal, leser: AufbewahrungsLeser) => {
    signal.throwIfAborted();
    const days = await leser.protokollAufbewahrungTage();
    signal.throwIfAborted();
    if (days === null) return 'ok' as const;
    if (!Number.isSafeInteger(days) || days < 0) throw Error('TAKT_RETENTION_SETTING_INVALID');
    await withTaktStatementTimeout(15_000, () => withPrivilegedTenantTransaction({tenantId}, async tx => {
      await tx.execute(sql`SET LOCAL app.protocol_retention='on'`);
      signal.throwIfAborted();
      await tx.execute(sql`DELETE FROM public.technical_protocol WHERE tenant_id=${tenantId} AND recorded_at<statement_timestamp()-(${days}*interval '1 day')`);
      signal.throwIfAborted();
      await tx.execute(sql`DELETE FROM public.app_usage_events WHERE tenant_id=${tenantId} AND event_type='action' AND received_at<statement_timestamp()-(${days}*interval '1 day')`);
      signal.throwIfAborted();
    }), signal);
    return 'ok' as const;
  },
}] as const;
