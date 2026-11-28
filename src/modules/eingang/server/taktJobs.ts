import 'server-only';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction, type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {TaktJob, TaktLeser} from '@/modules/takt/public';
import {erkenneOriginal, erkennungNachholbar} from './erkennung';
import {readVerifiedIntakeOriginalBytes} from './intakeOriginal';

type NachholOriginal = {
  id: string;
  item_id: string;
  dateiname: string;
  mime: string;
  sha256: string;
  aufnahme_herkunft: 'warenfoto' | 'dokument';
  reihenfolge: number;
  bytes: string;
  speicherpfad: string;
};

function hatOriginale(tx: PrivilegedTenantTransaction, tenantId: string) {
  return tx.execute(sql`SELECT 1 FROM public.intake_file file
    WHERE file.tenant_id=${tenantId} AND ${erkennungNachholbar} LIMIT 1`).then(rows => rows.length > 0);
}

async function holeErkennungNach(tenantId: string, signal: AbortSignal, leser: TaktLeser) {
  if (!leser.erkennung) throw Error('TAKT_ERKENNUNG_LESER_FEHLT');
  const readSettings = leser.erkennung;
  const originals = await withPrivilegedTenantTransaction({tenantId}, tx => tx.execute<NachholOriginal>(sql`
    SELECT file.id::text, file.item_id::text, file.dateiname, file.mime, file.sha256,
      file.aufnahme_herkunft, file.reihenfolge, file.bytes::text, file.speicherpfad
    FROM public.intake_file file
    WHERE file.tenant_id=${tenantId} AND ${erkennungNachholbar}
    ORDER BY file.aufgenommen_am,file.id LIMIT 20`));
  let failed = false;
  for (const file of originals) {
    signal.throwIfAborted();
    try {
      await erkenneOriginal({
        tenantId, file, akteur: 'system', onlyInvoiceAccess: false, retryKey: randomUUID(), signal,
        bytes: () => readVerifiedIntakeOriginalBytes(tenantId, file, signal),
      }, file.id, readSettings);
    } catch {
      // erkenneOriginal retains the original and records the error for the claimed attempt.
      failed = true;
      signal.throwIfAborted();
    }
  }
  if (failed) throw Error('TAKT_ERKENNUNG_TEILWEISE_FEHLGESCHLAGEN');
  return originals.length ? 'ok' as const : 'ohne_arbeit' as const;
}

export const taktJobs = [{
  schluessel: 'eingang_erkennung_nachholen',
  // E04 is read by recognition itself so structured XML still works with OCR switched off.
  paket: null,
  bedarf: hatOriginale,
  fristMs: 45_000,
  ausfuehren: holeErkennungNach,
}] as const satisfies readonly Omit<TaktJob, 'faellig'>[];
