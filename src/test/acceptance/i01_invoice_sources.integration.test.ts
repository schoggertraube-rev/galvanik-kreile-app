// @vitest-environment node
// Explicit TEST mail at the Graph boundary; real intake, invoices and original storage.
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import {beforeAll, expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import {enableOutlookTestFixture, createFixture, full, nativeFetch, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { importOutlookMailAction } from '@/app/actions/communications.actions';
import { createCustomerAction } from '@/app/actions/customers.actions';
import { getIncomingInvoiceAction, openIntakeOriginalAction, saveIncomingInvoiceAction } from '@/app/actions/eingang.actions';
import { resolveAuthorization } from '@/lib/server/authorization';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import type { InvoiceSaveInput } from '@/modules/eingang/public';
import {
  leseBelegoriginalFuerHandbuchungInTransaction, sperreLieferantenrechnungFuerGeldInTransaction,
} from '@/modules/eingang/server-public';

beforeAll(enableOutlookTestFixture);

async function document(name: string, pageCount = 1) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`TEST ${name} ${randomUUID()}`);
  for (let index = 0; index < pageCount; index++) pdf.addPage().drawText(`TEST ${name} Seite ${index + 1}`);
  return { name, bytes: Buffer.from(await pdf.save()) };
}

async function supplier(name: string) {
  const result = await withSession(full, () => createCustomerAction({
    clientEventId: randomUUID(), customerType: 'lieferant', companyName: `TEST I01 ${name}`, country: 'DE',
  }));
  if (result.code !== 'OK') throw Error(`TEST_I01_SUPPLIER:${result.code}`);
  return result.receipt.customerId;
}

async function deliverTwice(files: Awaited<ReturnType<typeof document>>[], subject = 'TEST Lieferantenrechnungen') {
  const id = `TEST-I01-${randomUUID()}`;
  const message = {
    id, internetMessageId: `<${id}@example.invalid>`, subject,
    from: { emailAddress: { address: `${id}@example.invalid` } }, receivedDateTime: new Date().toISOString(),
    body: { contentType: 'text', content: subject }, hasAttachments: true,
  };
  const attachments = files.map((file, index) => ({
    id: `TEST-${index}`, name: file.name, contentType: 'application/pdf', isInline: false,
    size: file.bytes.length, contentBytes: file.bytes.toString('base64'),
  }));
  const mime = new TextEncoder().encode([
    `Message-ID: ${message.internetMessageId}`, `Subject: ${message.subject}`, 'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="TEST-i01"', '', '--TEST-i01',
    'Content-Type: text/plain; charset=utf-8', '', message.body.content,
    ...attachments.flatMap(file => [
      '--TEST-i01', `Content-Type: application/pdf; name="${file.name}"`,
      `Content-Disposition: attachment; filename="${file.name}"`, 'Content-Transfer-Encoding: base64', '', file.contentBytes,
    ]), '--TEST-i01--', '',
  ].join('\r\n'));
  let externalCalls = 0;
  const graph = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== 'login.microsoftonline.com' && url.hostname !== 'graph.microsoft.com') return nativeFetch(input, init);
    externalCalls++;
    if (url.hostname === 'login.microsoftonline.com') return Response.json({ access_token: 'TEST-provider-token'.repeat(3) });
    if (url.pathname.endsWith('/$value')) return new Response(mime);
    if (url.pathname.endsWith('/attachments')) return Response.json({ value: attachments });
    return Response.json(message);
  });
  try {
    const first = await withSession(full, () => importOutlookMailAction(id, { deferDispatchReply: true }));
    if (first.code !== 'OK') throw Error(`TEST_I01_MAIL:${first.code}`);
    expect(externalCalls).toBeGreaterThan(0);
    const calls = externalCalls;
    expect(await withSession(full, () => importOutlookMailAction(id, { deferDispatchReply: true })))
      .toMatchObject({ code: 'OK', itemId: first.itemId, replayed: true });
    expect(externalCalls).toBe(calls);
    const originals = await sql<{ id: string; name: string; sha256: string }[]>`
      SELECT file.id::text,file.dateiname AS name,file.sha256 FROM public.intake_file file
      WHERE file.tenant_id=${tenant} AND file.item_id=${first.itemId}::uuid`;
    expect(originals).toHaveLength(files.length + 1);
    const mailOriginal = originals.find(original => original.sha256 === createHash('sha256').update(mime).digest('hex'));
    if (!mailOriginal) throw Error('TEST_I01_MAIL_ORIGINAL_REQUIRED');
    const fileIds = files.map(file => {
      const original = originals.find(entry => entry.name === file.name);
      expect(original?.sha256).toBe(createHash('sha256').update(file.bytes).digest('hex'));
      if (!original) throw Error('TEST_I01_ATTACHMENT_REQUIRED');
      return original.id;
    });
    return { itemId: first.itemId, fileIds, mailOriginal, mime };
  } finally {
    graph.mockRestore();
  }
}

