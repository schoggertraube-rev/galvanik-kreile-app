export interface CompanySettings {
  id?: string;
  tenantId?: string;
  configured?: boolean;
  companyName: string;
  tagline: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bic: string;
  bankName: string;
  taxId: string;
  logoUrl: string;
  emailGreeting: string;
  emailPickupInfo: string;
  emailPaymentInfo: string;
  emailAgbText: string;
  emailFooter: string;
  emailAdditionalNotes: string;
}

export const EMPTY_COMPANY_SETTINGS: CompanySettings = {
  configured: false,
  companyName: "",
  tagline: "",
  street: "",
  zip: "",
  city: "",
  country: "",
  phone: "",
  email: "",
  website: "",
  iban: "",
  bic: "",
  bankName: "",
  taxId: "",
  logoUrl: "",
  emailGreeting: "",
  emailPickupInfo: "",
  emailPaymentInfo: "",
  emailAgbText: "",
  emailFooter: "",
  emailAdditionalNotes: "",
};

export const companySettingsRepository = {
  async getSettings(): Promise<CompanySettings> {
    const { getCompanySettings } = await import("@/app/actions/company.actions");
    return getCompanySettings();
  },

  async updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const { updateCompanySettings } = await import("@/app/actions/company.actions");
    return updateCompanySettings(settings);
  }
};
