"use server";
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';

import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {applyPinChangeRateLimit} from "@/lib/server/pinRateLimit";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization,hasAuthorizationArea } from "@/lib/server/authorization";
import {
  changeOwnPin,
  createManagedUser,
  readSystemSettings,
  readTenantFeatures,
  readPackageSwitches,
  setPackageSwitch,
  setManagedUserArea,
  setTenantFeature,
  updateCompanySettings,
  updateManagedUser,
} from "@/modules/fundament/server-public";
import { listCatalogServices, saveCatalogService } from "@/modules/katalog/server-public";
import type { CompanySettingsInput, ProtocolSettings, CreateManagedUserInput, SetUserAreaInput, UpdateManagedUserInput } from "@/modules/fundament/public";
import type { SalesStageFeatureId } from "@/modules/fundament/public";
import type { SaveCatalogServiceInput } from "@/modules/katalog/public";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";

async function settingsContext() {
  const result = await resolveAuthorization();
  if (!result.ok) {
    console.error("[SETTINGS_AUTHORIZATION_FAILED]", { reason: result.reason });
    return null;
  }
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
      canManageFinancial: hasAuthorizationArea(result.data,'preise'),
      canManageStorageCharges: hasAuthorizationArea(result.data,'zahlungen'),
    },
  };
}

/** S21 config uses the same current rights snapshot as the existing settings. */
export async function readPackageSwitchesAction(){
 const auth=await settingsContext();
 if(!auth)return {code:'UNAUTHENTICATED' as const};
 return readPackageSwitches({tenantId:auth.authorization.tenantId,actorId:auth.authorization.userId,
  canManage:auth.context.canManageCompany});
}
export async function setPackageSwitchAction(input:unknown){
 return observeAction('setPackageSwitchAction',subjectForAction('setPackageSwitchAction',input),async()=>{
  const auth=await settingsContext();
  if(!auth)return {code:'UNAUTHENTICATED' as const};
  return setPackageSwitch({tenantId:auth.authorization.tenantId,actorId:auth.authorization.userId,
   canManage:auth.context.canManageCompany},input);
 },readLoggingSettings);
}

export async function readEmailTemplatesAction(){
 return observeAction('readEmailTemplatesAction',subjectForAction('readEmailTemplatesAction',undefined),async()=>{
 noStore();const resolved=await settingsContext();
 if(!resolved)return {code:'UNAUTHENTICATED' as const,message:'Sitzung fehlt.'};
 const {readStoredEmailTemplates}=await import('@/lib/server/commands/emailTemplateCommand');
 return readStoredEmailTemplates(resolved.authorization);

 },readLoggingSettings);
}
export async function saveEmailTemplateAction(input:unknown){
 return observeAction('saveEmailTemplateAction',subjectForAction('saveEmailTemplateAction',input),async()=>{
 const resolved=await settingsContext();if(!resolved)return {code:'UNAUTHENTICATED' as const,message:'Sitzung fehlt.'};
 const {saveStoredEmailTemplate}=await import('@/lib/server/commands/emailTemplateCommand');
 return saveStoredEmailTemplate(resolved.authorization,input);

 },readLoggingSettings);
}