async function invoice(id: string, fileId?: string) {
  const result = await withSession(full, () => getIncomingInvoiceAction(fileId ? { id, fileId } : { id }));
  if (result.code !== 'OK') throw Error(`TEST_I01_READ:${result.code}`);
  return result.view;
}

function command(itemId: string, fileId: string, version: number, supplierId: string,
  number: string, amount: string, pages?: InvoiceSaveInput['pages']): InvoiceSaveInput {
  return {
    itemId, fileId, version, clientKey: randomUUID(), ...(pages ? { pages } : {}),
    fields: { lieferantId: supplierId, nummer: number, datum: '2026-11-02', netto: amount, ust: '0,00',
      brutto: amount, faelligAm: '2026-11-30', iban: '', ibanGeprueft: false },
    status: 'offen', paidDate: null, proofFileId: null, duplicateId: null, duplicateReason: null, unclearReason: null,
  };
}

async function save(input: InvoiceSaveInput) {
  const result = await withSession(full, () => saveIncomingInvoiceAction(input));
  if (result.code !== 'OK') throw Error(`TEST_I01_SAVE:${result.code}`);
  return result.invoice;
}

it('M03–M05 saves 95 and 55 on separate original files of a twice delivered mail', async () => {
  const [supplierA, supplierB] = await Promise.all([supplier('A'), supplier('B')]);
  const firstOriginal = await document('TEST-L-A.pdf');
  const { itemId, fileIds, mailOriginal, mime } = await deliverTwice([firstOriginal, await document('TEST-L-B.pdf')]);
  const initial = await invoice(itemId);
  const first = await save(command(itemId, fileIds[0], initial.item.version, supplierA, 'TEST-L-A', '95,00'));
  const cashier = await createFixture(['zahlungen']);
  const workshop = await createFixture(['eingang', 'auftraege'], 'werkstatt');
  const [cashierAuth, workshopAuth] = await Promise.all([
    withSession(cashier, resolveAuthorization),
    withSession(workshop, resolveAuthorization),
  ]);
  if (!cashierAuth.ok || !workshopAuth.ok) throw Error('TEST_I04AH1_AUTH_REQUIRED');

  const lockInvoice = (auth: typeof cashierAuth.data) => withPrivilegedTenantTransaction(auth,
    tx => sperreLieferantenrechnungFuerGeldInTransaction(tx, auth, first.id));
  expect(await lockInvoice(cashierAuth.data)).toEqual({
    code: 'OK', data: { id: first.id, version: first.version, bruttoCents: 9500, zahlstatus: 'offen' },
  });
  expect(await lockInvoice(workshopAuth.data)).toEqual({ code: 'FORBIDDEN' });
  // Synthetic second TEST tenant; the lookup uses a real tenant-scoped transaction.
  expect(await lockInvoice({ ...cashierAuth.data, tenantId: 'TEST-ablauf-' + randomUUID() }))
    .toEqual({ code: 'NOT_FOUND' });

  const readProof = (auth: typeof cashierAuth.data, fileId: string) => withPrivilegedTenantTransaction(auth,
    tx => leseBelegoriginalFuerHandbuchungInTransaction(tx, auth, fileId));
  expect(await readProof(cashierAuth.data, fileIds[0])).toEqual({
    id: fileIds[0], itemId, sha256: createHash('sha256').update(firstOriginal.bytes).digest('hex'),
  });
  expect(await readProof(cashierAuth.data, mailOriginal.id)).toBeNull();
  expect(await readProof(workshopAuth.data, fileIds[0])).toBeNull();
  expect(await readProof({ ...cashierAuth.data, tenantId: 'TEST-ablauf-' + randomUUID() }, fileIds[0])).toBeNull();

  const firstRead = await invoice(itemId);
  expect(firstRead.invoice).toMatchObject({ id: first.id, file_id: fileIds[0], seite_von: null, seite_bis: null });
  const nextOriginal = await invoice(itemId, fileIds[1]);
  expect(nextOriginal).toMatchObject({ invoice: null, fileId: fileIds[1], fields: { lieferantId: '', brutto: '' } });
  expect(await withSession(full, () => getIncomingInvoiceAction({ id: first.id, fileId: fileIds[1] })))
    .toMatchObject({ code: 'NOT_FOUND' });
  const duplicate = command(itemId, fileIds[1], firstRead.item.version, supplierA, 'TEST-L-A', '95,00');
  expect(await withSession(full, () => saveIncomingInvoiceAction(duplicate)))
    .toMatchObject({ code: 'DUPLICATE', duplicate: { id: first.id, exact: true } });

  const input = command(itemId, fileIds[1], nextOriginal.item.version, supplierB, 'TEST-L-B', '55,00');
  const second = await save(input);
  expect(second.id).not.toBe(first.id);
  expect(await withSession(full, () => saveIncomingInvoiceAction(JSON.parse(JSON.stringify(input)))))
    .toMatchObject({ code: 'OK', replayed: true, invoice: { id: second.id } });
  const firstInvoice = await invoice(first.id);
  const secondInvoice = await invoice(second.id);
  expect(firstInvoice.invoice).toMatchObject({ item_id: itemId, brutto: '95.00', file_id: fileIds[0] });
  expect(secondInvoice.invoice).toMatchObject({ item_id: itemId, brutto: '55.00', file_id: fileIds[1] });
  for (const view of [firstInvoice, secondInvoice]) {
    expect(view.originals.filter(file => file.mime === 'message/rfc822')).toEqual([{ ...mailOriginal, mime: 'message/rfc822' }]);
  }
  const opened = await withSession(full, () => openIntakeOriginalAction({ fileId: mailOriginal.id, clientEventId: randomUUID() }));
  if (opened.code !== 'OK' || !opened.original.downloadUrl) throw Error('TEST_I01_MAIL_DOWNLOAD_REQUIRED');
  const download = await nativeFetch(opened.original.downloadUrl);
  expect(download.ok).toBe(true);
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(mime);
  const bookkeepingOnly = await createFixture(['buchhaltung']);
  const restricted = await withSession(bookkeepingOnly, () => getIncomingInvoiceAction({ id: first.id }));
  expect(restricted.code).toBe('OK');
  if (restricted.code !== 'OK') throw Error('TEST_I01_RESTRICTED_INVOICE_REQUIRED');
  expect(restricted.view.originals.some(file => file.id === mailOriginal.id)).toBe(false);
  expect(await withSession(full, () => getIncomingInvoiceAction({ id: itemId, fileId: mailOriginal.id })))
    .toMatchObject({ code: 'NOT_FOUND' });
  expect((await invoice(itemId, fileIds[1])).invoice?.id).toBe(second.id);
  expect(await withSession(full, () => getIncomingInvoiceAction({ id: itemId }))).toMatchObject({ code: 'CONFLICT' });
  const mailOnly = await createFixture(['mails']);
  expect(await withSession(mailOnly, () => getIncomingInvoiceAction({ id: first.id }))).toMatchObject({ code: 'FORBIDDEN' });
});

