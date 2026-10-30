"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { discardIntakeDraft, readIntakeDraft, saveIntakeDraft } from "@/lib/server/intakeDraft";

async function authorization() {
  return resolveAuthorization();
}

export async function readIntakeDraftAction() {
  noStore();
  const auth = await authorization();
  return auth.ok ? readIntakeDraft(auth.data) : { code: "UNAVAILABLE" as const, message: auth.message };
}

export async function saveIntakeDraftAction(payload: unknown) {
  const auth = await authorization();
  return auth.ok ? saveIntakeDraft(auth.data, payload) : { code: "UNAVAILABLE" as const, message: auth.message };
}

export async function discardIntakeDraftAction() {
  const auth = await authorization();
  return auth.ok ? discardIntakeDraft(auth.data) : { code: "UNAVAILABLE" as const, message: auth.message };
}
