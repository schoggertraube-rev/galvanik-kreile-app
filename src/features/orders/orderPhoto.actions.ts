'use server';

import { db } from '@/db';
import { scanUploads, events } from '@/db/schema';
import { getCurrentAppUser } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return null;
}

export async function uploadOrderPhotoRecord(params: {
  orderId: string;
  fileUrl: string;
  fileType: string;
}) {
  const { orderId, fileUrl, fileType } = params;
  
  const user = await getCurrentAppUser();
  const userId = user ? user.id : null;

  try {
    await db.transaction(async (tx) => {
      // 1. Insert into scan_uploads (reusing existing schema)
      await tx.insert(scanUploads).values({
        tenantId: 'galvanik-kreile',
        linkedOrderId: orderId,
        fileUrl: fileUrl,
        fileType: fileType,
        uploadedBy: userId,
        status: 'processed',
        detectedType: 'Foto',
      });

      // 2. Insert PHOTO_ADDED event
      await tx.insert(events).values({
        tenantId: 'galvanik-kreile',
        orderId: orderId,
        eventType: 'PHOTO_ADDED',
        description: 'Foto hinzugefügt',
        userId: userId,
      });
    });

    revalidatePath('/orders');
    revalidatePath('/warendurchlauf');

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to insert photo record:", error);
    return { success: false, error: getErrorMessage(error) || 'Database error' };
  }
}
