'use server';

import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { events, orders, scanUploads } from '@/db/schema';
import { resolveAuthorization } from '@/lib/server/authorization';
import {
  ALLOWED_ORDER_PHOTO_TYPES,
  createOrderPhotoStorageAdmin,
  MAX_ORDER_PHOTO_SIZE_BYTES,
  ORDER_PHOTO_BUCKET,
} from '@/lib/server/orderPhotoStorage';

async function resolveAuthorizedPhotoOrder(rawOrderId: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return { ok: false as const, error: authorization.message };
  }

  if (!authorization.data.permissions.includes('perm_op_photos')) {
    return { ok: false as const, error: 'Keine Berechtigung für Auftragsfotos.' };
  }

  const orderId = rawOrderId.trim();
  if (!orderId) {
    return { ok: false as const, error: 'Ungültige Fotodaten.' };
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.tenantId, authorization.data.tenantId),
      ),
    )
    .limit(1);

  if (!order) {
    return { ok: false as const, error: 'Auftrag nicht gefunden.' };
  }

  return {
    ok: true as const,
    data: { ...authorization.data, orderId },
  };
}

export async function prepareOrderPhotoUpload(params: {
  orderId: string;
  fileType: string;
  fileSize: number;
}) {
  const scope = await resolveAuthorizedPhotoOrder(params.orderId);
  if (!scope.ok) return { success: false as const, error: scope.error };

  const extension = ALLOWED_ORDER_PHOTO_TYPES.get(params.fileType.trim().toLowerCase());
  if (!extension) {
    return { success: false as const, error: 'Nicht unterstütztes Bildformat.' };
  }
  if (!Number.isSafeInteger(params.fileSize) || params.fileSize <= 0 || params.fileSize > MAX_ORDER_PHOTO_SIZE_BYTES) {
    return { success: false as const, error: 'Das Foto darf maximal 10 MB groß sein.' };
  }

  try {
    const storagePath = `${scope.data.tenantId}/${scope.data.orderId}/${createId()}.${extension}`;
    const storage = createOrderPhotoStorageAdmin().storage.from(ORDER_PHOTO_BUCKET);
    const { data: signedUpload, error: signedUploadError } =
      await storage.createSignedUploadUrl(storagePath, { upsert: false });

    if (signedUploadError || !signedUpload) {
      throw new Error(signedUploadError?.message ?? 'Upload-Freigabe fehlgeschlagen.');
    }

    const [pendingUpload] = await db
      .insert(scanUploads)
      .values({
        tenantId: scope.data.tenantId,
        linkedOrderId: scope.data.orderId,
        fileUrl: storagePath,
        fileType: params.fileType,
        uploadedBy: scope.data.userId,
        status: 'pending_upload',
        detectedType: 'Foto',
      })
      .returning({ id: scanUploads.id });

    if (!pendingUpload) {
      throw new Error('Upload konnte nicht vorgemerkt werden.');
    }

    return {
      success: true as const,
      data: {
        uploadId: pendingUpload.id,
        path: signedUpload.path,
        token: signedUpload.token,
      },
    };
  } catch (error: unknown) {
    console.error('Failed to prepare order photo upload:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Upload-Freigabe fehlgeschlagen.',
    };
  }
}

async function claimPendingUpload(params: {
  uploadId: string;
  orderId: string;
  tenantId: string;
  userId: string;
  nextStatus: 'finalizing' | 'cancelling';
}) {
  const [upload] = await db
    .update(scanUploads)
    .set({ status: params.nextStatus })
    .where(
      and(
        eq(scanUploads.id, params.uploadId),
        eq(scanUploads.linkedOrderId, params.orderId),
        eq(scanUploads.tenantId, params.tenantId),
        eq(scanUploads.uploadedBy, params.userId),
        eq(scanUploads.status, 'pending_upload'),
      ),
    )
    .returning({
      id: scanUploads.id,
      fileUrl: scanUploads.fileUrl,
      fileType: scanUploads.fileType,
      status: scanUploads.status,
    });

  return upload ?? null;
}