it('holds one two-page invoice and two separate page invoices on their respective PDFs', async () => {
  const supplierId = await supplier('Seiten');
  const whole = await deliverTwice([await document('TEST-Rechnung-zwei-Seiten.pdf', 2)]);
  const first = await save(command(whole.itemId, whole.fileIds[0], (await invoice(whole.itemId)).item.version,
    supplierId, 'TEST-L-2P', '95,00', { from: 1, to: 2 }));
  expect((await invoice(first.id)).invoice).toMatchObject({ seite_von: 1, seite_bis: 2, file_id: whole.fileIds[0] });
  const overlap = command(whole.itemId, whole.fileIds[0], (await invoice(first.id)).item.version,
    supplierId, 'TEST-L-UEBERLAPPUNG', '55,00', { from: 2, to: 2 });
  expect(await withSession(full, () => saveIncomingInvoiceAction(overlap))).toMatchObject({
    code: 'CONFLICT',
    message: `Seite 1–2 von TEST-Rechnung-zwei-Seiten.pdf gehört schon zu Rechnung ${first.nummer_intern}. Wähl die übrigen Seiten.`,
  });

  const split = await deliverTwice([await document('TEST-zwei-Rechnungen.pdf', 2)]);
  const start = command(split.itemId, split.fileIds[0], (await invoice(split.itemId)).item.version,
    supplierId, 'TEST-L-P1', '95,00', { from: 1, to: 1 });
  expect(await withSession(full, () => saveIncomingInvoiceAction({ ...start, pages: { from: 1, to: 3 } })))
    .toMatchObject({ code: 'VALIDATION_ERROR' });
  const pageOne = await save(start);
  const pageTwo = await save(command(split.itemId, split.fileIds[0], (await invoice(pageOne.id)).item.version,
    supplierId, 'TEST-L-P2', '55,00', { from: 2, to: 2 }));
  expect(pageTwo.id).not.toBe(pageOne.id);
  expect((await invoice(pageOne.id)).invoice).toMatchObject({ seite_von: 1, seite_bis: 1, brutto: '95.00' });
  expect((await invoice(pageTwo.id)).invoice).toMatchObject({ seite_von: 2, seite_bis: 2, brutto: '55.00' });
  const repeated = command(split.itemId, split.fileIds[0], (await invoice(pageTwo.id)).item.version,
    supplierId, 'TEST-DUPLICATE-PAGE', '55,00', { from: 2, to: 2 });
  expect(await withSession(full, () => saveIncomingInvoiceAction(repeated))).toMatchObject({ code: 'CONFLICT' });
  expect(await sql`SELECT count(*)::int AS count FROM public.supplier_invoice WHERE tenant_id=${tenant}
    AND item_id=${split.itemId}::uuid AND file_id=${split.fileIds[0]}::uuid`).toEqual([{ count: 2 }]);
});

