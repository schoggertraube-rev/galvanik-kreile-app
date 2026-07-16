"use server";

import { createOrderDb } from "./orders.actions";

export {
  applyCaptureTemplate,
  getCaptureOverview,
  recordMaterialCapture,
  recordTimeCapture,
} from "./capture.actions";

/** @deprecated Auftragserstellung läuft über denselben validierten, atomaren Orders-Service. */
export async function createOrderFromErfassung(input: unknown): Promise<{
  ok: boolean;
  order?: Record<string, unknown>;
  error?: string;
}> {
  const result = await createOrderDb(input);
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true, order: result.data };
}
