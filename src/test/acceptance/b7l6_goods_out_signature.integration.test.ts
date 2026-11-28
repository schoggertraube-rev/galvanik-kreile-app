// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { createFixture, full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { readyInvoiceOrder } from '../../../e2e/ablauf/orderFixture';
import { prepareGoodsOutSignatureUploadAction, recordGoodsOutAction } from '@/app/actions/goodsOut.actions';
import { confirmPaymentAction } from '@/app/actions/payments.actions';
import { getPngDataUrlDimensions } from '@/lib/images/pngDimensions';
import type { RecordGoodsOutInput } from '@/lib/server/commands/recordGoodsOutCommand';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl !== process.env.H18_EXPECTED_DATABASE_URL || new URL(databaseUrl).hostname !== '127.0.0.1') {
  throw new Error('B7L6_DEDICATED_LOCAL_REPLAY_REQUIRED');
}

function pngChunk(name: string, data: Uint8Array): Buffer {
  const payload = Buffer.concat([Buffer.from(name), data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, checksum]);
}

it('binds a signed pickup to its saved receipt', async () => {
  const order = await readyInvoiceOrder('TEST B7L Abholbeleg');
  expect(await withSession(full, () => confirmPaymentAction({ invoiceId: order.invoice.invoiceId,
    amount: order.invoice.grossAmountCents, method: 'bar', expectedVersion: 0, clientEventId: randomUUID() })))
    .toMatchObject({ code: 'OK' });
  const base = { orderId: order.orderId, expectedVersion: order.version, clientEventId: randomUUID() };
  const billingOnly = await createFixture(['buchhaltung']);
  expect(await withSession(billingOnly, () => prepareGoodsOutSignatureUploadAction(base))).toMatchObject({ code: 'FORBIDDEN' });
  const grant = await withSession(full, () => prepareGoodsOutSignatureUploadAction(base));
  if (grant.code !== 'OK') throw new Error(`TEST_B7L_SIGNATURE_GRANT:${grant.code}`);
  expect(grant.storagePath).toBe(`unterschrift/${tenant}/${base.clientEventId}.png`);

  // Isolated PNG fixture stands in for a pen stroke only in this test.
  const bytes = await readFile('e2e/fixtures/e-rechnung/TEST_invoice_scan.png');
  const { width, height } = getPngDataUrlDimensions(`data:image/png;base64,${bytes.subarray(0, 24).toString('base64')}`);
  const { supabase } = await import('@/lib/supabase/client');
  const storage = supabase.storage.from('scans');
  expect((await storage.uploadToSignedUrl(grant.storagePath, grant.token, bytes, { contentType: 'image/png' })).error).toBeNull();
  const input = { ...base, mode: 'abholung', collector: { art: 'kunde', name: 'TEST Abholperson',
    unterschrift: { storagePath: grant.storagePath, sha256: createHash('sha256').update(bytes).digest('hex'),
      breitePx: width, hoehePx: height } } } satisfies RecordGoodsOutInput;
  const book = (candidate: RecordGoodsOutInput) => withSession(full, () => recordGoodsOutAction(candidate));
  expect(await book({ ...input, mode: 'versand' })).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await book({ ...input, collector: { ...input.collector, name: '' } })).toMatchObject({ code: 'VALIDATION_ERROR' });
  const missingSignature = { ...input, collector: { art: 'kunde', name: 'TEST Abholperson' } } as unknown as RecordGoodsOutInput;
  expect(await book(missingSignature)).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await book({ ...input, collector: { ...input.collector,
    unterschrift: { ...input.collector.unterschrift, sha256: '0'.repeat(64) } } })).toMatchObject({ code: 'VALIDATION_ERROR' });
  const corruptedRequest = { ...base, clientEventId: randomUUID() };
  const corruptedGrant = await withSession(full, () => prepareGoodsOutSignatureUploadAction(corruptedRequest));
  if (corruptedGrant.code !== 'OK') throw new Error(`TEST_B7L_CORRUPT_GRANT:${corruptedGrant.code}`);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const halfRaster = Buffer.alloc((width + 1) * Math.floor(height / 2));
  const truncated = Buffer.concat([bytes.subarray(0, 8), pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(halfRaster)), pngChunk('IEND', Buffer.alloc(0))]);
  expect((await storage.uploadToSignedUrl(corruptedGrant.storagePath, corruptedGrant.token, truncated, { contentType: 'image/png' })).error).toBeNull();
  expect(await book({ ...input, clientEventId: corruptedRequest.clientEventId, collector: { ...input.collector,
    unterschrift: { ...input.collector.unterschrift, storagePath: corruptedGrant.storagePath,
      sha256: createHash('sha256').update(truncated).digest('hex') } } })).toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{ station: 'fertig' }]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId}
    AND event_type IN ('ORDER_PICKED_UP_V1','ORDER_GOODS_OUT_COLLECTOR_V1')`).toEqual([]);

  const handover = await book(input);
  if (handover.code !== 'OK') throw new Error(`TEST_B7L_HANDOVER:${handover.code}`);
  const proofs = await sql`SELECT payload FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId}
    AND event_type='ORDER_GOODS_OUT_COLLECTOR_V1' AND correlation_id=${handover.receipt.correlationId}::uuid`;
  expect(proofs).toEqual([{ payload: { collector: input.collector, occurredAt: handover.receipt.occurredAt,
    goodsOutEventId: handover.receipt.eventId, device: null } }]);
  expect(await book(structuredClone(input))).toEqual({ ...handover, replayed: true });
  expect(await book({ ...input, collector: { ...input.collector, name: 'TEST Andere Person' } })).toMatchObject({ code: 'CONFLICT' });

});