it('blocks part of a registered whole PDF and keeps each supplier on their own original', async () => {
  const [supplierA, supplierB] = await Promise.all([supplier('Zugeordnet-A'), supplier('Original-B')]);
  const whole = await deliverTwice([await document('TEST-Ganze-Datei.pdf', 2)]);
  const registered = await save(command(whole.itemId, whole.fileIds[0], (await invoice(whole.itemId)).item.version,
    supplierA, 'TEST-GANZ', '95,00'));
  const partial = command(whole.itemId, whole.fileIds[0], (await invoice(registered.id)).item.version,
    supplierA, 'TEST-GANZ-P2', '55,00', { from: 2, to: 2 });
  expect(await withSession(full, () => saveIncomingInvoiceAction(partial))).toMatchObject({
    code: 'CONFLICT',
    message: `TEST-Ganze-Datei.pdf ist schon ganz als Rechnung ${registered.nummer_intern} erfasst. Gehört ein Teil zu einer anderen Rechnung, grenz zuerst die Seiten von ${registered.nummer_intern} ein.`,
  });

  const multi = await deliverTwice([await document('TEST-Zugeordnet-A.pdf'), await document('TEST-Original-B.pdf')]);
  // The isolated fixture starts with the forwarding mail already associated with A.
  await sql`UPDATE public.intake_item SET kunde_id=${supplierA},zuordnung='bestaetigt'
    WHERE tenant_id=${tenant} AND id=${multi.itemId}::uuid`;
  const b = await save(command(multi.itemId, multi.fileIds[1], (await invoice(multi.itemId, multi.fileIds[1])).item.version,
    supplierB, 'TEST-B-ZUERST', '55,00'));
  const a = await save(command(multi.itemId, multi.fileIds[0], (await invoice(multi.itemId, multi.fileIds[0])).item.version,
    supplierA, 'TEST-A-DANACH', '95,00'));
  expect(b).toMatchObject({ file_id: multi.fileIds[1], lieferant_id: supplierB });
  expect(a).toMatchObject({ file_id: multi.fileIds[0], lieferant_id: supplierA });
  expect(await sql`SELECT kunde_id,zuordnung FROM public.intake_item
    WHERE tenant_id=${tenant} AND id=${multi.itemId}::uuid`).toEqual([{ kunde_id: supplierA, zuordnung:'bestaetigt' }]);
});

it('checks the same original access before counting invoice pages or downloading the PDF', async () => {
  const bookkeeping = await createFixture(['buchhaltung']);
  const supplierId = await supplier('Originalzugriff');
  const { itemId, fileIds: [fileId] } = await deliverTwice([await document('TEST-Bestellung.pdf', 2)], 'TEST Bestellung');
  const [{ version }] = await sql<{ version: number }[]>`SELECT version FROM public.intake_item
    WHERE tenant_id=${tenant} AND id=${itemId}::uuid`;
  const storageRequests: string[] = [];
  const observedFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname.startsWith('/storage/v1/')) storageRequests.push(url.pathname);
    return nativeFetch(input, init);
  });
  try {
    const opened = await withSession(bookkeeping, () => openIntakeOriginalAction({ fileId, clientEventId: randomUUID() }));
    expect(opened.code).toBe('FORBIDDEN');
    expect(await withSession(bookkeeping, () => saveIncomingInvoiceAction(
      command(itemId, fileId, version, supplierId, 'TEST-L-ACCESS', '95,00', { from: 1, to: 2 }),
    ))).toEqual(opened);
    expect(storageRequests).toEqual([]);
    expect(await sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid`).toEqual([]);
  } finally {
    observedFetch.mockRestore();
  }
});
