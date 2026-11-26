'use server';

import {pruefeTaktHandzugriff,starteTaktStoerungsjob} from '@/modules/takt/server-public';
import {TAKT_AUSFALL_COPY} from '@/ui/taktCopy';

function neustartFehler<C extends keyof typeof TAKT_AUSFALL_COPY.neustartFehler>(code: C) {
  return {code, message: TAKT_AUSFALL_COPY.neustartFehler[code]};
}

export async function starteTaktJobNeu(input: unknown) {
  const zugriff = await pruefeTaktHandzugriff();
  if (zugriff.code === 'DENIED') {
    return {code: zugriff.status === 401 ? 'UNAUTHENTICATED' as const : 'FORBIDDEN' as const, message: TAKT_AUSFALL_COPY.verboten};
  }
  if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'schluessel' ||
      !('schluessel' in input) || typeof input.schluessel !== 'string') return neustartFehler('VALIDATION_ERROR');
  try {
    const lauf = await starteTaktStoerungsjob(zugriff.tenantId, input.schluessel);
    if (!lauf) return neustartFehler('VALIDATION_ERROR');
    const {schluessel, ergebnis} = lauf;
    if (ergebnis === 'ok' || ergebnis === 'ohne_arbeit') {
      return {code: 'OK' as const, message: TAKT_AUSFALL_COPY.erfolg(TAKT_AUSFALL_COPY.jobs[schluessel])};
    }
    return neustartFehler(ergebnis === 'nicht_reserviert' || ergebnis === 'besetzt' ? 'CONFLICT' : 'SOURCE_INCOMPLETE');
  } catch {
    console.error('[TAKT_MANUAL_RESTART_FAILED]');
    return neustartFehler('SOURCE_INCOMPLETE');
  }
}
