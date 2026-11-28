// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-i02-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { createFixture, nativeFetch, full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { confirmIntakeOriginalAction, openIntakeOriginalAction } from '@/app/actions/eingang.actions';
import { resolveAuthorization } from '@/lib/server/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

async function testPdf(title: string, pages = 1) {
  const pdf = await PDFDocument.create();
  for (let page = 1; page <= pages; page++) pdf.addPage().drawText(`${title} ${page}`);
  pdf.setTitle(title);
  return pdf.save();
}

it('liefert den Rechnungsbezug nur für die zugehörige Datei derselben Mail', async () => {
  const itemId = randomUUID();
  const invoiceId = randomUUID();
  const files = [
    { id: randomUUID(), name: 'TEST-L-A.pdf', mime: 'application/pdf', art: 'anhang', bytes: await testPdf('TEST L-A') },
    { id: randomUUID(), name: 'TEST-L-B.pdf', mime: 'application/pdf', art: 'anhang', bytes: await testPdf('TEST L-B') },
    {
      id: randomUUID(), name: 'Original.eml', mime: 'message/rfc822', art: 'mime',
      bytes: new TextEncoder().encode('From: rechnung@example.invalid\r\nSubject: TEST Original\r\nMIME-Version: 1.0\r\n\r\nTEST zwei Anhänge'),
    },
  ];

  await withSession(full, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error('TEST_I02_AUTH');
    await sql`INSERT INTO public.intake_item
      (id,tenant_id,client_key,kanal,quelle,erstellt_von,vorgang_art,vorgang_id,anliegen)
      VALUES (${itemId},${tenant},${itemId},'mail','mailabruf',${auth.data.userId},'rechnung',${invoiceId},ARRAY['rechnung'])`;
    const storage = createAdminClient().storage.from('scans');
    for (const [index, file] of files.entries()) {
      const hash = createHash('sha256').update(file.bytes).digest('hex');
      const path = tenant + '/' + hash;
      expect((await storage.upload(path, file.bytes, { contentType: file.mime })).error).toBeNull();
      await sql`INSERT INTO public.intake_file
        (id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,
          reihenfolge,lesbar,erkennung_status,geoeffnet)
        VALUES (${file.id},${tenant},${itemId},${file.id},${file.art},${file.name},${file.mime},${file.bytes.byteLength},
          ${hash},${path},statement_timestamp(),${auth.data.userId},${index+1},true,'fertig',false)`;
    }
    await sql`INSERT INTO public.supplier_invoice
      (id,tenant_id,nummer_intern,item_id,file_id,zahlstatus,unklar_grund,erfasst_von)
      VALUES (${invoiceId},${tenant},'ER-2026-900001',${itemId},${files[0].id},'unklar','TEST offene Rechnung',${auth.data.userId})`;

    for (const [index, file] of files.entries()) {
      const original = await openIntakeOriginalAction({ fileId: file.id, clientEventId: randomUUID() });
      expect(original).toMatchObject({
        code: 'OK', original: { id: file.id, itemId, invoiceId: index === 0 ? invoiceId : null, restricted: false },
      });
      if (original.code !== 'OK' || !original.original.downloadUrl) throw Error('TEST_I02_LOCAL_DOWNLOAD_REQUIRED');
      const raw = await nativeFetch(original.original.downloadUrl);
      expect(raw.ok).toBe(true);
      expect(new Uint8Array(await raw.arrayBuffer())).toEqual(file.bytes);
    }
  });
});

