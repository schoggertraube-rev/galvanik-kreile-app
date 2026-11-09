import { randomUUID, createHash } from 'node:crypto';
import { expect, vi } from 'vitest';
import { KREILE_TENANT_SLUG } from '@/lib/tenant';
import { sql, full, withSession, nativeFetch } from './replayHarness';

export async function requestMailStep(chain:string) {
  const run = randomUUID();
  const graphId = 'TEST-'+chain+'-' + run;
  const internetId = '<TEST-H1-' + run + '@example.invalid>';
  const text = 'TEST Bitte erstellen Sie einen Kostenvoranschlag für vier Trompeten.';
  const mime = Buffer.from('Message-ID: ' + internetId + '\r\nSubject: TEST Kostenvoranschlag\r\n\r\n' + text);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === 'login.microsoftonline.com') {
      return Response.json({ access_token: 'TEST-H1-provider-token'.repeat(3) });
    }
    if (url.hostname === 'graph.microsoft.com') {
      if (url.pathname.endsWith('/$value')) return new Response(mime.toString('utf8'));
      if (url.pathname.endsWith('/attachments')) return Response.json({ value: [] });
      return Response.json({ id: graphId, internetMessageId: internetId, subject: 'TEST Kostenvoranschlag',
        from: { emailAddress: { name: 'TEST H1 Kunde', address: 'TEST-'+chain+'-' + run + '@example.invalid' } },
        receivedDateTime: '2026-11-09T12:00:00Z', bodyPreview: text,
        body: { contentType: 'text', content: text }, hasAttachments: false });
    }
    // Only the external provider boundary is doubled. Storage remains real.
    return nativeFetch(input, init);
  });
  const { importOutlookMailAction } = await import('@/app/actions/communications.actions');
  const { getIntakeCaptureAction } = await import('@/app/actions/eingang.actions');
  const imported = await withSession(full, () => importOutlookMailAction(graphId));
  expect(imported.code).toBe('OK');
  if (imported.code !== 'OK') throw Error('H1_MAIL_IMPORT:' + imported.code);
  const rows = await sql`SELECT id::text, text, anliegen_offen, erstellt_von::text FROM public.intake_item
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ text, erstellt_von: full.actorId });
  const events = await sql`SELECT art, von::text FROM public.intake_event
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rows[0].id}::uuid`;
  expect(events.filter(event => event.art === 'angelegt')).toEqual([{ art: 'angelegt', von: full.actorId }]);
  const originals = await sql`SELECT sha256 FROM public.intake_file
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rows[0].id}::uuid AND mime='message/rfc822'`;
  expect(originals).toEqual([{ sha256: createHash('sha256').update(mime).digest('hex') }]);
  // Retry is sent after a real new read; it must not create a second item/event.
  const reread = await withSession(full, () => getIntakeCaptureAction(rows[0].id));
  expect(reread.code).toBe('OK');
  expect(await withSession(full, () => importOutlookMailAction(graphId))).toMatchObject({ code: 'OK', itemId: rows[0].id, replayed: true });
  expect(await sql`SELECT count(*)::integer AS n FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`).toEqual([{ n: 1 }]);
  expect(await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${rows[0].id}::uuid AND art='angelegt'`).toEqual([{ n: 1 }]);
  expect(rows[0].anliegen_offen, 'T25: the mail must be an actionable quote request, not a generic note').toContain('kv_anfrage');
  return rows[0].id as string;
}