async function refreshSettingsSession(authorization: {
  userId: string;
  tenantId: string;
  role: string;
  displayName: string;
}): Promise<void> {
  const now = Date.now();
  await setAppSession({
    userId: authorization.userId,
    tenantId: authorization.tenantId,
    role: authorization.role,
    displayName: authorization.displayName,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

function presentShippingSettings<T extends object>(result:T,canReadPrices:boolean,canReadPayments:boolean):T{
 if(canReadPrices&&canReadPayments)return result;
 const presented={...result} as Record<string,unknown>;
 for(const key of ['settings','current']){
  const settings=presented[key];if(!settings||typeof settings!=='object'||Array.isArray(settings))continue;
  const value=settings as Record<string,unknown>,policy=value.dispatchPolicy;
  const operationalSettings={...value};if(!canReadPrices)delete operationalSettings.shippingFeeCents;
  presented[key]=operationalSettings;
  if(!canReadPayments&&policy&&typeof policy==='object'&&!Array.isArray(policy)){
   const operational={...policy} as Record<string,unknown>;delete operational.storageWeeklyCents;
   presented[key]={...operationalSettings,dispatchPolicy:operational};
  }
 }
 return presented as T;
}
export async function readShippingSettingsAction(){
 const resolved=await settingsContext();if(!resolved)return {code:"UNAUTHENTICATED" as const,message:"Sitzung fehlt."};
 const {readShippingSettings}=await import("@/modules/fundament/server-public");
 const result=await readShippingSettings({...resolved.context,canRead:resolved.context.canManageCompany===true||resolved.authorization.areas?.includes("auftraege")===true});
 return presentShippingSettings(result,resolved.context.canManageFinancial,resolved.context.canManageStorageCharges);
}
export async function saveQuoteSettingsAction(input:unknown) {
 return observeAction('saveQuoteSettingsAction',subjectForAction('saveQuoteSettingsAction',input),async()=>{
  const resolved=await settingsContext();
  if (!resolved) return {code:'UNAUTHENTICATED' as const,message:'Sitzung fehlt.'};
  const {saveQuoteSettings}=await import('@/modules/fundament/server-public');
  const result=await saveQuoteSettings(resolved.context,input);
  if (result.code==='OK') revalidatePath('/settings');
  return result;

 },readLoggingSettings);
}
export async function saveShippingSettingsAction(input:unknown){
 return observeAction('saveShippingSettingsAction',subjectForAction('saveShippingSettingsAction',input),async()=>{
 const resolved=await settingsContext();if(!resolved)return {code:"UNAUTHENTICATED" as const,message:"Sitzung fehlt."};
 const {updateShippingSettings}=await import("@/modules/fundament/server-public");const result=await updateShippingSettings(resolved.context,input);
 return presentShippingSettings(result,resolved.context.canManageFinancial,resolved.context.canManageStorageCharges);

 },readLoggingSettings);
}

export async function readSettingsAction() {
  noStore();
  const resolved = await settingsContext();
  if (!resolved) return { code: "FORBIDDEN" as const, message: "Einstellungen sind momentan nicht verfügbar." };
  const { context } = resolved;
  const canManageCompany = resolved.authorization.areas?.includes("einstellungen") ?? false;
  const canManageLogins = resolved.authorization.areas?.includes("logins") ?? false;
  const canManageFinancial = resolved.context.canManageFinancial;

  const [settings, catalog, hourlyRate] = await Promise.all([
    readSystemSettings(context),
    canManageCompany && canManageFinancial
      ? listCatalogServices({ tenantId: context.tenantId, actorId: context.actorId, canRead: true, canManage: true }, true)
      : Promise.resolve({ code: "OK" as const, services: [] }),
    canManageCompany && canManageFinancial
      ? import("@/lib/server/commands/extraWorkAdminCommand").then(({ readExtraWorkHourlyRate }) => readExtraWorkHourlyRate())
      : Promise.resolve({ code: "OK" as const, rate: { rateId: null, hourlyRateCents: null, version: 0 } }),
  ]);
  if (settings.code !== "OK") return settings;
  if (catalog.code !== "OK") return catalog;
  if (hourlyRate.code !== "OK") return hourlyRate;
  return {
    code: "OK" as const,
    catalogLocked: canManageCompany && !canManageFinancial ? FINANCIAL_ACCESS_COPY.pricesMissing : null,
    snapshot: {
      ...settings.snapshot,
      company: canManageCompany ? settings.snapshot.company : { companyName: "", street: "", zip: "", city: "", country: "", taxId: "", iban: "", bic: "", bankName: "", paymentTermDays: 0, logoUrl: "" },
      numberRanges: canManageCompany ? settings.snapshot.numberRanges : [],
      users: canManageLogins
        ? settings.snapshot.users
        : settings.snapshot.users.filter((user) => user.isCurrent),
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

export async function saveCompanySettingsAction(input: CompanySettingsInput&{protocol?:ProtocolSettings}) {
 return observeAction('saveCompanySettingsAction',subjectForAction('saveCompanySettingsAction',input),async()=>{
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("einstellungen")) return { code: "FORBIDDEN" as const, message: "Firmendaten dürfen nicht geändert werden." };
  const result = await updateCompanySettings(resolved.context, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;

 },readLoggingSettings);
}

export async function saveManagedUserAction(input: UpdateManagedUserInput) {
 return observeAction('saveManagedUserAction',subjectForAction('saveManagedUserAction',input),async()=>{
  try {
    const resolved = await settingsContext();
    if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Logins dürfen nicht geändert werden." };
    const result = await updateManagedUser(resolved.context, input,(tx,phase,userId)=>applyPinChangeRateLimit(tx,resolved.context.tenantId,userId,phase));
    if (result.code === "OK") {
      if (input.userId === resolved.authorization.userId) {
        await refreshSettingsSession({ ...resolved.authorization, displayName: input.fullName });
      }
      revalidatePath("/settings");
      revalidatePath("/start");
    }
    return result;
  } catch (error) {
    console.error("[SETTINGS_USER_ACTION_FAILED]", error);
    return { code: "UNAVAILABLE" as const, message: "Login konnte nicht gespeichert werden. Fehlercode: SETTINGS_USER_ACTION_FAILED." };
  }

 },readLoggingSettings);
}

export async function createManagedUserAction(input: CreateManagedUserInput) {
 return observeAction('createManagedUserAction',subjectForAction('createManagedUserAction',input),async()=>{
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Logins dürfen nicht angelegt werden." };
  const result = await createManagedUser(resolved.context, input);
  if (result.code === "OK") {
    revalidatePath("/settings");
    revalidatePath("/start");
  }
  return result;

 },readLoggingSettings);
}

export async function setManagedUserAreaAction(input: SetUserAreaInput) {
 return observeAction('setManagedUserAreaAction',subjectForAction('setManagedUserAreaAction',input),async()=>{
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("logins")) return { code: "FORBIDDEN" as const, message: "Rechte dürfen nicht geändert werden." };
  const result = await setManagedUserArea(resolved.context, input);
  if (result.code === "OK") revalidatePath("/", "layout");
  return result;

 },readLoggingSettings);
}

export async function changeOwnPinAction(input: { pin: string }) {
 return observeAction('changeOwnPinAction',subjectForAction('changeOwnPinAction',input),async()=>{
  try {
    const resolved = await settingsContext();
    if (!resolved) return { code: "FORBIDDEN" as const, message: "Der eigene Code kann momentan nicht geändert werden." };
    const result = await changeOwnPin({ tenantId: resolved.authorization.tenantId, actorId: resolved.authorization.userId }, input,(tx,phase,userId)=>applyPinChangeRateLimit(tx,resolved.authorization.tenantId,userId,phase));
    if (result.code === "OK") {
      await refreshSettingsSession(resolved.authorization);
    }
    return result;
  } catch (error) {
    console.error("[SETTINGS_OWN_PIN_ACTION_FAILED]", error);
    return { code: "UNAVAILABLE" as const, message: "Code konnte nicht gespeichert werden. Fehlercode: SETTINGS_OWN_PIN_ACTION_FAILED." };
  }

 },readLoggingSettings);
}

export async function saveCatalogServiceAction(input: SaveCatalogServiceInput) {
 return observeAction('saveCatalogServiceAction',subjectForAction('saveCatalogServiceAction',input),async()=>{
  const resolved = await settingsContext();
  if (!resolved?.authorization.areas?.includes("einstellungen")) return { code: "FORBIDDEN" as const, message: "Leistungen dürfen nicht geändert werden." };
  if (!resolved.context.canManageFinancial) return { code: "FORBIDDEN" as const, message: FINANCIAL_ACCESS_COPY.pricesMissing };
  const result = await saveCatalogService({ tenantId: resolved.context.tenantId, actorId: resolved.context.actorId, canRead: true, canManage: true }, input);
  if (result.code === "OK") revalidatePath("/settings");
  return result;

 },readLoggingSettings);
}
