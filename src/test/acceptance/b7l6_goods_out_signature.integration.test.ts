// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { createFixture, full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { deliveryNoteInputFixture, readyInvoiceOrder } from '../../../e2e/ablauf/orderFixture';
import { prepareGoodsOutSignatureUploadAction, recordGoodsOutAction } from '@/app/actions/goodsOut.actions';
import { confirmPaymentAction } from '@/app/actions/payments.actions';
import { generateDeliveryNote } from '@/app/actions/pdf.actions';
import { getPngDataUrlDimensions } from '@/lib/images/pngDimensions';
import type { RecordGoodsOutInput } from '@/lib/server/commands/recordGoodsOutCommand';

it('binds a signed pickup to its real receipt and preserves the earlier private PDF', async () => {
  const order = await readyInvoiceOrder('TEST B7L Abholbeleg');
  expect(await withSession(full, () => confirmPaymentAction({ invoiceId: order.invoice.invoiceId,
    amount: order.invoice.grossAmountCents, method: 'bar', expectedVersion: 0, clientEventId: randomUUID() })))
    .toMatchObject({ code: 'OK' });
  const originalInput = await deliveryNoteInputFixture([order.orderId]);
  const original = await withSession(full, () => generateDeliveryNote(originalInput));
  if (original.code !== 'OK') throw new Error(`TEST_B7L_UNSIGNED_PDF:${original.code}`);

  const base = { orderId: order.orderId, expectedVersion: order.version, clientEventId: randomUUID() };
  const billingOnly = await createFixture(['buchhaltung']);
  expect(await withSession(billingOnly, () => prepareGoodsOutSignatureUploadAction(base))).toMatchObject({ code: 'FORBIDDEN' });
  const grant = await withSession(full, () => prepareGoodsOutSignatureUploadAction(base));
  if (grant.code !== 'OK') throw new Error(`TEST_B7L_SIGNATURE_GRANT:${grant.code}`);
  expect(grant.storagePath).toBe(`unterschrift/${tenant}/${base.clientEventId}.png`);

  // Isolated PNG fixture stands in for a pen stroke only in this test.
  const bytes = await readFile('e2e/fixtures/e-rechnung/TEST_invoice_scan.png');
  const { width, height } = getPngDataUrlDimensions(`data:image/png;base64,${bytes.subarray(0, 24).toString('base64')}`);
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage.from('scans');
  expect((await storage.uploadToSignedUrl(grant.storagePath, grant.token, bytes, { contentType: 'image/png' })).error).toBeNull();
  const input = { ...base, mode: 'abholung', collector: { art: 'kunde', name: 'TEST Abholperson',
    unterschrift: { storagePath: grant.storagePath, sha256: createHash('sha256').update(bytes).digest('hex'),
      breitePx: width, hoehePx: height } } } satisfies RecordGoodsOutInput;
  const book = (candidate: RecordGoodsOutInput) => withSession(full, () => recordGoodsOutAction(candidate));
  expect(await book({ ...input, mode: 'versand' })).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await book({ ...input, collector: { ...input.collector, name: '' } })).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await book({ ...input, collector: { ...input.collector,
    unterschrift: { ...input.collector.unterschrift, sha256: '0'.repeat(64) } } })).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{ station: 'fertig' }]);

  const handover = await book(input);
  if (handover.code !== 'OK') throw new Error(`TEST_B7L_HANDOVER:${handover.code}`);
  const proofs = await sql`SELECT payload FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId}
    AND event_type='ORDER_GOODS_OUT_COLLECTOR_V1' AND correlation_id=${handover.receipt.correlationId}::uuid`;
  expect(proofs).toEqual([{ payload: { collector: input.collector, occurredAt: handover.receipt.occurredAt,
    goodsOutEventId: handover.receipt.eventId, device: null } }]);
  expect(await book(structuredClone(input))).toEqual({ ...handover, replayed: true });
  expect(await book({ ...input, collector: { ...input.collector, name: 'TEST Andere Person' } })).toMatchObject({ code: 'CONFLICT' });

  const signedInput = await deliveryNoteInputFixture([order.orderId]);
  const signed = await withSession(full, () => generateDeliveryNote(signedInput));
  if (signed.code !== 'OK') throw new Error(`TEST_B7L_SIGNED_PDF:${signed.code}`);
  expect(signed.receipt.version).toBe(original.receipt.version + 1);
  expect(signed.receipt.pdfSha256).not.toBe(original.receipt.pdfSha256);
  expect(await withSession(full, () => generateDeliveryNote(originalInput))).toMatchObject({
    code: 'OK', replayed: true, pdfBase64: original.pdfBase64, receipt: { originalEventId: original.receipt.originalEventId },
  });

  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = getDocument({ data: new Uint8Array(Buffer.from(signed.pdfBase64, 'base64')) });
  try {
    const doc = await pdf.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    expect(content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')).toMatch(/Übergeben am .* an TEST Abholperson/);
    expect((await page.getOperatorList()).fnArray).toContain(OPS.paintImageXObject);
  } finally {
    await pdf.destroy();
  }
});