it('öffnet und bestätigt nur die gewählte Rechnung in einer gemeinsamen PDF', async () => {
  const itemId = randomUUID(), fileId = randomUUID();
  const invoiceIds = [randomUUID(), randomUUID()];
  const bytes = await testPdf('TEST Zwei Rechnungen', 2);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const path = `${tenant}/${hash}`;
  const bookkeeping = await createFixture(['buchhaltung']);
  const intake = await createFixture(['eingang', 'mails']);
  await withSession(full, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error('TEST_I02_AUTH');
    await sql`INSERT INTO public.intake_item (id,tenant_id,client_key,kanal,quelle,erstellt_von,vorgang_art,vorgang_id,anliegen)
      VALUES (${itemId},${tenant},${itemId},'mail','mailabruf',${auth.data.userId},'rechnung',${invoiceIds[0]},ARRAY['rechnung'])`;
    const uploaded = await createAdminClient().storage.from('scans').upload(path, bytes, { contentType: 'application/pdf' });
    expect(uploaded.error).toBeNull();
    await sql`INSERT INTO public.intake_file
      (id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,
        reihenfolge,lesbar,erkennung_status,geoeffnet)
      VALUES (${fileId},${tenant},${itemId},${fileId},'anhang','TEST-zwei-Rechnungen.pdf','application/pdf',${bytes.byteLength},
        ${hash},${path},statement_timestamp(),${auth.data.userId},1,true,'fertig',false)`;
    for (const [index, id] of invoiceIds.entries()) {
      const page = index + 1;
      await sql`INSERT INTO public.supplier_invoice
        (id,tenant_id,nummer_intern,item_id,file_id,seite_von,seite_bis,zahlstatus,unklar_grund,erfasst_von)
        VALUES (${id},${tenant},${'ER-2026-90010'+page},${itemId},${fileId},${page},${page},'unklar','TEST offene Rechnung',${auth.data.userId})`;
      await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,fundstelle,status)
        VALUES (${tenant},${itemId},${fileId},'rechnung.nummer',${sql.json(`TEST-${page}`)},'unsicher',${sql.json({ page })},'offen')`;
    }
    expect(await openIntakeOriginalAction({ fileId, clientEventId: randomUUID() }))
      .toMatchObject({ code: 'OK', original: { invoiceId: null, invoicePages: null } });
  });

  const open = { fileId, invoiceId: invoiceIds[1], clientEventId: randomUUID() };
  const confirm = { ...open, clientEventId: randomUUID() };
  expect(await withSession(intake, () => openIntakeOriginalAction({ fileId, clientEventId: randomUUID() })))
    .toMatchObject({ code: 'OK', original: { invoiceId: null, invoicePages: null } });
  expect(await withSession(intake, () => openIntakeOriginalAction(open))).toMatchObject({ code: 'FORBIDDEN' });
  expect(await withSession(bookkeeping, () => openIntakeOriginalAction({ ...open, invoiceId: randomUUID() })))
    .toMatchObject({ code: 'NOT_FOUND' });
  expect(await withSession(bookkeeping, () => confirmIntakeOriginalAction(confirm))).toMatchObject({ code: 'CONFLICT' });
  const result = await withSession(bookkeeping, () => openIntakeOriginalAction(open));
  expect(result).toMatchObject({ code: 'OK', original: { id: fileId, itemId, invoiceOnly: true, invoiceId: invoiceIds[1],
    invoicePages: { from: 2, to: 2 }, url: expect.stringMatching(/#page=2$/),
    invoiceSuggestions: [expect.objectContaining({ value: 'TEST-2' })] } });
  if (result.code !== 'OK' || !result.original.downloadUrl) throw Error('TEST_I02_LOCAL_DOWNLOAD_REQUIRED');
  const raw = await nativeFetch(result.original.downloadUrl);
  expect(raw.ok).toBe(true);
  expect(new Uint8Array(await raw.arrayBuffer())).toEqual(bytes);
  expect(await withSession(bookkeeping, () => openIntakeOriginalAction(JSON.parse(JSON.stringify(open)))))
    .toMatchObject({ code: 'OK', original: { invoiceId: invoiceIds[1] } });
  expect(await withSession(bookkeeping, () => openIntakeOriginalAction({ ...open, invoiceId: invoiceIds[0] })))
    .toMatchObject({ code: 'CONFLICT' });
  expect(await withSession(bookkeeping, () => confirmIntakeOriginalAction(confirm)))
    .toMatchObject({ code: 'OK', count: 1, replayed: false });
  expect(await withSession(bookkeeping, () => confirmIntakeOriginalAction(JSON.parse(JSON.stringify(confirm)))))
    .toMatchObject({ code: 'OK', count: 1, replayed: true });
  expect(await sql`SELECT wert,geprueft_am IS NOT NULL AS confirmed FROM public.intake_suggestion
    WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid ORDER BY wert`)
    .toEqual([{ wert: 'TEST-1', confirmed: false }, { wert: 'TEST-2', confirmed: true }]);
});
