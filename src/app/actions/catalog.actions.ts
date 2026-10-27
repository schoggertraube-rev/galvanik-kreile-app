"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { listCatalogServices } from "@/modules/katalog/server-public";

export async function getActiveCatalogAction() {
  noStore();
  try {
    const authorization = await resolveAuthorization();
    if (!authorization.ok) return { code: "UNAVAILABLE" as const, message: "Leistungskatalog ist derzeit nicht verfügbar." };
    if (!authorization.data.areas?.includes("geld")) return { code: "FORBIDDEN" as const, message: "Preise sind für dieses Profil nicht freigegeben." };
    return await listCatalogServices({ tenantId: authorization.data.tenantId, canRead: authorization.data.permissions.includes("perm_data_orders"), canManage: false });
  } catch (error) {
    console.error("[ORDER_CARD_CATALOG_ACTION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE" as const, message: "Leistungskatalog ist derzeit nicht verfügbar." };
  }
}
