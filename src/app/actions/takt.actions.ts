'use server';

import {pruefeTaktHandzugriff,starteTaktStoerungsjob} from '@/modules/takt/server-public';
import {TAKT_AUSFALL_COPY} from '@/ui/taktCopy';

export async function starteTaktJobNeu(input: unknown) {
  const zugriff = await pruefeTaktHandzugriff();
  if (zugriff.code === 'DENIED') {
    return {code: zugriff.status === 401 ? 'UNAUTHENTICATED' as const : 'FORBIDDEN' as const, message: TAKT_AUSFALL_COPY.verboten};
  }
  if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'schluessel' ||
      !('schluessel' in input) || typeof input.schluessel !== 'string') return {code: 'VALIDATION_ERROR' as const};
  try {
    const lauf = await starteTaktStoerungsjob(zugriff.tenantId, input.schluessel);
    if (!lauf) return {code: 'VALIDATION_ERROR' as const};
    const {schluessel, ergebnis} = lauf;
    if (ergebnis === 'ok' || ergebnis === 'ohne_arbeit') {
      return {code: 'OK' as const, message: TAKT_AUSFALL_COPY.erfolg(TAKT_AUSFALL_COPY.jobs[schluessel])};
    }
    return {code: ergebnis === 'nicht_reserviert' || ergebnis === 'besetzt' ? 'CONFLICT' as const : 'SOURCE_INCOMPLETE' as const};
  } catch {
    return {code: 'SOURCE_INCOMPLETE' as const};
  }
}
