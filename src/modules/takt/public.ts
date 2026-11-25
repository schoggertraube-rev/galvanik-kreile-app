/** One server-side job and its immutable due-time contract. */
import type {PackageSwitchId} from '@/modules/fundament/public';
export type TaktLeser = Readonly<{ protokollAufbewahrungTage: () => Promise<number | null> }>;

export type TaktJob = Readonly<{
  schluessel: string;
  paket: PackageSwitchId | null;
  faellig: (jetztBerlin: Date, letzterOk: Date | null) => string | null;
  fristMs: number;
  ausfuehren: (tenantId: string, signal: AbortSignal, leser: TaktLeser) => Promise<'ok' | 'ohne_arbeit'>;
}>;

export const TAKT_BUDGET_MS = 50_000;
export const TAKT_JOB_BUDGET_MS = TAKT_BUDGET_MS / 2;
export const TAKT_NACHHOLEN_BUDGET_MS = TAKT_BUDGET_MS / 2;
export const TAKT_RETENTION_BUDGET_MS = TAKT_BUDGET_MS * 3 / 10;
export const TAKT_READ_BUDGET_MS = TAKT_BUDGET_MS / 10;
export const TAKT_WIEDERHOLUNG_MIN = [1, 5, 15] as const;
