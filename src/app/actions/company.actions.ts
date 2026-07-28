"use server";

import { companySettingsRepository, CompanySettings } from "@/lib/repositories/companySettingsRepository";

import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function assertCompanySettingsContract(): void {
  if (!isFoundationAreaEnabled("Unternehmenseinstellungen")) {
    foundationUnavailableAction("Unternehmenseinstellungen");
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  assertCompanySettingsContract();
  return companySettingsRepository.getSettings();
}

export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  assertCompanySettingsContract();
  await requireAdminOrDeveloper();
  return companySettingsRepository.updateSettings(data);
}
