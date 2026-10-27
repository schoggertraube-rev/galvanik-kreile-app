"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { discardIntakeDraft, readIntakeDraft, saveIntakeDraft } from "@/lib/server/intakeDraft";

async function authorization() {
  const result = await resolveAuthorization().catch(() => null);
  return result && result.ok ? result.data : null;
}

export async function readIntakeDraftAction() {
  noStore();
  const auth = await authorization();
  return auth ? readIntakeDraft(auth) : { code: "UNAVAILABLE" as const, message: "Sitzung ist nicht verfügbar." };
}

export async function saveIntakeDraftAction(payload: unknown) {
  const auth = await authorization();
  return auth ? saveIntakeDraft(auth, payload) : { code: "UNAVAILABLE" as const, message: "Sitzung ist nicht verfügbar." };
}

export async function discardIntakeDraftAction() {
  const auth = await authorization();
  return auth ? discardIntakeDraft(auth) : { code: "UNAVAILABLE" as const, message: "Sitzung ist nicht verfügbar." };
}