async function removeClaimedUpload(
  upload: { id: string; fileUrl: string },
  expectedStatus: string,
) {
  const { error: storageError } = await createOrderPhotoStorageAdmin()
    .storage
    .from(ORDER_PHOTO_BUCKET)
    .remove([upload.fileUrl]);
  if (storageError) throw new Error(storageError.message);

  await db
    .delete(scanUploads)
    .where(
      and(
        eq(scanUploads.id, upload.id),
        eq(scanUploads.status, expectedStatus),
      ),
    );
}

export async function completeOrderPhotoUpload(params: {
  orderId: string;
  uploadId: string;
}) {
  const scope = await resolveAuthorizedPhotoOrder(params.orderId);
  if (!scope.ok) return { success: false as const, error: scope.error };

  const pendingUpload = await claimPendingUpload({
    uploadId: params.uploadId.trim(),
    orderId: scope.data.orderId,
    tenantId: scope.data.tenantId,
    userId: scope.data.userId,
    nextStatus: 'finalizing',
  });
  if (!pendingUpload) {
    return { success: false as const, error: 'Upload-Vormerkung nicht gefunden.' };
  }

  try {
    const pathSeparator = pendingUpload.fileUrl.lastIndexOf('/');
    const folder = pendingUpload.fileUrl.slice(0, pathSeparator);
    const fileName = pendingUpload.fileUrl.slice(pathSeparator + 1);
    const { data: storedFiles, error: storageError } = await createOrderPhotoStorageAdmin()
      .storage
      .from(ORDER_PHOTO_BUCKET)
      .list(folder, { limit: 2, search: fileName });

    const storedFile = storedFiles?.find((file) => file.name === fileName);
    const storedSize = storedFile?.metadata?.size;
    const storedMimeType = storedFile?.metadata?.mimetype?.toLowerCase();
    if (
      storageError ||
      !storedFile ||
      storedSize === undefined ||
      storedSize <= 0 ||
      storedSize > MAX_ORDER_PHOTO_SIZE_BYTES ||
      !storedMimeType ||
      storedMimeType !== pendingUpload.fileType?.toLowerCase() ||
      !ALLOWED_ORDER_PHOTO_TYPES.has(storedMimeType)
    ) {
      throw new Error(storageError?.message ?? 'Hochgeladenes Foto ist ungültig.');
    }

    await db.transaction(async (tx) => {
      const [processedUpload] = await tx
        .update(scanUploads)
        .set({ status: 'processed' })
        .where(
          and(
            eq(scanUploads.id, pendingUpload.id),
            eq(scanUploads.tenantId, scope.data.tenantId),
            eq(scanUploads.status, 'finalizing'),
          ),
        )
        .returning({ id: scanUploads.id });

      if (!processedUpload) {
        throw new Error('Upload-Zustand wurde bereits verändert.');
      }

      await tx.insert(events).values({
        tenantId: scope.data.tenantId,
        orderId: scope.data.orderId,
        eventType: 'PHOTO_ADDED',
        description: 'Foto hinzugefügt',
        userId: scope.data.userId,
      });
    });
  } catch (error: unknown) {
    console.error('Failed to complete order photo upload:', error);
    try {
      await removeClaimedUpload(pendingUpload, 'finalizing');
    } catch (cleanupError: unknown) {
      console.error('Failed to compensate order photo upload:', cleanupError);
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Foto konnte nicht gespeichert werden.',
    };
  }

  try {
    revalidatePath('/orders');
    revalidatePath('/warendurchlauf');
  } catch (error: unknown) {
    console.error('Failed to revalidate completed order photo upload:', error);
  }

  return { success: true as const };
}

export async function cancelOrderPhotoUpload(params: {
  orderId: string;
  uploadId: string;
}) {
  const scope = await resolveAuthorizedPhotoOrder(params.orderId);
  if (!scope.ok) return { success: false as const, error: scope.error };

  const pendingUpload = await claimPendingUpload({
    uploadId: params.uploadId.trim(),
    orderId: scope.data.orderId,
    tenantId: scope.data.tenantId,
    userId: scope.data.userId,
    nextStatus: 'cancelling',
  });
  if (!pendingUpload) {
    return { success: false as const, error: 'Upload-Vormerkung nicht gefunden.' };
  }

  try {
    await removeClaimedUpload(pendingUpload, 'cancelling');

    return { success: true as const };
  } catch (error: unknown) {
    console.error('Failed to cancel order photo upload:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Upload konnte nicht bereinigt werden.',
    };
  }
}
