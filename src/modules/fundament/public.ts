/** Browser-safe product-profile contract for the App Router composition seam. */
export type { StartUserDto as ProductStartProfile } from "@/lib/auth/userDtos";
export { SystemAdminView } from "./ui/SystemAdminView";
export type { SystemAdminViewProps } from "./ui/SystemAdminView";
export { SALES_STAGE_FEATURES, isFeatureEnabled } from "./featureCatalog";
export type { SalesStage, SalesStageFeature, SalesStageFeatureDefinition, SalesStageFeatureId } from "./featureCatalog";
export { ACCESS_AREAS, ACCESS_AREA_LABELS } from "@/lib/auth/authorizationContract";
export type { AccessArea, AppRole } from "@/lib/auth/authorizationContract";

export type CompanySettingsInput = {
  companyName: string; street: string; zip: string; city: string; country: string;
  taxId: string; iban: string; bic: string; bankName: string; paymentTermDays: number; logoUrl: string;
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
  company: CompanySettingsInput;
  extraWorkHourlyRate: { rateId: string | null; hourlyRateCents: number | null; version: number };
  users: ManagedUser[];
  capabilities: { canManageCompany: boolean; canManageLogins: boolean; canManageSystem: boolean };
  numberRanges: Array<{ label: string; pattern: string }>;
  features: import("./featureCatalog").SalesStageFeature[];
};
