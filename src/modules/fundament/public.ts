/** Browser-safe product-profile contract for the App Router composition seam. */
export type { StartUserDto as ProductStartProfile } from "@/lib/auth/userDtos";
export { SystemAdminView } from "./ui/SystemAdminView";
export type { SystemAdminViewProps } from "./ui/SystemAdminView";
export { SALES_STAGE_FEATURES, isFeatureEnabled } from "./featureCatalog";
export type { SalesStage, SalesStageFeature, SalesStageFeatureDefinition, SalesStageFeatureId } from "./featureCatalog";

export type CompanySettingsInput = {
  companyName: string; street: string; zip: string; city: string; country: string;
  taxId: string; iban: string; bic: string; bankName: string; paymentTermDays: number; logoUrl: string;
};
export type ManagedUser = { id: string; email: string; fullName: string; role: string; active: boolean };
export type UpdateManagedUserInput = { userId: string; role: "admin" | "meister" | "buero" | "werkstatt"; active: boolean; pin: string | null };
export type SystemSettingsSnapshot = {
  company: CompanySettingsInput;
  users: ManagedUser[];
  numberRanges: Array<{ label: string; pattern: string }>;
  features: import("./featureCatalog").SalesStageFeature[];
};
