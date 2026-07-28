"use server";

import { checkAppAuth, type ActionResult } from "@/lib/server/authHelper";

/**
 * The current product schema has no canonical QS relation. Returning an empty
 * collection would falsely communicate that no quality issues exist.
 */
export async function getQsListenAction(): Promise<ActionResult<never>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  return {
    ok: false,
    error: "NOT_CONFIGURED",
    message: "Qualitätskontrolle ist nicht freigegeben, weil der Produkt-Datenvertrag fehlt.",
  };
}
