import {fuehreTaktAus, pruefeTaktHandzugriff} from '@/modules/takt/server-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The former Cron endpoint now starts only the Today job for an authorized tenant. */
export async function GET(_request: Request): Promise<Response> {
  void _request;
  const zugriff = await pruefeTaktHandzugriff();
  if (zugriff.code === 'DENIED') return new Response(null, {status: zugriff.status});
  try {
    await fuehreTaktAus({tenantId: zugriff.tenantId, nurJob: 'heute_neuaufbau'});
    return new Response(null, {status: 204, headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    console.error('[TODAY_TAKT_HANDRUN_FAILED]', {code: 'SOURCE_INCOMPLETE'});
    return new Response(null, {status: 503, headers: {'Cache-Control': 'private, no-store'}});
  }
}
