import {fuehreTaktAus, pruefeTaktZugriff} from '@/modules/takt/server-public';
import {TAKT_BUDGET_MS} from '@/modules/takt/public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The daily Cron fans out over the one Today tenant list; a diagnostic login is tenant-bound. */
export async function GET(request: Request): Promise<Response> {
  const zugriff = await pruefeTaktZugriff(request);
  if (zugriff.code === 'DENIED') return new Response(null, {status: zugriff.status});
  try {
    const result = await fuehreTaktAus(zugriff.code === 'LOGIN'
      ? {tenantId: zugriff.tenantId, budgetMs: TAKT_BUDGET_MS}
      : {budgetMs: TAKT_BUDGET_MS});
    const status = result.mandanten > 0 ? 200 : result.erfolglos || result.restOffen ? 503 : 204;
    return new Response(null, {status, headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    console.error('[TAKT_RUN_FAILED]', {code: 'SOURCE_INCOMPLETE'});
    return new Response(null, {status: 503, headers: {'Cache-Control': 'private, no-store'}});
  }
}
