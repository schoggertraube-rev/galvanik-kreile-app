import {TAKT_WIEDERHOLUNG_MIN} from '../public';

/** A failed claim reopens only at its next configured retry boundary. */
export function naechsteReservierung(versuch: number, beendetUm: Date): Date | null {
  if (!Number.isSafeInteger(versuch) || versuch < 1 || versuch > 3 || !Number.isFinite(beendetUm.getTime())) return null;
  return new Date(beendetUm.getTime() + TAKT_WIEDERHOLUNG_MIN[versuch - 1] * 60_000);
}
