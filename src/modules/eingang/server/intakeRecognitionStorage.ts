import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveIntakeRecognitionOriginal(input: {
  bucket: string;
  tenantId: string;
  originalSha256: string;
  model: string;
  bytes: Uint8Array;
}) {
  const path = `${input.tenantId}/${input.originalSha256}.erkennung.${input.model}.json`;
  const bucket = createAdminClient().storage.from(input.bucket);
  const saved = await bucket.upload(path, input.bytes, { contentType: "application/json", upsert: false });
  if (!saved.error) return { path, bytes: input.bytes };

  // A retry reads the already secured response for this original and model.
  const existing = await bucket.download(path);
  if (existing.error || !existing.data) throw Error("INTAKE_RECOGNITION_ORIGINAL_NOT_SAVED");
  return { path, bytes: new Uint8Array(await existing.data.arrayBuffer()) };
}
