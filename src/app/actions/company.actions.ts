"use server";

import type { CompanySettings } from "@/lib/repositories/companySettingsRepository";
import { requireAdminOrDeveloper } from "@/lib/auth/permissions";

export async function getCompanySettings(): Promise<CompanySettings> {
  throw new Error("NOT_AVAILABLE: Firmendaten-Anzeige benötigt einen tenant- und capability-geprüften W3-Read-Vertrag.");
}

export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  await requireAdminOrDeveloper();
  void data;
  throw new Error("NOT_AVAILABLE: Sichere Firmendatenänderung benötigt den W3-Command-Vertrag.");
}
