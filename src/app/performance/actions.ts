"use server";

import { checkAppAuth, type ActionResult } from "@/lib/server/authHelper";

/**
 * A duration of zero is not a measured performance value. The performance
 * aggregate remains deliberately unavailable until its canonical source views
 * and evidence contract are deployed and validated.
 */
export async function getPerformanceKPIsAction(): Promise<ActionResult<never>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  return {
    ok: false,
    error: "NOT_CONFIGURED",
    message: "Performance-Kennzahlen sind nicht freigegeben, weil der Produkt-Datenvertrag fehlt.",
  };
}
