"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readSystemSettings, readTenantFeatures, setTenantFeature, updateCompanySettings, updateManagedUser } from "@/modules/fundament/server-public";
import { listCatalogServices, saveCatalogService } from "@/modules/katalog/server-public";
import type { CompanySettingsInput, UpdateManagedUserInput } from "@/modules/fundament/public";
import type { SalesStageFeatureId } from "@/modules/fundament/public";
import type { SaveCatalogServiceInput } from "@/modules/katalog/public";

async function adminContext() {
  const result = await resolveAuthorization();
  if (!result.ok || !(["meister", "admin", "developer"] as const).includes(
    result.data.role as "meister" | "admin" | "developer",
  )) return null;
  return { tenantId: result.data.tenantId, actorId: result.data.userId, canManage: true };
}

export async function readSettingsAction() {
  noStore();
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Einstellungen sind mit dieser Rolle nicht verfügbar." };
  const [settings, catalog, hourlyRate] = await Promise.all([
    readSystemSettings(context),
    listCatalogServices({ tenantId: context.tenantId, canRead: true, canManage: true }, true),
    import("@/lib/server/commands/extraWorkAdminCommand").then(({ readExtraWorkHourlyRate }) => readExtraWorkHourlyRate()),
  ]);
  if (settings.code !== "OK") return settings;
  if (catalog.code !== "OK") return catalog;
  if (hourlyRate.code !== "OK") return hourlyRate;
  return { code: "OK" as const, snapshot: { ...settings.snapshot, extraWorkHourlyRate: hourlyRate.rate }, services: catalog.services };
}

export async function readSalesStageFeaturesAction() {
  noStore();
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Stufen-Schalter sind mit dieser Rolle nicht verfügbar." };
  return readTenantFeatures(context);
}

export async function saveSalesStageFeatureAction(input: { featureId: SalesStageFeatureId; enabled: boolean }) {
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Stufen-Schalter dürfen mit dieser Rolle nicht geändert werden." };
  const result = await setTenantFeature(context, input);
  if (result.code === "OK") revalidatePath("/", "layout");
  return result;
}

export async function saveCompanySettingsAction(input: CompanySettingsInput) {
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Firmendaten dürfen nicht geändert werden." };
  const result = await updateCompanySettings(context, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;
}

export async function saveManagedUserAction(input: UpdateManagedUserInput) {
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Nutzer dürfen nicht geändert werden." };
  const result = await updateManagedUser(context, input);
  if (result.code === "OK") {
    revalidatePath("/settings");
    revalidatePath("/start");
  }
  return result;
}

export async function saveCatalogServiceAction(input: SaveCatalogServiceInput) {
  const context = await adminContext();
  if (!context) return { code: "FORBIDDEN" as const, message: "Leistungen dürfen nicht geändert werden." };
  const result = await saveCatalogService({ tenantId: context.tenantId, canRead: true, canManage: true }, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;
}
