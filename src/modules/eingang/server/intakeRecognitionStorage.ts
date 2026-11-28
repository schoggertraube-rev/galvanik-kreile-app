import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAzureRecognitionOriginal } from "@/lib/server/azureDocumentIntelligence";
import { readAzurePositionRows } from "./intakeRecognitionPositions";

function recognitionPath(tenantId:string, sha256:string, model:string) {
  return `${tenantId}/${sha256}.erkennung.${model}.json`;
}

export async function readStoredIntakePositionPages(tenantId:string, sha256:string, model:string) {
  const path = recognitionPath(tenantId, sha256, model);
  const response = await createAdminClient().storage.from('scans').download(path);
  if (response.error || !response.data) throw Error('INTAKE_RECOGNITION_ORIGINAL_UNAVAILABLE');
  const original = readAzureRecognitionOriginal(new Uint8Array(await response.data.arrayBuffer()), model).original;
  return new Map(readAzurePositionRows(original?.tables ?? []).map(({source}) =>
    [`${source.tableIndex}:${source.rowIndex}`, source.page]));
}

export async function saveIntakeRecognitionOriginal(input: {
  bucket: string;
  tenantId: string;
  originalSha256: string;
  model: string;
  bytes: Uint8Array;
}) {
  const path = recognitionPath(input.tenantId, input.originalSha256, input.model);
  const bucket = createAdminClient().storage.from(input.bucket);
  const saved = await bucket.upload(path, input.bytes, { contentType: "application/json", upsert: false });
  if (!saved.error) return { path, bytes: input.bytes };

  // A retry reads the already secured response for this original and model.
  const existing = await bucket.download(path);
  if (existing.error || !existing.data) throw Error("INTAKE_RECOGNITION_ORIGINAL_NOT_SAVED");
  return { path, bytes: new Uint8Array(await existing.data.arrayBuffer()) };
}
