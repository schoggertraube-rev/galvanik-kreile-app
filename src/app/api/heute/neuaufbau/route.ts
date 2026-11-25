import {fuehreTaktAus, pruefeTaktHandzugriff} from '@/modules/takt/server-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The former Cron endpoint now starts only the Today job for an authorized tenant. */
export async function GET(request: Request): Promise<Response> {
  const zugriff = await pruefeTaktHandzugriff();
  if (zugriff.code === 'DENIED') return new Response(null, {status: zugriff.status});
  try {
    const result = await fuehreTaktAus({tenantId: zugriff.tenantId, nurJob: 'heute_neuaufbau', signal: request.signal});
    return new Response(null, {status: result.erfolglos || result.restOffen ? 503 : 204, headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    console.error('[TODAY_TAKT_HANDRUN_FAILED]', {code: 'SOURCE_INCOMPLETE'});
    return new Response(null, {status: 503, headers: {'Cache-Control': 'private, no-store'}});
  }
}
