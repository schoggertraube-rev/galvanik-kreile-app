"use server";

import { readAuthorizedArea } from "@/lib/server/authHelper";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readUmsatzsteuerSaetzeInTransaction } from "@/modules/fundament/server-public";

export async function readBuchhaltungSteuersaetzeAction() {
  const berechtigung = await readAuthorizedArea("buchhaltung");
  if (!berechtigung.ok) return null;
  const { tenantId } = berechtigung.data;
  return withPrivilegedTenantTransaction(berechtigung.data, tx => readUmsatzsteuerSaetzeInTransaction(tx, tenantId));
}
