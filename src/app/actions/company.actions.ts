"use server";

import { companySettingsRepository, CompanySettings } from "@/lib/repositories/companySettingsRepository";

export async function getCompanySettings(): Promise<CompanySettings> {
  return companySettingsRepository.getSettings();
}

export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  return companySettingsRepository.updateSettings(data);
}
