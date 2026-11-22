/** Browser-safe product-profile contract for the App Router composition seam. */
export {emptyDispatchPolicy,dispatchPolicyValid,DISPATCH_DAY_FIELDS} from './dispatchPolicy';
export type {DispatchPolicy} from './dispatchPolicy';
export type { StartUserDto as ProductStartProfile } from "@/lib/auth/userDtos";
export { SystemAdminView } from "./ui/SystemAdminView";
export type { SystemAdminViewProps } from "./ui/SystemAdminView";
export { SALES_STAGE_FEATURES, isFeatureEnabled } from "./featureCatalog";
export type { SalesStage, SalesStageFeature, SalesStageFeatureDefinition, SalesStageFeatureId } from "./featureCatalog";
export { ACCESS_AREAS, ACCESS_AREA_LABELS, isAccessAreaAllowedForRole } from "@/lib/auth/authorizationContract";
export type { AccessArea, AppRole } from "@/lib/auth/authorizationContract";

export type CompanySettingsInput = {
  companyName: string; street: string; zip: string; city: string; country: string;
  taxId: string; taxNumber?: string; iban: string; bic: string; bankName: string; paymentTermDays: number; logoUrl: string;
  pageReads?:PageReadSettings;
};
export type ProtocolSettings={retentionDays:number|null;slowMs:number;hangMs:number};
export type CompanySettingsSnapshot = {
  [Key in keyof CompanySettingsInput]: CompanySettingsInput[Key] | null;
}&{protocol?:ProtocolSettings|null;pageReadsSchemaReady?:boolean};
export type CompanyLetterSettings=Pick<CompanySettingsInput,'companyName'|'street'|'zip'|'city'|'country'>&{phone?:string|null;taxId?:string|null;logoUrl?:string|null};
export type ShippingSettings = {
  shippingFeeCents?:number|null;
  dispatchPolicy?:import('./dispatchPolicy').DispatchPolicy|null;
  service:string;numberPattern:string;numberHint:string;trackingUrl:string|null;labelApi:string|null;updatedAt:string;
};
export type ManagedUser = {
  id: string;
  email: string | null;
  fullName: string;
  shortCode: string;
  designation: string;
  role: import("@/lib/auth/authorizationContract").AppRole;
  active: boolean;
  areas: import("@/lib/auth/authorizationContract").AccessArea[];
  fixedAreas: import("@/lib/auth/authorizationContract").AccessArea[];
  isCurrent: boolean;
};
export type UpdateManagedUserInput = {
  userId: string;
  fullName: string;
  shortCode: string;
  designation: string;
  active: boolean;
  pin: string | null;
};
export type CreateManagedUserInput = {
  fullName: string;
  shortCode: string;
  designation: string;
  template: "werkstatt" | "meister" | "leer";
  pin: string;
};
export type SetUserAreaInput = {
  userId: string;
  area: import("@/lib/auth/authorizationContract").AccessArea;
  granted: boolean;
};
export type SystemSettingsSnapshot = {
  company: CompanySettingsSnapshot;
  extraWorkHourlyRate: { rateId: string | null; hourlyRateCents: number | null; version: number };
  users: ManagedUser[];
  capabilities: { canManageCompany: boolean; canManageLogins: boolean; canManageSystem: boolean; canManageFinancial?: boolean };
  numberRanges: Array<{ label: string; pattern: string }>;
  features: import("./featureCatalog").SalesStageFeature[];
};

export {PACKAGE_SWITCHES,mapPackageSwitchRows} from "./featureCatalog";
export type {PackageSwitchId,PackageSwitchValues} from "./featureCatalog";

export type PageReadSettings={queryTimeoutMs:number;invoiceMailBatchLimit:number};
/** E-B: same company source, kept separate from the existing two-field editor. */
export type TodayReadSettings={todayReadSource:'modell'|'live';todayRefreshBatchLimit:number;todayRefreshLeaseSeconds:number;todayShadowIntervalMs:number;todayStalePollMs:number;navPrefetchMaxAgeSeconds:number};
export function todayReadSettingsFromCompany(value:unknown,defaults:Readonly<TodayReadSettings>):TodayReadSettings|null{
 if(value===null||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>;
 const fields=['todayReadSource','todayRefreshBatchLimit','todayRefreshLeaseSeconds','todayShadowIntervalMs','todayStalePollMs','navPrefetchMaxAgeSeconds'] as const;
 const present=fields.map(key=>source['has_'+key]);
 if(present.every(value=>value===false))return {todayReadSource:defaults.todayReadSource,todayRefreshBatchLimit:defaults.todayRefreshBatchLimit,todayRefreshLeaseSeconds:defaults.todayRefreshLeaseSeconds,todayShadowIntervalMs:defaults.todayShadowIntervalMs,todayStalePollMs:defaults.todayStalePollMs,navPrefetchMaxAgeSeconds:defaults.navPrefetchMaxAgeSeconds};
 if(!present.every(value=>value===true)||!['modell','live'].includes(String(source.todayReadSource)))return null;
 for(const key of fields.slice(1))if(!Number.isSafeInteger(source[key])||Number(source[key])<1||Number(source[key])>2147483647)return null;
 return {todayReadSource:source.todayReadSource as 'modell'|'live',todayRefreshBatchLimit:Number(source.todayRefreshBatchLimit),todayRefreshLeaseSeconds:Number(source.todayRefreshLeaseSeconds),todayShadowIntervalMs:Number(source.todayShadowIntervalMs),todayStalePollMs:Number(source.todayStalePollMs),navPrefetchMaxAgeSeconds:Number(source.navPrefetchMaxAgeSeconds)};
}
export function parsePageReadSettings(value:unknown):PageReadSettings|null{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  if(Object.keys(row).sort().join(',')!=='invoiceMailBatchLimit,queryTimeoutMs')return null;
  if(!Number.isSafeInteger(row.queryTimeoutMs)||Number(row.queryTimeoutMs)<1||Number(row.queryTimeoutMs)>2147483647
    ||!Number.isSafeInteger(row.invoiceMailBatchLimit)||Number(row.invoiceMailBatchLimit)<1||Number(row.invoiceMailBatchLimit)>2147483647)return null;
  return {queryTimeoutMs:Number(row.queryTimeoutMs),invoiceMailBatchLimit:Number(row.invoiceMailBatchLimit)};
}


/** Only the positively identified pre-migration schema uses the approved
 * defaults. Present but null/invalid/partially deployed settings stay unknown. */
export function pageReadSettingsFromCompany(value:unknown,defaults:Readonly<PageReadSettings>):{settings:PageReadSettings;schemaReady:boolean}|null{
 if(value===null||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(row.hasQueryTimeout===false&&row.hasInvoiceBatchLimit===false){
  const settings=parsePageReadSettings({queryTimeoutMs:defaults.queryTimeoutMs,invoiceMailBatchLimit:defaults.invoiceMailBatchLimit});
  return settings?{settings,schemaReady:false}:null;
 }
 if(row.hasQueryTimeout!==true||row.hasInvoiceBatchLimit!==true)return null;
 const settings=parsePageReadSettings({queryTimeoutMs:row.queryTimeoutMs,invoiceMailBatchLimit:row.invoiceMailBatchLimit});
 return settings?{settings,schemaReady:true}:null;
}
