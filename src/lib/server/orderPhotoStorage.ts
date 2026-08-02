import { createId } from '@paralleldrive/cuid2';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { and, eq, inArray, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import { scanUploads } from '@/db/schema';

export const ORDER_PHOTO_BUCKET = 'scans';
export const MAX_ORDER_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ORDER_PHOTO_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
]);

const ABANDONABLE_UPLOAD_STATES = [
  'pending_upload',
  'finalizing',
  'cancelling',
];

export function createOrderPhotoStorageAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Storage-Konfiguration nicht verfügbar.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function removeCleanupClaim(upload: { id: string; fileUrl: string; claimToken: string }) {
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
        eq(scanUploads.status, 'cleanup_claimed'),
        eq(scanUploads.uploadClaimToken, upload.claimToken),
      ),
    );
}

export async function cleanupExpiredOrderPhotoUploads(now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiredClaimCutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const candidates = await db
    .select({
      id: scanUploads.id,
      fileUrl: scanUploads.fileUrl,
      status: scanUploads.status,
      claimToken: scanUploads.uploadClaimToken,
    })
    .from(scanUploads)
    .where(
      and(
        eq(scanUploads.detectedType, 'Foto'),
        or(
          and(
            inArray(scanUploads.status, ABANDONABLE_UPLOAD_STATES),
            lte(scanUploads.uploadedAt, cutoff),
          ),
          and(
            eq(scanUploads.status, 'cleanup_claimed'),
            lte(scanUploads.uploadClaimedAt, expiredClaimCutoff),
          ),
        ),
      ),
    )
    .limit(100);

  let cleaned = 0;
  let failed = 0;

  for (const candidate of candidates) {
    if (candidate.status === 'cleanup_claimed' && !candidate.claimToken) continue;

    const claimToken = createId();
    const priorStatePredicate = candidate.status === 'cleanup_claimed'
      ? and(
          eq(scanUploads.status, 'cleanup_claimed'),
          eq(scanUploads.uploadClaimToken, candidate.claimToken as string),
          lte(scanUploads.uploadClaimedAt, expiredClaimCutoff),
        )
      : and(
          eq(scanUploads.status, candidate.status),
          lte(scanUploads.uploadedAt, cutoff),
        );

    const [claimed] = await db
      .update(scanUploads)
      .set({
        status: 'cleanup_claimed',
        uploadClaimToken: claimToken,
        uploadClaimedAt: now,
      })
      .where(
        and(
          eq(scanUploads.id, candidate.id),
          priorStatePredicate,
        ),
      )
      .returning({
        id: scanUploads.id,
        fileUrl: scanUploads.fileUrl,
        claimToken: scanUploads.uploadClaimToken,
      });

    if (!claimed?.claimToken) continue;

    try {
      await removeCleanupClaim({
        id: claimed.id,
        fileUrl: claimed.fileUrl,
        claimToken: claimed.claimToken,
      });
      cleaned += 1;
    } catch (error: unknown) {
      failed += 1;
      console.error('Failed to clean expired order photo upload:', error);
    }
  }

  return { cleaned, failed };
}
