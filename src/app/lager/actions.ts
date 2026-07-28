"use server";

import { checkAppAuth, type ActionResult } from "@/lib/server/authHelper";

/**
 * The product database does not currently expose the required warehouse
 * relation. Do not query an absent relation and turn its failure into an empty
 * stock list.
 */
export async function getLagerbestandAction(): Promise<ActionResult<never>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  return {
    ok: false,
    error: "NOT_CONFIGURED",
    message: "Lagerbestand ist nicht freigegeben, weil der Produkt-Datenvertrag fehlt.",
  };
}
