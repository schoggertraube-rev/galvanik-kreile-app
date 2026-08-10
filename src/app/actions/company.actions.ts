"use server";

import { companySettingsRepository, CompanySettings } from "@/lib/repositories/companySettingsRepository";

import { requireAdminOrDeveloper } from "@/lib/auth/permissions";

export async function getCompanySettings(): Promise<CompanySettings> {
  return companySettingsRepository.getSettings();
}

export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  await requireAdminOrDeveloper();
  void data;
  throw new Error("NOT_AVAILABLE: Sichere Firmendatenänderung benötigt den W3-Command-Vertrag.");
}
