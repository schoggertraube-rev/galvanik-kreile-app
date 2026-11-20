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
  pageReads?:import('@/lib/domain/pageReadSettings').PageReadSettings;
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
