"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { listCatalogServices } from "@/modules/katalog/server-public";

export async function getActiveCatalogAction() {
  noStore();
  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization || !authorization.ok) return { code: "UNAVAILABLE" as const, message: "Leistungskatalog ist derzeit nicht verfügbar." };
  return listCatalogServices({ tenantId: authorization.data.tenantId, canRead: authorization.data.permissions.includes("perm_data_orders"), canManage: false });
}
