"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  changeOwnPin,
  createManagedUser,
  readSystemSettings,
  readTenantFeatures,
  setManagedUserArea,
  setTenantFeature,
  updateCompanySettings,
  updateManagedUser,
} from "@/modules/fundament/server-public";
import { listCatalogServices, saveCatalogService } from "@/modules/katalog/server-public";
import type { CompanySettingsInput, CreateManagedUserInput, SetUserAreaInput, UpdateManagedUserInput } from "@/modules/fundament/public";
import type { SalesStageFeatureId } from "@/modules/fundament/public";
import type { SaveCatalogServiceInput } from "@/modules/katalog/public";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";

async function settingsContext() {
  const result = await resolveAuthorization();
  if (!result.ok) return null;
  const areas = result.data.areas ?? [];
  return {
    authorization: result.data,
    context: {
      tenantId: result.data.tenantId,
      actorId: result.data.userId,
      canManage: true,
      canManageCompany: areas.includes("einstellungen"),
      canManageLogins: areas.includes("logins"),
      canManageSystem: areas.includes("wartung"),
    },
  };
}

export async function readSettingsAction() {
  noStore();
  const resolved = await settingsContext();
  if (!resolved) return { code: "FORBIDDEN" as const, message: "Einstellungen sind momentan nicht verfügbar." };
  const { context } = resolved;
  const canManageCompany = resolved.authorization.areas?.includes("einstellungen") ?? false;
  const canManageLogins = resolved.authorization.areas?.includes("logins") ?? false;
  const [settings, catalog, hourlyRate] = await Promise.all([
    readSystemSettings(context),
    canManageCompany
      ? listCatalogServices({ tenantId: context.tenantId, canRead: true, canManage: true }, true)
      : Promise.resolve({ code: "OK" as const, services: [] }),
    canManageCompany
      ? import("@/lib/server/commands/extraWorkAdminCommand").then(({ readExtraWorkHourlyRate }) => readExtraWorkHourlyRate())
      : Promise.resolve({ code: "OK" as const, rate: { rateId: null, hourlyRateCents: null, version: 0 } }),
  ]);
  if (settings.code !== "OK") return settings;
  if (catalog.code !== "OK") return catalog;
  if (hourlyRate.code !== "OK") return hourlyRate;
  return {
    code: "OK" as const,
    snapshot: {
      ...settings.snapshot,
      company: canManageCompany ? settings.snapshot.company : { companyName: "", street: "", zip: "", city: "", country: "", taxId: "", iban: "", bic: "", bankName: "", paymentTermDays: 0, logoUrl: "" },
      numberRanges: canManageCompany ? settings.snapshot.numberRanges : [],
      users: canManageLogins ? settings.snapshot.users : [],
      extraWorkHourlyRate: hourlyRate.rate,
    },
    services: catalog.services,
  };
}

export async function readSalesStageFeaturesAction() {
  noStore();
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("wartung")) return { code: "FORBIDDEN" as const, message: "Stufen-Schalter sind nicht verfügbar." };
  return readTenantFeatures(resolved.context);
}

export async function saveSalesStageFeatureAction(input: { featureId: SalesStageFeatureId; enabled: boolean }) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("wartung")) return { code: "FORBIDDEN" as const, message: "Stufen-Schalter dürfen nicht geändert werden." };
  const result = await setTenantFeature(resolved.context, input);
  if (result.code === "OK") revalidatePath("/", "layout");
  return result;
}

export async function saveCompanySettingsAction(input: CompanySettingsInput) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("einstellungen")) return { code: "FORBIDDEN" as const, message: "Firmendaten dürfen nicht geändert werden." };
  const result = await updateCompanySettings(resolved.context, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;
}

export async function saveManagedUserAction(input: UpdateManagedUserInput) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Logins dürfen nicht geändert werden." };
  const result = await updateManagedUser(resolved.context, input);
  if (result.code === "OK") {
    revalidatePath("/settings");
    revalidatePath("/start");
  }
  return result;
}

export async function createManagedUserAction(input: CreateManagedUserInput) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Logins dürfen nicht angelegt werden." };
  const result = await createManagedUser(resolved.context, input);
  if (result.code === "OK") {
    revalidatePath("/settings");
    revalidatePath("/start");
  }
  return result;
}

export async function setManagedUserAreaAction(input: SetUserAreaInput) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Rechte dürfen nicht geändert werden." };
  const result = await setManagedUserArea(resolved.context, input);
  if (result.code === "OK") revalidatePath("/", "layout");
  return result;
}

export async function changeOwnPinAction(input: { pin: string }) {
  const resolved = await settingsContext();
  if (!resolved) return { code: "FORBIDDEN" as const, message: "Der eigene Code kann momentan nicht geändert werden." };
  const result = await changeOwnPin({ tenantId: resolved.authorization.tenantId, actorId: resolved.authorization.userId }, input);
  if (result.code === "OK") {
    const now = Date.now();
    await setAppSession({
      userId: resolved.authorization.userId,
      tenantId: resolved.authorization.tenantId,
      role: resolved.authorization.role,
      displayName: resolved.authorization.displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
  }
  return result;
}

export async function saveCatalogServiceAction(input: SaveCatalogServiceInput) {
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("einstellungen")) return { code: "FORBIDDEN" as const, message: "Leistungen dürfen nicht geändert werden." };
  const result = await saveCatalogService({ tenantId: resolved.context.tenantId, canRead: true, canManage: true }, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;
}
